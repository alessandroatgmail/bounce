from collections import Counter
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
from event.models import Event, Level, PartnerRole
from event.serializers import EventSerializer
from membership.models import Membership, Discount
from membership.serializers import MembershipSerializer, DiscountSerializer
from .models import Booking, BookingStatus, Contribution, ContributionStatus, ExtraItem
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
        fields = ['id', 'name', 'name_it', 'name_en', 'value', 'description', 'description_en', 'description_en_it']


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

    class Meta(UserContributionSerializer.Meta):
        fields = UserContributionSerializer.Meta.fields + ['event_ids']

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
        return attrs

    def create(self, validated_data):
        event = validated_data.pop('event_id', None)
        event_ids = validated_data.pop('event_ids', [])
        membership = validated_data['membership']
        contribution = self._create_contribution_shell(validated_data, event)

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
