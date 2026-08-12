"""
Tests for the self-service payment history endpoint:
  GET /api/payments/my-transactions/

Any authenticated user sees only their own Transaction records —
unlike /api/payments/transactions/, which is admin-only and can see/filter
any user.
"""
import pytest
from decimal import Decimal

from rest_framework import status as http_status

from payments.models import Transaction, PaymentMethod
from booking.models import Contribution, ContributionStatus
from event.models import Event
from membership.models import Membership
from utils.mock_event import make_event_payload

URL = "/api/payments/my-transactions/"


def create_event(**overrides):
    payload = make_event_payload(**overrides)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=payload["start_date"],
        end_date=payload["end_date"],
        duration=payload["duration"],
        capacity=payload["capacity"],
    )


@pytest.mark.integration
class TestMyTransactions:

    def test_unauthenticated_returns_401(self, client):
        res = client.get(URL)
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_sees_only_own_transactions(self, student_client, student_user, other_user):
        mine = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )
        Transaction.objects.create(
            user=other_user, method=PaymentMethod.BANK,
            receipt_number="BANK-001", amount_total=Decimal("50.00"),
        )

        res = student_client.get(URL)

        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 1
        assert res.data[0]["id"] == mine.id

    def test_student_cannot_see_others_transactions_via_user_param(self, student_client, student_user, other_user):
        Transaction.objects.create(
            user=other_user, method=PaymentMethod.BANK,
            receipt_number="BANK-001", amount_total=Decimal("50.00"),
        )

        res = student_client.get(URL, {"user": other_user.id})

        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 0

    def test_returns_expected_fields(self, student_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-002", amount_total=Decimal("42.50"), currency="eur",
        )

        res = student_client.get(URL)

        row = res.data[0]
        assert row["method"] == "cash"
        assert row["receipt_number"] == "RCPT-002"
        assert row["amount_total"] == "42.50"
        assert row["currency"] == "eur"
        assert "date" in row

    def test_includes_linked_contributions_with_events(self, student_client, student_user, world_data):
        membership = Membership.objects.create(name="Full Pass", contribution=100)
        event = create_event()
        contribution = Contribution.objects.create(
            user=student_user, membership=membership,
            amount=Decimal("100.00"), status=ContributionStatus.PAYED,
        )
        contribution.events.add(event)
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-003", amount_total=Decimal("100.00"),
        )
        transaction.contributions.add(contribution)

        res = student_client.get(URL)

        row = res.data[0]
        assert len(row["contributions"]) == 1
        contrib_data = row["contributions"][0]
        assert contrib_data["id"] == contribution.id
        assert contrib_data["membership_name"] == "Full Pass"
        assert contrib_data["events"] == [{"id": event.id, "name": event.name}]

    def test_contributions_empty_list_when_none_linked(self, student_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-004", amount_total=Decimal("10.00"),
        )
        res = student_client.get(URL)
        assert res.data[0]["contributions"] == []
