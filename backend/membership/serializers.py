from rest_framework import serializers
from event.models import Event
from .models import Membership


class MembershipSerializer(serializers.ModelSerializer):
    event_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Event.objects.all(), source="events", write_only=True, required=False
    )
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id", "name", "type", "contribution",
            "max_courses", "max_parties", "color",
            "events", "event_ids",
        ]

    def create(self, validated_data):
        events = validated_data.pop("events", [])
        membership = Membership.objects.create(**validated_data)
        membership.events.set(events)
        return membership

    def update(self, instance, validated_data):
        events = validated_data.pop("events", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if events is not None:
            instance.events.set(events)
        return instance
