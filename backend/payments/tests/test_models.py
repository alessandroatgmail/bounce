import pytest
from decimal import Decimal
from django.db import IntegrityError
from django.utils import timezone

from payments.models import Transaction, PaymentMethod
from booking.models import Contribution, ContributionStatus
from membership.models import Membership


@pytest.fixture
def membership(db):
    return Membership.objects.create(name="Full Pass", contribution=100)


@pytest.fixture
def contribution(db, student_user, membership):
    return Contribution.objects.create(
        user=student_user,
        membership=membership,
        amount=Decimal("100.00"),
        status=ContributionStatus.PAYED,
    )


@pytest.mark.unit
class TestTransaction:

    def test_create_stripe_transaction_with_required_fields(self, db, student_user, contribution):
        transaction = Transaction.objects.create(
            user=student_user,
            method=PaymentMethod.STRIPE,
            stripe_session_id="cs_test_123",
            stripe_payment_intent_id="pi_test_123",
            amount_total=Decimal("100.00"),
            currency="eur",
        )
        transaction.contributions.add(contribution)

        assert transaction.user == student_user
        assert transaction.method == PaymentMethod.STRIPE
        assert transaction.stripe_session_id == "cs_test_123"
        assert transaction.stripe_payment_intent_id == "pi_test_123"
        assert transaction.amount_total == Decimal("100.00")
        assert transaction.currency == "eur"
        assert transaction.date is not None
        assert list(transaction.contributions.all()) == [contribution]

    def test_method_defaults_to_stripe(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user,
            stripe_session_id="cs_test_default",
            amount_total=Decimal("10.00"),
        )
        assert transaction.method == PaymentMethod.STRIPE

    def test_currency_defaults_to_eur(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user,
            stripe_session_id="cs_test_456",
            amount_total=Decimal("50.00"),
        )
        assert transaction.currency == "eur"

    def test_stripe_session_id_must_be_unique(self, db, student_user):
        Transaction.objects.create(
            user=student_user,
            stripe_session_id="cs_test_dup",
            amount_total=Decimal("10.00"),
        )
        with pytest.raises(IntegrityError):
            Transaction.objects.create(
                user=student_user,
                stripe_session_id="cs_test_dup",
                amount_total=Decimal("10.00"),
            )

    def test_cash_transaction_does_not_require_stripe_session_id(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user,
            method=PaymentMethod.CASH,
            receipt_number="RCPT-001",
            amount_total=Decimal("30.00"),
        )
        assert transaction.method == PaymentMethod.CASH
        assert transaction.stripe_session_id is None
        assert transaction.receipt_number == "RCPT-001"

    def test_multiple_cash_transactions_without_stripe_session_id_are_allowed(self, db, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-002", amount_total=Decimal("40.00"),
        )
        assert Transaction.objects.filter(method=PaymentMethod.CASH).count() == 2

    def test_bank_transaction_with_receipt_number(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user,
            method=PaymentMethod.BANK,
            receipt_number="BANK-2026-001",
            amount_total=Decimal("120.00"),
        )
        assert transaction.method == PaymentMethod.BANK
        assert transaction.receipt_number == "BANK-2026-001"

    def test_str_representation(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user,
            method=PaymentMethod.CASH,
            receipt_number="RCPT-010",
            amount_total=Decimal("25.00"),
            currency="eur",
        )
        assert str(transaction) == "Transaction Cash 25.00 eur"

    def test_date_defaults_to_now(self, db, student_user):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-020", amount_total=Decimal("10.00"),
        )
        assert transaction.date.date() == timezone.now().date()

    def test_date_can_be_backdated(self, db, student_user):
        backdated = timezone.make_aware(timezone.datetime(2026, 1, 5, 10, 0))
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-021", amount_total=Decimal("10.00"),
            date=backdated,
        )
        assert transaction.date == backdated

    def test_contributions_relation_is_reverse_accessible(self, db, student_user, contribution):
        transaction = Transaction.objects.create(
            user=student_user,
            stripe_session_id="cs_test_rev",
            amount_total=Decimal("100.00"),
        )
        transaction.contributions.add(contribution)

        assert list(contribution.transactions.all()) == [transaction]
