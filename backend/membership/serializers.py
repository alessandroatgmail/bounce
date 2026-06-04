from rest_framework import serializers
from event.models import EventType
from event.serializers import EventTypeSerializer
from .models import Membership, MembershipRule, Discount


class MembershipRuleSerializer(serializers.ModelSerializer):
    event_type = EventTypeSerializer(read_only=True)
    event_type_id = serializers.PrimaryKeyRelatedField(
        queryset=EventType.objects.all(), source="event_type", write_only=True
    )

    class Meta:
        model = MembershipRule
        fields = ["id", "membership", "event_type", "event_type_id", "max_events"]


class MembershipSerializer(serializers.ModelSerializer):
    rules = MembershipRuleSerializer(many=True, read_only=True, source="membershiprule_set")

    class Meta:
        model = Membership
        fields = ["id", "name", "type", "contribution", "color", "max_events", "duration", "rules"]

class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = ["id", "name", "name_ext", "description", "rate", "amount"]
        