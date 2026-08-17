from django.contrib.auth import get_user_model
from rest_framework import serializers

from booking.models import Contribution
from event.models import Event
from .models import Transaction, PaymentMethod


class TransactionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'first_name', 'last_name', 'email']


class TransactionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name']


class TransactionContributionSerializer(serializers.ModelSerializer):
    events = TransactionEventSerializer(many=True, read_only=True)
    membership_name = serializers.CharField(source='membership.name', read_only=True, default=None)

    class Meta:
        model = Contribution
        fields = ['id', 'membership_name', 'events']


class TransactionSerializer(serializers.ModelSerializer):
    method = serializers.ChoiceField(choices=[
        (PaymentMethod.CASH, PaymentMethod.CASH.label),
        (PaymentMethod.BANK, PaymentMethod.BANK.label),
    ])
    contributions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    contribution_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Contribution.objects.all(), source='contributions',
        write_only=True, required=False,
    )

    class Meta:
        model = Transaction
        fields = [
            'id', 'user', 'method', 'receipt_number', 'amount_total', 'currency',
            'contributions', 'contribution_ids', 'date',
        ]

    def validate(self, attrs):
        if not attrs.get('receipt_number'):
            raise serializers.ValidationError({'receipt_number': 'Required for cash/bank transactions.'})
        return attrs

    def create(self, validated_data):
        instance = super().create(validated_data)
        contributions = list(instance.contributions.select_related('user', 'membership').prefetch_related('events').all())
        if contributions:
            from booking.utils import mark_contributions_payed, send_payment_emails
            mark_contributions_payed(contributions)
            send_payment_emails(contributions)
        return instance

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['user'] = TransactionUserSerializer(instance.user).data
        return rep


class UserTransactionSerializer(serializers.ModelSerializer):
    contributions = TransactionContributionSerializer(many=True, read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'method', 'receipt_number', 'amount_total', 'currency', 'date', 'contributions']
