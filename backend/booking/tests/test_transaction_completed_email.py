"""
Tests for booking.tasks.send_transaction_completed_email — the task
dispatched by payments.serializers.TransactionSerializer.create()
(via booking.utils.send_transaction_emails).

payments/tests/test_views.py only verifies dispatch (the right transaction
id gets passed to .delay()); mocking .delay() there never runs the task
body, so the actual rendered email content — the whole point of this
task existing (installments: email the amount paid in *this* transaction,
not the contribution's full amount) — is verified here instead.
"""
from decimal import Decimal

import pytest
from django.core import mail

from booking.models import Contribution, ContributionStatus
from booking.tasks import send_transaction_completed_email
from membership.models import Membership
from payments.models import Transaction, PaymentMethod


@pytest.fixture
def membership(db):
    return Membership.objects.create(name="Full Pass", contribution=100)


@pytest.fixture
def contribution(db, student_user, membership):
    return Contribution.objects.create(
        user=student_user,
        membership=membership,
        amount=Decimal("100.00"),
        status=ContributionStatus.ACCEPTED,
    )


@pytest.mark.django_db
class TestSendTransactionCompletedEmail:

    def test_email_uses_transaction_amount_not_full_contribution_amount(
        self, student_user, contribution,
    ):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-020", amount_total=Decimal("30.00"),
        )
        transaction.contributions.add(contribution)

        send_transaction_completed_email(transaction.id)

        assert len(mail.outbox) == 1
        body = mail.outbox[0].body
        assert "30.00" in body
        assert "100.00" not in body

    def test_email_sent_to_transaction_user(self, student_user, contribution):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-021", amount_total=Decimal("30.00"),
        )
        transaction.contributions.add(contribution)

        send_transaction_completed_email(transaction.id)

        assert mail.outbox[0].to == [student_user.email]

    def test_email_lists_linked_event_names(self, student_user, contribution, world_data):
        from utils.mock_festival import make_festival_event
        event = make_festival_event(name="Lindy Hop Beginners")
        contribution.events.add(event)
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-022", amount_total=Decimal("30.00"),
        )
        transaction.contributions.add(contribution)

        send_transaction_completed_email(transaction.id)

        assert "Lindy Hop Beginners" in mail.outbox[0].body
