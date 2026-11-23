from collections import Counter
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from decimal import Decimal
from django.contrib.auth import get_user_model
from . import service
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from django.db.models import Count, Min, Q
from rest_framework import serializers
from config.models import SiteSettings
from django.db.models import Q
from event.models import Event, Level, Location, PartnerRole
from event.serializers import EventSerializer, LocationSerializer
from membership.models import Membership, Discount
from membership.serializers import MembershipSerializer, DiscountSerializer
from .models import AccommodationRoom, AccommodationType, AccomodationRoomType, Booking, BookingStatus, Contribution, ContributionStatus, ExtraItem
from .utils import sync_bookings, book_events_for_contribution, _recurring_children_window



def _validate_membership_events(membership, events, field='event_id'):
    """Raise ValidationError if events violate membership rules."""
    # For a multi_events festival, only verify that the membership is linked to it.
    if len(events) == 1 and events[0].multi_events:
        festival = events[0]
        if not festival.memberships.filter(pk=membership.pk).exists():
            raise serializers.ValidationError({
                field: f"Membership '{membership.name}' is not valid for this festival."
            })
        return

    rules = {
        rule.event_type_id: rule
        for rule in membership.membershiprule_set.select_related('event_type').all()
    }
    if rules:
        type_counts = Counter(e.event_type_id for e in events)
        for type_id, count in type_counts.items():
            if type_id not in rules:
                type_name = next(e.event_type.name for e in events if e.event_type_id == type_id)
                raise serializers.ValidationError({
                    field: f"Membership '{membership.name}' does not include events of type '{type_name}'."
                })
            rule = rules[type_id]
            if count > rule.max_events:
                raise serializers.ValidationError({
                    field: (
                        f"Membership '{membership.name}' allows at most {rule.max_events} "
                        f"event(s) of type '{rule.event_type.name}' (got {count})."
                    )
                })
    if membership.max_events > 0 and len(events) > membership.max_events:
        raise serializers.ValidationError({
            field: (
                f"Membership '{membership.name}' allows at most {membership.max_events} "
                f"event(s) in total (got {len(events)})."
            )
        })


class UserBookingSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'event']


class BookingSerializer(serializers.ModelSerializer):
    """Staff-only serializer exposing every Booking field for full CRUD."""

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'event', 'role', 'partner', 'contribution',
            'partner_email', 'partner_role', 'attended', 'couple',
        ]


class ExtraItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraItem
        fields = [
            'id', 'name', 'name_it', 'name_en', 'value', 'description', 'description_en', 'description_en_it',
            'expiration_date',
        ]


class AccommodationTypeSerializer(serializers.ModelSerializer):
    """
    Dedicated admin endpoint: creates/updates the billable ExtraItem (nested)
    together with the AccommodationType extension (location/capacity), so
    staff never have to touch the generic /extra-items/ endpoint for this.
    """
    # required stays True (the default) so a non-partial create/PUT without
    # it 400s; a PATCH that omits it is still skipped, since DRF checks the
    # root serializer's `partial` flag before `required` on missing fields.
    extra_item = ExtraItemSerializer()
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), source='location', write_only=True,
    )

    class Meta:
        model = AccommodationType
        fields = ['id', 'extra_item', 'location', 'location_id', 'occupants_per_room', 'available_rooms']

    def create(self, validated_data):
        extra_item_data = validated_data.pop('extra_item')
        extra_item = ExtraItem.objects.create(**extra_item_data)
        return AccommodationType.objects.create(extra_item=extra_item, **validated_data)

    def update(self, instance, validated_data):
        extra_item_data = validated_data.pop('extra_item', None)
        if extra_item_data is not None:
            for key, value in extra_item_data.items():
                setattr(instance.extra_item, key, value)
            instance.extra_item.save()
        return super().update(instance, validated_data)


class AccommodationRoomEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name']


class AccommodationRoomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'email', 'first_name', 'last_name']


