"""
Tests for the admin-only manual transaction endpoint:
  POST /api/payments/transactions/

Stripe transactions are created automatically by the webhook
(see booking/tests/test_checkout.py) — this endpoint is only for
recording cash/bank payments taken outside Stripe.
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status as http_status

from payments.models import Transaction, PaymentMethod
from booking.models import Contribution, ContributionStatus
from membership.models import Membership
from users.models import User

URL = "/api/payments/transactions/"


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


@pytest.fixture
def accepted_contribution(db, student_user, membership):
    return Contribution.objects.create(
        user=student_user,
        membership=membership,
        amount=Decimal("100.00"),
        status=ContributionStatus.ACCEPTED,
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email="other@bounce.com", password="StrongPass123!",
        is_staff=False, is_active=True,
    )


@pytest.mark.integration
class TestCreateTransaction:

    def test_unauthenticated_returns_401(self, client, student_user):
        res = client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-001", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_non_admin_returns_403(self, student_client, student_user):
        res = student_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-001", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_admin_can_create_cash_transaction(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-001", "amount_total": "30.00",
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.user == student_user
        assert transaction.method == PaymentMethod.CASH
        assert transaction.receipt_number == "RCPT-001"
        assert transaction.amount_total == Decimal("30.00")
        assert transaction.currency == "eur"

    def test_admin_can_create_bank_transaction(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "bank",
            "receipt_number": "BANK-2026-001", "amount_total": "120.00",
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.method == PaymentMethod.BANK
        assert transaction.receipt_number == "BANK-2026-001"

    def test_receipt_number_required_for_cash(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "receipt_number" in res.data

    def test_stripe_method_is_rejected(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "stripe",
            "receipt_number": "RCPT-001", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "method" in res.data

    def test_can_link_contributions(self, staff_client, student_user, contribution):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-002", "amount_total": "100.00",
            "contribution_ids": [contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert list(transaction.contributions.all()) == [contribution]

    def test_linking_a_contribution_marks_it_payed(self, staff_client, student_user, accepted_contribution):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-003", "amount_total": "100.00",
            "contribution_ids": [accepted_contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        accepted_contribution.refresh_from_db()
        assert accepted_contribution.status == ContributionStatus.PAYED

    def test_without_contributions_nothing_is_marked_payed(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-004", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    @patch("booking.utils.send_email_task.delay")
    def test_linking_a_contribution_sends_payment_email(
        self, mock_send_email, staff_client, student_user, accepted_contribution
    ):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-007", "amount_total": "100.00",
            "contribution_ids": [accepted_contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        mock_send_email.assert_called_once()
        call_args = mock_send_email.call_args
        assert call_args[0][0] == student_user.id
        assert call_args[1]['template'] == 'payment_success_email'

    @patch("booking.utils.send_email_task.delay")
    def test_without_contributions_no_payment_email_is_sent(self, mock_send_email, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-008", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        mock_send_email.assert_not_called()

    def test_date_defaults_to_now(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-005", "amount_total": "30.00",
        }, format="json")
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.date.date() == timezone.now().date()

    def test_date_can_be_set_explicitly(self, staff_client, student_user):
        backdated = "2026-01-05T10:00:00Z"
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-006", "amount_total": "30.00",
            "date": backdated,
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.date.isoformat() == "2026-01-05T10:00:00+00:00"


@pytest.mark.integration
class TestListTransactions:

    def test_unauthenticated_returns_401(self, client):
        res = client.get(URL)
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_non_admin_returns_403(self, student_client):
        res = student_client.get(URL)
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_admin_can_list_all_transactions(self, staff_client, student_user, other_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )
        Transaction.objects.create(
            user=other_user, method=PaymentMethod.BANK,
            receipt_number="BANK-001", amount_total=Decimal("50.00"),
        )

        res = staff_client.get(URL)

        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 2

    def test_list_filtered_by_user(self, staff_client, student_user, other_user):
        mine = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )
        Transaction.objects.create(
            user=other_user, method=PaymentMethod.BANK,
            receipt_number="BANK-001", amount_total=Decimal("50.00"),
        )

        res = staff_client.get(URL, {"user": student_user.id})

        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 1
        assert res.data[0]["id"] == mine.id

    def test_list_shows_nested_user_info(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )

        res = staff_client.get(URL)

        assert res.data[0]["user"]["email"] == student_user.email
        assert res.data[0]["user"]["id"] == student_user.id

    def test_list_includes_stripe_transactions(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.STRIPE,
            stripe_session_id="cs_test_list", amount_total=Decimal("75.00"),
        )

        res = staff_client.get(URL)

        assert len(res.data) == 1
        assert res.data[0]["method"] == "stripe"
