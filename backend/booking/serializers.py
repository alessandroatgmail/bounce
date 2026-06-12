from collections import Counter
from django.db import transaction

from decimal import Decimal
from django.contrib.auth import get_user_model
from . import service
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from rest_framework import serializers
from config.models import SiteSettings
from event.models import Event, PartnerRole
from event.serializers import EventSerializer
from membership.models import Membership, Discount
from membership.serializers import MembershipSerializer, DiscountSerializer
from .models import Booking, Contribution, ContributionStatus
from .utils import sync_bookings



def _validate_membership_events(membership, events, field='event_id'):
    """Raise ValidationError if events violate membership rules."""
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


class ContributionSerializer(serializers.ModelSerializer):
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
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
    discounted_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Contribution
        fields = [
            'id', 'status', 'amount', 'user',
            'events', 'event_ids', 'membership', 'membership_id',
            'start_date', 'end_date', 'upgraded_from',
            'discounts', 'discount_ids', 'discounted_amount',
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
        contribution = Contribution.objects.create(**validated_data)
        contribution.events.set(events)
        contribution.discounts.set(discounts)
        if contribution.membership and contribution.membership.duration:
            contribution.end_date = timezone.now() + relativedelta(months=contribution.membership.duration)
            contribution.save(update_fields=['end_date'])
        return contribution

    def update(self, instance, validated_data):
        events = validated_data.pop('events', None)
        discounts = validated_data.pop('discounts', None)
        old_status = instance.status
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if discounts is not None:
            instance.discounts.set(discounts)

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


class UserContributionSerializer(serializers.ModelSerializer):
    membership = MembershipSerializer(read_only=True)
    membership_id = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), source='membership', write_only=True,
    )
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), write_only=True, required=False, allow_null=True,
    )
    upgraded_from = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    partner_email = serializers.EmailField(required=False)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True), write_only=True, required=False,
        source="partner"
    )
    partner = serializers.StringRelatedField(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(write_only=True, required=False, queryset=PartnerRole.objects.all(), source='role')
    role = serializers.StringRelatedField(read_only=True)
    discounts = DiscountSerializer(many=True, read_only=True)
    discounted_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Contribution
        fields = [
            'id', 'status', 'membership', 'membership_id', 'events', 'event_id',
            'amount', 'start_date', 'end_date', 'upgraded_from', 'partner_email',
            'partner_id', 'role_id', 'role', 'partner',
            'discounts', 'discounted_amount',
        ]
        read_only_fields = ['id', 'status', 'amount', 'start_date', 'end_date', 'upgraded_from',]

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
        if event:
            _validate_membership_events(membership, [event])
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

    def create(self, validated_data):
        event = validated_data.pop('event_id', None)

        membership = validated_data['membership']
        validated_data['amount'] = Decimal(membership.contribution)
        # update start date and end date
        start_date, end_date = service._contribution_date_range(membership, event)
        if start_date:
            validated_data.update({"start_date": start_date})
        if end_date:
            validated_data.update({"end_date": end_date})
        contribution = Contribution.objects.create(**validated_data)
        # create partner contribution
        if event:
            contribution.events.add(event)
            if contribution.partner:
                partner_contribution = service._create_partner_contribution(contribution, contribution.partner)
                service._apply_couple_discount(contribution, partner_contribution)
                service._send_contribution_email(partner_contribution)
            service._send_contribution_email(
                contribution,
            )
            # check availability
            print (f" available spot {event.available_spot}")
            if event.available_spot > 1:
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