class AccommodationRoomSerializer(serializers.ModelSerializer):
    """
    Allocates specific users (occupants) into one physical room instance of
    a given accommodation ExtraItem, for a specific event. Capacity
    (occupants_per_room / available_rooms, both read off the linked
    AccommodationType) is enforced at the model level — here we just
    translate the resulting django ValidationError into a 400.
    """
    extra_item = ExtraItemSerializer(read_only=True)
    extra_item_id = serializers.PrimaryKeyRelatedField(
        queryset=ExtraItem.objects.all(), source='extra_item', write_only=True,
    )
    event = AccommodationRoomEventSerializer(read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), source='event', write_only=True,
    )
    users = AccommodationRoomUserSerializer(many=True, read_only=True)
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=get_user_model().objects.all(), source='users',
        write_only=True, required=False,
    )
    occupation_rate = serializers.SerializerMethodField()
    paid_occupation_rate = serializers.SerializerMethodField()

    class Meta:
        model = AccommodationRoom
        fields = [
            'id', 'extra_item', 'extra_item_id', 'event', 'event_id',
            'users', 'user_ids', 'type', 'occupation_rate', 'paid_occupation_rate',
        ]

    def _occupants_per_room(self, obj):
        accommodation_type = getattr(obj.extra_item, 'accommodation_type', None)
        return accommodation_type.occupants_per_room if accommodation_type else None

    def get_occupation_rate(self, obj):
        capacity = self._occupants_per_room(obj)
        if capacity is None:
            return None
        return f"{obj.users.count()}/{capacity}"

    def get_paid_occupation_rate(self, obj):
        capacity = self._occupants_per_room(obj)
        if capacity is None:
            return None
        # There's no direct link from a room occupant to a Contribution
        # (users are assigned to the room directly) — paid here means the
        # user holds at least one PAYED Contribution for this room's event.
        paid_count = sum(
            1 for user in obj.users.all()
            if Contribution.objects.filter(
                user=user, events=obj.event, status=ContributionStatus.PAYED,
            ).exists()
        )
        return f"{paid_count}/{capacity}"

    def create(self, validated_data):
        users = validated_data.pop('users', [])
        try:
            with transaction.atomic():
                room = AccommodationRoom.objects.create(**validated_data)
                if users:
                    room.users.set(users)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return room

    def update(self, instance, validated_data):
        users = validated_data.pop('users', None)
        try:
            with transaction.atomic():
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()
                if users is not None:
                    instance.users.set(users)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return instance


class AccommodationSelectionSerializer(serializers.Serializer):
    """What a student chooses to request an accommodation extra item: which
    accommodation ExtraItem (room class/location) for a given event, what
    kind of room (AccomodationRoomType), and — only for a "friends" room —
    the roommates, by email. Validation only for now; not yet wired into any
    booking endpoint or persisted as an AccommodationRoom."""
    event_id = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())
    extra_item_id = serializers.PrimaryKeyRelatedField(queryset=ExtraItem.objects.all())
    type = serializers.ChoiceField(choices=AccomodationRoomType.choices)
    roommate_emails = serializers.ListField(
        child=serializers.EmailField(), required=False, default=list,
    )

    def validate(self, attrs):
        event = attrs['event_id']
        extra_item = attrs['extra_item_id']

        if getattr(extra_item, 'accommodation_type', None) is None:
            raise serializers.ValidationError({
                'extra_item_id': 'This extra item is not an accommodation.'
            })
        if not event.available_extra_items.filter(pk=extra_item.pk).exists():
            raise serializers.ValidationError({
                'extra_item_id': 'This accommodation is not available for this event.'
            })
        if extra_item.expiration_date <= timezone.now():
            raise serializers.ValidationError({
                'extra_item_id': 'This accommodation is no longer available (expired).'
            })

        roommate_emails = attrs.get('roommate_emails') or []
        if attrs['type'] == AccomodationRoomType.FRIENDS:
            if not roommate_emails:
                raise serializers.ValidationError({
                    'roommate_emails': 'You must list your roommates for a friends room.'
                })
            roommates = []
            for email in roommate_emails:
                roommate = get_user_model().objects.filter(email__iexact=email, is_active=True).first()
                if roommate is None:
                    raise serializers.ValidationError({
                        'roommate_emails': f'No active account is registered with the email "{email}".'
                    })
                roommates.append(roommate)
            attrs['roommates'] = roommates
        elif roommate_emails:
            raise serializers.ValidationError({
                'roommate_emails': 'Roommates can only be specified for a friends room.'
            })

        return attrs


class AcsiExtraItemUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'first_name', 'last_name', 'acsi_expiration_date']


class AcsiExtraItemSerializer(serializers.ModelSerializer):
    """A contribution carrying the ACSI Membership extra item, annotated with
    event_start_date/event_name (the earliest linked event)."""
    user = AcsiExtraItemUserSerializer(read_only=True)
    event_start_date = serializers.DateTimeField(read_only=True)
    event_name = serializers.CharField(read_only=True)

    class Meta:
        model = Contribution
        fields = ['id', 'user', 'event_start_date', 'event_name']


class ContributionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name']


class ContributionPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'first_name', 'last_name', 'email']


class ContributionAdminListSerializer(serializers.ModelSerializer):
    """One row per contribution for the admin Contributions tab — flattened
    fields (full_name, plan, event) rather than nested objects, since this
    is a browsing/filtering table, not a form."""
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    plan = serializers.CharField(source='membership.name', read_only=True, default=None)
    event = serializers.SerializerMethodField()

    class Meta:
        model = Contribution
        fields = ['id', 'user', 'full_name', 'email', 'phone', 'date', 'event', 'plan', 'status']

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_event(self, obj):
        names = [event.name for event in obj.events.all()]
        return ", ".join(names) if names else None


