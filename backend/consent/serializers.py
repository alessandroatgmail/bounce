from django.utils import timezone
from rest_framework import serializers

from booking.models import Contribution, ExtraItem
from event.models import Event
from membership.models import Membership
from .models import Communication, Consent


class CommunicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name']


class CommunicationExtraItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraItem
        fields = ['id', 'name', 'name_it', 'name_en']


class CommunicationPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Membership
        fields = ['id', 'name']


class CommunicationSerializer(serializers.ModelSerializer):
    events = CommunicationEventSerializer(many=True, read_only=True)
    event_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Event.objects.all(), source='events', write_only=True, required=False,
    )
    extra_items = CommunicationExtraItemSerializer(many=True, read_only=True)
    extra_item_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ExtraItem.objects.all(), source='extra_items', write_only=True, required=False,
    )
    plans = CommunicationPlanSerializer(many=True, read_only=True)
    plan_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Membership.objects.all(), source='plans', write_only=True, required=False,
    )

    class Meta:
        model = Communication
        fields = [
            'id',
            'events', 'event_ids', 'extra_items', 'extra_item_ids', 'plans', 'plan_ids',
            'title', 'title_it', 'title_en', 'desc', 'desc_it', 'desc_en', 'recurrent',
        ]


class ConsentSerializer(serializers.ModelSerializer):
    communication_id = serializers.PrimaryKeyRelatedField(
        queryset=Communication.objects.all(), source='communication',
    )
    contribution_id = serializers.PrimaryKeyRelatedField(
        queryset=Contribution.objects.all(), source='contribution', required=False, allow_null=True,
    )

    class Meta:
        model = Consent
        fields = ['id', 'communication_id', 'contribution_id', 'date', 'expiration_date']
        read_only_fields = ['id', 'date', 'expiration_date']

    def validate(self, attrs):
        communication = attrs['communication']
        contribution = attrs.get('contribution')
        user = self.context['request'].user

        # A recurrent Communication must be re-confirmable every time it
        # comes up again (e.g. once per booking), so duplicates are allowed
        # on purpose there. Checking contribution=contribution (rather than
        # a DB unique_together) also correctly catches the no-contribution
        # case, where Postgres would otherwise treat each NULL as distinct.
        if not communication.recurrent:
            already_consented = Consent.objects.filter(
                communication=communication, user=user, contribution=contribution,
                expiration_date__gt=timezone.now(),
            ).exists()
            if already_consented:
                raise serializers.ValidationError('Consent already recorded for this communication.')

        return attrs

    def create(self, validated_data):
        communication = validated_data['communication']
        validated_data['user'] = self.context['request'].user
        validated_data['desc_it_signed'] = communication.desc_it
        validated_data['desc_en_signed'] = communication.desc_en
        return super().create(validated_data)
