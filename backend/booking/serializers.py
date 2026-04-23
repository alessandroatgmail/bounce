from collections import Counter
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.utils import timezone
from rest_framework import serializers
from event.models import Event
from membership.models import Membership
from membership.serializers import MembershipSerializer
from .models import Booking, Contribution


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


def _sync_bookings(user, added_events, removed_events):
    now = timezone.now()

    for event in added_events:
        children = event.events.all()
        if event.start_date <= now:
            children = children.filter(start_date__gt=now)
        for child in children:
            Booking.objects.get_or_create(user=user, event=child)

    for event in removed_events:
        future_children = event.events.filter(start_date__gt=now)
        Booking.objects.filter(user=user, event__in=future_children).delete()


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

    class Meta:
        model = Contribution
        fields = ['id', 'amount', 'user', 'events', 'event_ids', 'membership', 'membership_id', 'start_date', 'end_date']
        read_only_fields = ['start_date', 'end_date']

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
        contribution = Contribution.objects.create(**validated_data)
        contribution.events.set(events)
        _sync_bookings(contribution.user, added_events=events, removed_events=[])
        if contribution.membership and contribution.membership.duration:
            contribution.end_date = timezone.now() + relativedelta(months=contribution.membership.duration)
            contribution.save(update_fields=['end_date'])
        return contribution

    def update(self, instance, validated_data):
        events = validated_data.pop('events', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if events is not None:
            old_events = set(instance.events.all())
            new_events = set(events)
            instance.events.set(events)
            _sync_bookings(
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

    class Meta:
        model = Contribution
        fields = ['id', 'membership', 'membership_id', 'events', 'event_id', 'amount', 'start_date', 'end_date']
        read_only_fields = ['id', 'amount', 'start_date', 'end_date']

    def validate(self, attrs):
        membership = attrs['membership']
        event = attrs.get('event_id')
        if event:
            _validate_membership_events(membership, [event])
        return attrs

    def create(self, validated_data):
        event = validated_data.pop('event_id', None)
        membership = validated_data['membership']
        validated_data['amount'] = Decimal(membership.contribution)
        contribution = Contribution.objects.create(**validated_data)
        if membership.duration:
            contribution.end_date = timezone.now() + relativedelta(months=membership.duration)
            contribution.save(update_fields=['end_date'])
        if event:
            contribution.events.add(event)
            _sync_bookings(contribution.user, added_events=[event], removed_events=[])
        return contribution