class ContributionSerializer(serializers.ModelSerializer):
    events = ContributionEventSerializer(many=True, read_only=True)
    event_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Event.objects.all(), source='events',
        write_only=True, required=False,
    )
    membership = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    membership_id = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), source='membership',
        write_only=True, required=False, allow_null=True,
    )
    upgraded_from = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    discounts = DiscountSerializer(many=True, read_only=True)
    discount_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Discount.objects.all(), source='discounts',
        write_only=True, required=False,
    )
    extra_items = ExtraItemSerializer(many=True, read_only=True)
    extra_item_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ExtraItem.objects.all(), source='extra_items',
        write_only=True, required=False,
    )
    discounted_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    partner = ContributionPartnerSerializer(read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(), source='partner',
        write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = Contribution
        fields = [
            'id', 'status', 'amount', 'user',
            'events', 'event_ids', 'membership', 'membership_id',
            'start_date', 'end_date', 'upgraded_from',
            'discounts', 'discount_ids', 'extra_items', 'extra_item_ids', 'discounted_amount',
            'notes', 'partner', 'partner_id', 'partner_email',
        ]
        read_only_fields = ['start_date', 'end_date', 'upgraded_from']

    def validate(self, attrs):
        membership = attrs.get('membership', self.instance.membership if self.instance else None)
        if 'events' in attrs:
            events = attrs['events']
        elif self.instance:
            events = list(self.instance.events.all())
        else:
            events = []
        if membership:
            _validate_membership_events(membership, events, field='event_ids')
        return attrs

    def create(self, validated_data):
        events = validated_data.pop('events', [])
        discounts = validated_data.pop('discounts', [])
        extra_items = validated_data.pop('extra_items', [])
        contribution = Contribution.objects.create(**validated_data)
        contribution.events.set(events)
        contribution.discounts.set(discounts)
        contribution.extra_items.set(extra_items)
        if contribution.membership:
            first_event = events[0] if events else None
            start_date, end_date = service._contribution_date_range(
                contribution.membership, first_event, contribution.user,
            )
            if start_date is None:
                start_date = timezone.now()
            if end_date is None and contribution.membership.duration:
                end_date = start_date + relativedelta(months=contribution.membership.duration)
            contribution.start_date = start_date
            update_fields = ['start_date']
            if end_date:
                contribution.end_date = end_date
                update_fields.append('end_date')
            contribution.save(update_fields=update_fields)
        return contribution

    def update(self, instance, validated_data):
        events = validated_data.pop('events', None)
        discounts = validated_data.pop('discounts', None)
        extra_items = validated_data.pop('extra_items', None)
        old_status = instance.status
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if old_status != ContributionStatus.PAYED and instance.status == ContributionStatus.PAYED:
            from booking.utils import send_payment_emails
            send_payment_emails([instance])

        if discounts is not None:
            instance.discounts.set(discounts)

        if extra_items is not None:
            instance.extra_items.set(extra_items)

        if events is not None:
            old_events = set(instance.events.all())
            new_events = set(events)
            instance.events.set(events)
            if instance.status == ContributionStatus.CONFIRMED:
                sync_bookings(
                    instance.user,
                    added_events=new_events - old_events,
                    removed_events=old_events - new_events,
                )

        return instance


class ContributionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['first_name', 'last_name', 'email']


class ContributionOverviewTwinSerializer(serializers.ModelSerializer):
    user = ContributionUserSerializer(read_only=True)
    role = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Contribution
        fields = ['id', 'user', 'status', 'date', 'role']


class ContributionOverviewSerializer(ContributionOverviewTwinSerializer):
    twin_contribution = serializers.SerializerMethodField()

    class Meta(ContributionOverviewTwinSerializer.Meta):
        fields = ContributionOverviewTwinSerializer.Meta.fields + ['twin_contribution']

    def get_twin_contribution(self, obj):
        twin = obj.original_contribution or next(iter(obj.twin_contributions.all()), None)
        if twin is None:
            return None
        return ContributionOverviewTwinSerializer(twin).data


class LinkedContributionSerializer(serializers.ModelSerializer):
    """Embedded representation of a related contribution (possibly owned by another user)."""
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    membership = MembershipSerializer(read_only=True)
    discounts = DiscountSerializer(many=True, read_only=True)
    extra_items = ExtraItemSerializer(many=True, read_only=True)
    discounted_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    stripe_payment_enabled = serializers.BooleanField(read_only=True)
    role = serializers.StringRelatedField(read_only=True)
    partner = serializers.StringRelatedField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Contribution
        fields = ['id', 'status', 'amount', 'discounted_amount', 'remaining_amount',
                  'stripe_payment_enabled', 'events',
                  'membership', 'discounts', 'extra_items', 'role', 'partner', 'user_email']


class FreeFestivalEventEntrySerializer(serializers.Serializer):
    """One entry of `event_ids` when booking a free-choice festival
    (event.multi_events=True, event.free=True) — unlike the fixed-choice
    case (one level + role + partner for everything), the student picks
    these children individually, each with its own role and partner."""
    event_id = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=PartnerRole.objects.all(), required=False, allow_null=True,
    )
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True), required=False, allow_null=True,
    )
    # The frontend resolves partner_id client-side as the student types an
    # email, but still sends the raw email alongside it — if resolution
    # never succeeded (typo, unregistered account), partner_id arrives
    # null while this still carries what was typed, so it isn't silently
    # dropped (same rule as UserContributionSerializer.partner_email).
    partner_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        partner_email = attrs.get('partner_email')
        partner = attrs.get('partner_id')
        if partner_email and not partner:
            partner = get_user_model().objects.filter(
                email__iexact=partner_email, is_active=True,
            ).first()
            if partner is None:
                raise serializers.ValidationError({
                    'partner_email': 'No active account is registered with this email.'
                })
            attrs['partner_id'] = partner
        # Each entry only needs its own event_id/partner_id to check this —
        # doing it here (rather than once over the whole event_ids list)
        # means DRF's list serializer validates every entry independently
        # and reports errors per index, so the response can say which
        # chosen class is the problem instead of one flat message for the
        # whole list.
        child_event = attrs['event_id']
        role = attrs.get('role_id')
        user = self.context["request"].user
        # Unlike the base single-event serializer (gated on
        # event_type.partners > 1), this is gated on whether the child
        # actually has partner roles defined at all — a class with none
        # never requires one. Exception: if the user already holds a role
        # for this class (e.g. they were paired in as someone else's
        # partner and are now registering themselves), omitting role_id
        # here just confirms that existing booking rather than making a
        # fresh choice, so it isn't required again.
        if child_event.event_type.partner_roles.exists() and not role:
            existing_own_booking = Booking.objects.filter(user=user, event=child_event).first()
            if not (existing_own_booking and existing_own_booking.role_id is not None):
                raise serializers.ValidationError({
                    'role_id': 'For this event, you must specify a role.'
                })
        if service._validate_double_registrations(user=user, event=child_event):
            raise serializers.ValidationError({
                'event_id': 'User already registered for this event.'
            })
        if partner:
            # A partner who already independently holds a booking for this
            # event isn't automatically rejected — only when that existing
            # booking already has its own partner, or its role conflicts
            # with the one being offered here (e.g. two Leaders). Otherwise
            # the new booking merges into it (see
            # FreeFestivalContributionSerializer.create()) instead of being
            # treated as a double-booking.
            existing_partner_booking = Booking.objects.filter(user=partner, event=child_event).first()
            if existing_partner_booking:
                if existing_partner_booking.partner_id is not None:
                    raise serializers.ValidationError({
                        'partner_id': 'Partner already has a partner for this event.'
                    })
                complementary_role = (
                    child_event.event_type.partner_roles.exclude(pk=role.pk).first()
                    if role else None
                )
                if (
                    existing_partner_booking.role_id is not None
                    and complementary_role is not None
                    and existing_partner_booking.role_id != complementary_role.pk
                ):
                    raise serializers.ValidationError({
                        'partner_id': 'Partner is already booked with an incompatible role for this event.'
                    })
            else:
                # No existing booking for THIS class — but if the partner
                # already holds their own contribution for this same
                # festival (a plan capped at membership.max_events chosen
                # classes), adding them to one more class they didn't
                # already pick would push their total past that cap.
                festival = child_event.event_set.first()
                if festival:
                    partner_contribution = Contribution.objects.filter(
                        user=partner, events=festival, membership__isnull=False,
                    ).exclude(status=ContributionStatus.CANCELLED).first()
                    if partner_contribution and partner_contribution.membership.max_events:
                        fix_event_ids = set(
                            partner_contribution.membership.fix_events.values_list('id', flat=True)
                        )
                        # Counted against actual Booking rows, not
                        # contribution.events — an admin may have removed
                        # the partner from one of their chosen classes
                        # without touching the contribution itself, which
                        # should free up that slot again.
                        chosen_count = (
                            Booking.objects.filter(user=partner, contribution=partner_contribution)
                            .exclude(event=festival)
                            .exclude(event_id__in=fix_event_ids)
                            .count()
                        )
                        if chosen_count >= partner_contribution.membership.max_events:
                            raise serializers.ValidationError({
                                'partner_id': (
                                    "Adding this partner here would exceed their own "
                                    "plan's class limit for this festival."
                                )
                            })
        return attrs


class UserContributionSerializer(serializers.ModelSerializer):
    # Whether this serializer accepts / requires a fixed-choice festival
    # event (multi_events=True, free=False). The base serializer rejects
    # that shape — book it through FestivalContributionSerializer
    # (POST .../book-festival/) instead, which flips both flags.
    allows_multi_event_festival = False
    requires_multi_event_festival = False
    # Same idea for a free-choice festival (multi_events=True, free=True) —
    # book it through FreeFestivalContributionSerializer
    # (POST .../book-free-festival/) instead.
    allows_free_festival = False
    requires_free_festival = False

    membership = MembershipSerializer(read_only=True)
    membership_id = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), source='membership', write_only=True,
    )
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), write_only=True, required=False, allow_null=True,
    )
    upgraded_from = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    original_contribution = LinkedContributionSerializer(read_only=True, allow_null=True)
    twin_contributions = LinkedContributionSerializer(many=True, read_only=True)
    partner_email = serializers.EmailField(required=False)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True), write_only=True, required=False,
        source="partner"
    )
    partner = serializers.StringRelatedField(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(write_only=True, required=False, queryset=PartnerRole.objects.all(), source='role')
    role = serializers.StringRelatedField(read_only=True)
    level_id = serializers.PrimaryKeyRelatedField(
        queryset=Level.objects.all(), source='level', write_only=True, required=False, allow_null=True,
    )
    level = serializers.StringRelatedField(read_only=True)
    discounts = DiscountSerializer(many=True, read_only=True)
    discounted_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    stripe_payment_enabled = serializers.BooleanField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    extra_items = ExtraItemSerializer(many=True, read_only=True)

    class Meta:
        model = Contribution
        fields = [
            'id', 'status', 'user_email', 'membership', 'membership_id', 'events', 'event_id',
            'amount', 'start_date', 'end_date', 'upgraded_from', 'original_contribution',
            'twin_contributions', 'partner_email',
            'partner_id', 'role_id', 'role', 'partner',
            'level_id', 'level',
            'discounts', 'discounted_amount', 'remaining_amount', 'stripe_payment_enabled', 'extra_items',
        ]
        read_only_fields = ['id', 'status', 'amount', 'start_date', 'end_date', 'upgraded_from',
                            'original_contribution', 'twin_contributions']

    def validate_event_id(self, event_id):
        if service._validate_double_registrations(user=self.context["request"].user, event=event_id):
                raise serializers.ValidationError(
                    "User already registered for this event."
                )
        return event_id

    def validate_partner_id(self, partner_id):
        if self.context["request"].user == partner_id:
            raise serializers.ValidationError("you can't add yourself as partner")
        return partner_id


    def validate(self, attrs):
        membership = attrs['membership']
        event = attrs.get('event_id')
        role = attrs.get('role')
        partner_email = attrs.get('partner_email')
        # partner_id is declared with source="partner", so DRF stores it under 'partner'
        partner = attrs.get('partner')
        if partner_email and not partner:
            # A partner named only by email must already be a registered,
            # activated user — no more deferred "invite by email" linking.
            partner = get_user_model().objects.filter(
                email__iexact=partner_email, is_active=True,
            ).first()
            if partner is None:
                raise serializers.ValidationError({
                    'partner_email': 'No active account is registered with this email.'
                })
            if partner == self.context["request"].user:
                raise serializers.ValidationError("you can't add yourself as partner")
            attrs['partner'] = partner
        if membership.couple and not (partner or partner_email):
            raise serializers.ValidationError(
                f"To use the '{membership.name}' plan you need to add a valid partner email."
            )
        if self.instance is None and not membership.is_available:
            raise serializers.ValidationError({
                'membership_id': f"Membership '{membership.name}' is not available for booking."
            })
        if event:
            is_fixed_festival = event.multi_events and not event.free
            is_free_festival = event.multi_events and event.free
            if is_fixed_festival and not self.allows_multi_event_festival:
                raise serializers.ValidationError({
                    'event_id': (
                        'This is a multi-event festival with a fixed level choice — '
                        'book it through the festival booking endpoint.'
                    )
                })
            if self.requires_multi_event_festival and not is_fixed_festival:
                raise serializers.ValidationError({
                    'event_id': 'This endpoint only books multi-event festivals with a fixed level choice.'
                })
            if is_free_festival and not self.allows_free_festival:
                raise serializers.ValidationError({
                    'event_id': (
                        'This is a multi-event free-choice festival — '
                        'book it through the free festival booking endpoint.'
                    )
                })
            if self.requires_free_festival and not is_free_festival:
                raise serializers.ValidationError({
                    'event_id': 'This endpoint only books multi-event free-choice festivals.'
                })
            _validate_membership_events(membership, [event])
            if self.instance is None:
                window = _recurring_children_window(self.context["request"].user, membership, event)
                if window is not None and len(window) < membership.max_events:
                    raise serializers.ValidationError({
                        'event_id': (
                            f"Membership '{membership.name}' covers {membership.max_events} "
                            f"classes, but only {len(window)} are left in this event — "
                            "out of event boundaries."
                        )
                    })
            if not is_free_festival and not membership.events_only:
                # Role/partner are per-child for a free festival (each
                # event_ids entry carries its own role_id) — and an
                # events_only plan (e.g. a "Party Pass") never books any
                # child that needs one — so neither is required here.
                if event.event_type.partners > 1:
                    if not role:
                        raise serializers.ValidationError("For this event, you must specify a role.")
                else:
                    if partner_email or partner:
                        raise serializers.ValidationError("This event does not need a partner.")
            if partner:
                if service._validate_double_registrations(user=partner, event=event):
                    raise serializers.ValidationError(
                        "Partner already registered for this event."
                    )
        if self.instance is None and membership.duration:
            season_end = SiteSettings.load().season_end
            if season_end:
                projected_end = (timezone.now() + relativedelta(months=membership.duration)).date()
                if projected_end > season_end:
                    raise serializers.ValidationError({
                        'membership_id': (
                            f"This membership would end after the season closes on {season_end}. "
                            "Please upgrade an existing membership instead."
                        )
                    })

        return attrs

    def _create_contribution_shell(self, validated_data, event):
        """Shared preamble for every booking path: compute amount + the
        membership's date range, create the bare Contribution row."""
        membership = validated_data['membership']
        validated_data['amount'] = Decimal(membership.contribution)
        start_date, end_date = service._contribution_date_range(membership, event, validated_data['user'])
        if start_date:
            validated_data.update({"start_date": start_date})
        if end_date:
            validated_data.update({"end_date": end_date})
        return Contribution.objects.create(**validated_data)

    def create(self, validated_data):
        event = validated_data.pop('event_id', None)
        contribution = self._create_contribution_shell(validated_data, event)

        # create partner contribution
        if event:
            contribution.events.add(event)
            service._maybe_add_acsi_extra_item(contribution, event)
            if contribution.partner:
                partner_contribution = service._create_partner_contribution(contribution, contribution.partner)
                service._maybe_add_acsi_extra_item(partner_contribution, event)
                service._apply_couple_discount(contribution, partner_contribution)
                service._send_contribution_email(partner_contribution)
            service._send_contribution_email(
                contribution,
            )
            if service.waiting_list(contribution):
                contribution.status = ContributionStatus.WAITING
                contribution.save()
                if contribution.partner:
                    partner_contribution.status = ContributionStatus.WAITING
                    partner_contribution.save()
            elif event.block_payment:
                # Payment is blocked for this event — hold the contribution
                # for manual approval instead of auto-accepting, and don't
                # send the acceptance email yet.
                contribution.status = ContributionStatus.APPROVING
                contribution.save()
                if contribution.partner:
                    partner_contribution.status = ContributionStatus.APPROVING
                    partner_contribution.save()
                if event.multi_events and not event.free and contribution.level_id:
                    from .tasks import promote_waiting_for_level
                    promote_waiting_for_level.delay(event.id, contribution.level_id)
            else:
                contribution.status = ContributionStatus.ACCEPTED
                contribution.save()
                service._dispatch_change_status_email(
                    contribution_id=contribution.id,
                    user_id=contribution.user.id,
                    old_status=ContributionStatus.RECEIVED,
                    new_status=ContributionStatus.ACCEPTED,
                )
                if contribution.partner:
                    partner_contribution.status = ContributionStatus.ACCEPTED
                    partner_contribution.save()
                    service._dispatch_change_status_email(
                        contribution_id=partner_contribution.id,
                        user_id=partner_contribution.user.id,
                        old_status=ContributionStatus.RECEIVED,
                        new_status=ContributionStatus.ACCEPTED,
                    )
                if event.multi_events and not event.free and contribution.level_id:
                    from .tasks import promote_waiting_for_level
                    promote_waiting_for_level.delay(event.id, contribution.level_id)

            # Booking rows are created immediately, regardless of the
            # status the contribution ends up in (ACCEPTED or WAITING) —
            # the admin register page + Consolidate handle cleaning up
            # no-shows/non-payers, not a payment/status gate.
            book_events_for_contribution(contribution)

        return contribution

    def update(self, instance, validated_data):
        old_status = instance.status
        super().update(instance, validated_data)
        if "status" in validated_data:
            if old_status != validated_data["status"]:
                service._dispatch_change_status_email(
                    contribution_id=instance.id,
                    user_id=instance.user.id,
                    old_status=instance.status,
                    new_status=validated_data["status"],
                )
        return instance


class FestivalContributionSerializer(UserContributionSerializer):
    """Case 3 — festival, fixed choice: level + role + partner chosen once,
    applied to every child event at that level. event_id and level_id are
    both mandatory here (optional on the base serializer), and the target
    event must be a multi_events, non-free festival."""
    allows_multi_event_festival = True
    requires_multi_event_festival = True

    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), write_only=True,
    )
    level_id = serializers.PrimaryKeyRelatedField(
        queryset=Level.objects.all(), source='level', write_only=True,
        required=False, allow_null=True,
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        membership = attrs['membership']
        if not membership.events_only and attrs.get('level') is None:
            raise serializers.ValidationError({'level_id': 'This field is required.'})
        return attrs


class FreeFestivalContributionSerializer(UserContributionSerializer):
    """Case 4 — festival, free choice: the student picks which child
    events to attend themselves (event_ids), each with its own role.
    event_id and event_ids are both mandatory here (optional/absent on
    the base serializer), and the target event must be a multi_events,
    free festival."""
    allows_free_festival = True
    requires_free_festival = True

    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), write_only=True,
    )
    event_ids = FreeFestivalEventEntrySerializer(many=True, write_only=True)
    # Optional — a student isn't required to request accommodation. Bills
    # the chosen extra item (adds it to contribution.extra_items) and
    # assigns a room — see FreeFestivalContributionSerializer.create().
    accommodation = AccommodationSelectionSerializer(write_only=True, required=False)

    class Meta(UserContributionSerializer.Meta):
        fields = UserContributionSerializer.Meta.fields + ['event_ids', 'accommodation']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        membership = attrs['membership']
        # The student picks exactly max_events events themselves. fix_events
        # are separate and additional — booked on top, not counted against
        # this number.
        chosen = attrs.get('event_ids') or []
        if not chosen:
            raise serializers.ValidationError({
                'event_ids': 'You must choose which events to attend for this festival.'
            })
        if len(chosen) != membership.max_events:
            raise serializers.ValidationError({
                'event_ids': (
                    f"Membership '{membership.name}' requires exactly "
                    f"{membership.max_events} event(s), got {len(chosen)}."
                )
            })
        # Double-registration (student or partner) is checked per entry —
        # see FreeFestivalEventEntrySerializer.validate() — so each
        # offending chosen class is reported on its own, not just the
        # first one found across the whole list.
        accommodation = attrs.get('accommodation')
        if accommodation:
            accommodation_extra_item = accommodation['extra_item_id']
            accommodation_type = accommodation_extra_item.accommodation_type
            room_type = accommodation['type']
            # A "friends" request can seat someone who hasn't registered yet
            # (see create() below) — if that's already happened to this
            # user, they're not asking for a new room at all, just
            # confirming one they're already in, so none of the
            # availability checks below apply to them.
            already_seated = room_type == AccomodationRoomType.FRIENDS and AccommodationRoom.objects.filter(
                extra_item=accommodation_extra_item, event=attrs['event_id'],
                type=AccomodationRoomType.FRIENDS, users=self.context['request'].user,
            ).exists()
            if accommodation_type.occupants_per_room > 1 and room_type in (
                AccomodationRoomType.MIXED, AccomodationRoomType.MALE,
                AccomodationRoomType.FEMALE, AccomodationRoomType.FRIENDS,
            ) and not already_seated:
                # Checked up front, before any Contribution row exists, so a
                # fully-booked accommodation type cleanly rejects the whole
                # registration instead of billing an extra item for a room
                # that can never be created (create() just joins/creates
                # once this has already guaranteed one is available). Friends
                # always get a brand new room of their own — they never join
                # another group's — so only overall availability applies.
                has_space = room_type != AccomodationRoomType.FRIENDS and (
                    AccommodationRoom.objects
                    .filter(extra_item=accommodation_extra_item, event=attrs['event_id'], type=room_type)
                    .annotate(occupant_count=Count('users'))
                    .filter(occupant_count__lt=accommodation_type.occupants_per_room)
                    .exists()
                )
                if not has_space:
                    existing_count = AccommodationRoom.objects.filter(extra_item=accommodation_extra_item).count()
                    if existing_count >= accommodation_type.available_rooms:
                        raise serializers.ValidationError({
                            'accommodation': 'No rooms available for this accommodation type.'
                        })
        return attrs

    def create(self, validated_data):
        event = validated_data.pop('event_id', None)
        event_ids = validated_data.pop('event_ids', [])
        accommodation = validated_data.pop('accommodation', None)
        membership = validated_data['membership']
        contribution = self._create_contribution_shell(validated_data, event)

        if accommodation:
            accommodation_extra_item = accommodation['extra_item_id']
            contribution.extra_items.add(accommodation_extra_item)
            occupants_per_room = accommodation_extra_item.accommodation_type.occupants_per_room
            # Single-occupancy (e.g. "Singola") has no one to share the
            # room with, so it's unambiguous who goes in it — handle that
            # simple case immediately.
            if occupants_per_room == 1:
                room = AccommodationRoom.objects.create(extra_item=accommodation_extra_item, event=event)
                room.users.add(contribution.user)
            elif accommodation['type'] in (
                AccomodationRoomType.MIXED, AccomodationRoomType.MALE, AccomodationRoomType.FEMALE,
            ):
                # Join any existing room of this same type for this
                # extra_item/event that still has a free bed; only create a
                # new one (still capped by the type's available_rooms, same
                # as the admin-created path) when every existing one is
                # full or none exist yet. A "friends" room still only
                # bills the item above — matching those occupants together
                # stays a manual admin step.
                room_type = accommodation['type']
                room = (
                    AccommodationRoom.objects
                    .filter(extra_item=accommodation_extra_item, event=event, type=room_type)
                    .annotate(occupant_count=Count('users'))
                    .filter(occupant_count__lt=occupants_per_room)
                    .order_by('id')
                    .first()
                )
                if room is None:
                    room = AccommodationRoom.objects.create(
                        extra_item=accommodation_extra_item, event=event, type=room_type,
                    )
                room.users.add(contribution.user)
            elif accommodation['type'] == AccomodationRoomType.FRIENDS:
                # A roommate listed by someone else's earlier "friends"
                # registration is already seated here (see the elif branch
                # below from their point of view) — joining that same
                # room, never a second one, is what validate() already
                # checked availability for.
                existing_room = AccommodationRoom.objects.filter(
                    extra_item=accommodation_extra_item, event=event,
                    type=AccomodationRoomType.FRIENDS, users=contribution.user,
                ).first()
                if existing_room is None:
                    room = AccommodationRoom.objects.create(
                        extra_item=accommodation_extra_item, event=event, type=AccomodationRoomType.FRIENDS,
                    )
                    room.users.add(contribution.user, *accommodation.get('roommates', []))

        # The parent festival stays on contribution.events (same as every
        # other case) — that's what already_booked/get_booked_by and the
        # frontend's "my bookings" match against on the festival's own
        # card — alongside the chosen children and fix_events, each
        # getting its own Booking with its own role.
        fix_events = list(membership.fix_events.all()) if membership else []
        chosen_events = [entry['event_id'] for entry in event_ids]
        contribution.events.add(event, *chosen_events, *fix_events)
        # One Contribution covers every chosen event, so even a single
        # full class puts the whole registration on the waiting list, not
        # just that class — but Booking.status is per class, so only the
        # actually-full one(s) are flagged there.
        waiting_events = service._free_festival_waiting_events(chosen_events)
        waiting_event_ids = {waiting_event.id for waiting_event in waiting_events}
        contribution.status = ContributionStatus.WAITING if waiting_events else ContributionStatus.ACCEPTED
        contribution.save()
        partner_events: dict = {}
        for entry in event_ids:
            child_event = entry['event_id']
            role = entry.get('role_id')
            partner = entry.get('partner_id')
            booking_status = (
                BookingStatus.WAITING if child_event.id in waiting_event_ids else BookingStatus.ACCEPTED
            )
            # The partner isn't being charged — just paired on this one
            # child event, mutually, the same way book_events_for_contribution
            # pairs two regular bookings: each side's role/partner_role
            # points at the other's. Only computable when both a role and a
            # partner were actually given (a binary role set is assumed,
            # same as everywhere else in this codebase).
            partner_role = (
                child_event.event_type.partner_roles.exclude(pk=role.pk).first()
                if role and partner else None
            )
            student_booking, student_created = Booking.objects.get_or_create(
                user=contribution.user,
                event=child_event,
                defaults={
                    "role": role,
                    "partner": partner,
                    "partner_role": partner_role,
                    "contribution": contribution,
                    "status": booking_status,
                    "couple": bool(partner),
                },
            )
            if not student_created:
                # A stray Booking for this (user, event) pair can already
                # exist outside this contribution (e.g. left over from an
                # earlier registration, or because this user was paired in
                # as someone else's partner) — get_or_create's defaults
                # are silently ignored in that case, so the role/partner
                # this registration asked for has to be applied explicitly
                # too. But never clobber a role/partner this booking
                # already has — e.g. a partner who already holds "Follower"
                # from an earlier pairing must not have it overwritten
                # just because their own later registration resubmits
                # this same class with a different role_id (mirrors the
                # same guard on partner_booking below).
                student_booking.contribution = contribution
                student_booking.status = booking_status
                if role and student_booking.role_id is None:
                    student_booking.role = role
                if partner and student_booking.partner_id is None:
                    student_booking.partner = partner
                    student_booking.partner_role = partner_role
                    student_booking.couple = True
                student_booking.save()
            if partner:
                # The partner may already hold their own, unpaired booking
                # for this event (validated as compatible in
                # FreeFestivalEventEntrySerializer.validate()) — merge into
                # it rather than leaving it untouched, which is what
                # get_or_create's defaults would otherwise do.
                partner_booking, partner_created = Booking.objects.get_or_create(
                    user=partner,
                    event=child_event,
                    defaults={
                        "role": partner_role,
                        "partner": contribution.user,
                        "partner_role": role,
                        "status": booking_status,
                        "couple": True,
                    },
                )
                if not partner_created:
                    partner_booking.partner = contribution.user
                    partner_booking.partner_role = role
                    partner_booking.couple = True
                    if partner_booking.role_id is None and partner_role:
                        partner_booking.role = partner_role
                    partner_booking.save()
                partner_events.setdefault(partner, []).append((child_event, partner_role))
        for fix_event in fix_events:
            Booking.objects.get_or_create(
                user=contribution.user,
                event=fix_event,
                defaults={"contribution": contribution},
            )
        if partner_events:
            service._notify_free_festival_partners(contribution.user, partner_events)
        if waiting_events:
            service._notify_free_festival_waiting_list(contribution, waiting_events)
        return contribution
