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

from payments.models import Transaction, PaymentMethod, PaymentStatus
from booking.models import Contribution, ContributionStatus
from membership.models import Membership
from users.models import User

URL = "/api/payments/transactions/"


def detail_url(pk):
    return f"{URL}{pk}/"


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


@pytest.fixture
def transaction(db, student_user):
    return Transaction.objects.create(
        user=student_user, method=PaymentMethod.CASH,
        receipt_number="RCPT-100", amount_total=Decimal("30.00"),
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

    def test_linking_a_contribution_does_not_change_its_status(
        self, staff_client, student_user, accepted_contribution,
    ):
        """Manual (cash/bank) payments must not auto-mark the contribution
        PAYED — an admin can record several installment payments against the
        same contribution, and only an explicit, separate status change
        (still to be decided) should flip it to PAYED."""
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-011", "amount_total": "30.00",
            "contribution_ids": [accepted_contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        accepted_contribution.refresh_from_db()
        assert accepted_contribution.status == ContributionStatus.ACCEPTED

    def test_without_contributions_nothing_is_marked_payed(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-004", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    @patch("booking.tasks.send_transaction_completed_email.delay")
    def test_linking_a_contribution_sends_transaction_email(
        self, mock_send_email, staff_client, student_user, accepted_contribution
    ):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-007", "amount_total": "100.00",
            "contribution_ids": [accepted_contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        mock_send_email.assert_called_once_with(res.data["id"])

    @patch("booking.tasks.send_transaction_completed_email.delay")
    def test_without_contributions_no_payment_email_is_sent(self, mock_send_email, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-008", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        mock_send_email.assert_not_called()

    @patch("booking.tasks.send_transaction_completed_email.delay")
    def test_transaction_email_dispatches_for_the_installment_transaction(
        self, mock_send_email, staff_client, student_user, accepted_contribution,
    ):
        """Installments: dispatch must carry *this* 30€ transaction's id, not
        the 100€ contribution's — send_transaction_completed_email reads the
        amount from the Transaction it's given, so the id has to be right.
        The actual rendered amount is covered directly in
        booking/tests/test_transaction_completed_email.py, since mocking
        .delay() here never runs the task body that builds that context."""
        assert accepted_contribution.amount == Decimal("100.00")

        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-012", "amount_total": "30.00",
            "contribution_ids": [accepted_contribution.id],
        }, format="json")

        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.amount_total == Decimal("30.00")
        mock_send_email.assert_called_once_with(transaction.id)

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
        assert len(res.data["results"]) == 2

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
        assert len(res.data["results"]) == 1
        assert res.data["results"][0]["id"] == mine.id

    def test_list_filtered_by_event(self, staff_client, student_user, contribution, world_data):
        from utils.mock_festival import make_festival_event
        matching_event = make_festival_event(name="Lindy Hop Beginners")
        other_event = make_festival_event(name="Blues Fundamentals")
        contribution.events.add(matching_event)
        matching = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-020", amount_total=Decimal("30.00"),
        )
        matching.contributions.add(contribution)

        other_contribution = Contribution.objects.create(
            user=student_user, membership=contribution.membership, amount=Decimal("30.00"),
            status=ContributionStatus.PAYED,
        )
        other_contribution.events.add(other_event)
        other = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-021", amount_total=Decimal("30.00"),
        )
        other.contributions.add(other_contribution)

        res = staff_client.get(URL, {"event": matching_event.id})

        assert res.status_code == http_status.HTTP_200_OK
        ids = [t["id"] for t in res.data["results"]]
        assert matching.id in ids
        assert other.id not in ids

    def test_list_filtered_by_event_style(self, staff_client, student_user, contribution, world_data):
        from utils.mock_festival import make_festival_event
        from event.models import Style
        matching_event = make_festival_event(name="Solo Jazz Intensive")
        other_event = make_festival_event(name="Balboa Basics")
        style = Style.objects.create(name="Solo Jazz")
        matching_event.styles.add(style)
        contribution.events.add(matching_event)
        matching = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-022", amount_total=Decimal("30.00"),
        )
        matching.contributions.add(contribution)

        other_contribution = Contribution.objects.create(
            user=student_user, membership=contribution.membership, amount=Decimal("30.00"),
            status=ContributionStatus.PAYED,
        )
        other_contribution.events.add(other_event)
        other = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-023", amount_total=Decimal("30.00"),
        )
        other.contributions.add(other_contribution)

        res = staff_client.get(URL, {"style": style.id})

        assert res.status_code == http_status.HTTP_200_OK
        ids = [t["id"] for t in res.data["results"]]
        assert matching.id in ids
        assert other.id not in ids

    def test_list_filtered_by_event_level(self, staff_client, student_user, contribution, world_data):
        from utils.mock_festival import make_festival_event
        matching_event = make_festival_event(name="Intermediate Lindy")
        other_event = make_festival_event(name="Advanced Lindy")
        contribution.events.add(matching_event)
        matching = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-024", amount_total=Decimal("30.00"),
        )
        matching.contributions.add(contribution)

        other_contribution = Contribution.objects.create(
            user=student_user, membership=contribution.membership, amount=Decimal("30.00"),
            status=ContributionStatus.PAYED,
        )
        other_contribution.events.add(other_event)
        other = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-025", amount_total=Decimal("30.00"),
        )
        other.contributions.add(other_contribution)

        res = staff_client.get(URL, {"level": matching_event.level_id})

        assert res.status_code == http_status.HTTP_200_OK
        ids = [t["id"] for t in res.data["results"]]
        assert matching.id in ids
        assert other.id not in ids

    def test_list_shows_nested_user_info(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-001", amount_total=Decimal("30.00"),
        )

        res = staff_client.get(URL)

        assert res.data["results"][0]["user"]["email"] == student_user.email
        assert res.data["results"][0]["user"]["id"] == student_user.id

    def test_list_includes_stripe_transactions(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.STRIPE,
            stripe_session_id="cs_test_list", amount_total=Decimal("75.00"),
        )

        res = staff_client.get(URL)

        assert len(res.data["results"]) == 1
        assert res.data["results"][0]["method"] == "stripe"

    def test_list_shows_status(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.STRIPE,
            stripe_session_id="cs_test_status", amount_total=Decimal("75.00"),
            status=PaymentStatus.COMPLETED,
        )

        res = staff_client.get(URL)

        assert res.data["results"][0]["status"] == "completed"

    def test_list_shows_contribution_event_name(self, staff_client, student_user, contribution, world_data):
        from utils.mock_festival import make_festival_event
        event = make_festival_event(name="Lindy Hop Beginners")
        contribution.events.add(event)
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-009", amount_total=Decimal("100.00"),
        )
        transaction.contributions.add(contribution)

        res = staff_client.get(URL)

        payment = next(t for t in res.data["results"] if t["id"] == transaction.id)
        assert payment["contributions"][0]["event_name"] == "Lindy Hop Beginners"

    def test_event_name_is_none_when_contribution_has_no_event(self, staff_client, student_user, contribution):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-010", amount_total=Decimal("100.00"),
        )
        transaction.contributions.add(contribution)

        res = staff_client.get(URL)

        payment = next(t for t in res.data["results"] if t["id"] == transaction.id)
        contrib_data = payment["contributions"][0]
        assert "event_name" in contrib_data
        assert contrib_data["event_name"] is None


@pytest.mark.integration
class TestUpdateTransaction:
    """GET/PUT/PATCH /api/payments/transactions/{id}/ — admin-only editing
    of an existing transaction (status, receipt, amount, date, linked
    contributions). No endpoint existed for this before; TransactionSerializer
    itself is unchanged, only reused against the new detail view."""

    def test_unauthenticated_returns_401(self, client, transaction):
        res = client.patch(detail_url(transaction.pk), {"status": "completed"}, format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_non_admin_returns_403(self, student_client, transaction):
        res = student_client.patch(detail_url(transaction.pk), {"status": "completed"}, format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_admin_can_retrieve(self, staff_client, transaction):
        res = staff_client.get(detail_url(transaction.pk))
        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["id"] == transaction.pk

    def test_admin_can_patch_status_only(self, staff_client, transaction):
        res = staff_client.patch(detail_url(transaction.pk), {"status": "completed"}, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        transaction.refresh_from_db()
        assert transaction.status == PaymentStatus.COMPLETED

    def test_patching_status_only_does_not_require_receipt_number(self, staff_client, transaction):
        """PATCH is a partial update — validate() must fall back to the
        instance's existing receipt_number instead of requiring it on every
        payload, or any status-only edit would 400."""
        res = staff_client.patch(detail_url(transaction.pk), {"status": "processing"}, format="json")
        assert res.status_code == http_status.HTTP_200_OK

    def test_admin_can_patch_receipt_number(self, staff_client, transaction):
        res = staff_client.patch(detail_url(transaction.pk), {"receipt_number": "RCPT-101"}, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        transaction.refresh_from_db()
        assert transaction.receipt_number == "RCPT-101"

    def test_admin_can_full_update_via_put(self, staff_client, transaction, student_user):
        res = staff_client.put(detail_url(transaction.pk), {
            "user": student_user.id, "method": "bank",
            "receipt_number": "RCPT-102", "amount_total": "45.00",
            "status": "completed",
        }, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        transaction.refresh_from_db()
        assert transaction.method == PaymentMethod.BANK
        assert transaction.receipt_number == "RCPT-102"
        assert transaction.amount_total == Decimal("45.00")
        assert transaction.status == PaymentStatus.COMPLETED

    def test_admin_can_update_linked_contributions(self, staff_client, transaction, accepted_contribution):
        res = staff_client.patch(
            detail_url(transaction.pk),
            {"contribution_ids": [accepted_contribution.id]},
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        assert list(transaction.contributions.all()) == [accepted_contribution]

    def test_stripe_method_is_rejected_on_update(self, staff_client, transaction):
        res = staff_client.patch(detail_url(transaction.pk), {"method": "stripe"}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST


@pytest.mark.integration
class TestTransactionNotes:

    def test_create_with_notes_persists(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-030", "amount_total": "30.00",
            "notes": "Paid cash at the front desk",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        transaction = Transaction.objects.get(id=res.data["id"])
        assert transaction.notes == "Paid cash at the front desk"

    def test_create_response_includes_notes(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-031", "amount_total": "30.00",
            "notes": "Refund pending",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert res.data["notes"] == "Refund pending"

    def test_create_without_notes_is_optional(self, staff_client, student_user):
        res = staff_client.post(URL, {
            "user": student_user.id, "method": "cash",
            "receipt_number": "RCPT-032", "amount_total": "30.00",
        }, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert res.data["notes"] is None

    def test_admin_can_retrieve_notes(self, staff_client, student_user):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-033", amount_total=Decimal("30.00"),
            notes="Set up via ORM",
        )
        res = staff_client.get(detail_url(transaction.pk))
        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["notes"] == "Set up via ORM"

    def test_admin_can_patch_notes(self, staff_client, transaction):
        res = staff_client.patch(detail_url(transaction.pk), {"notes": "Updated note"}, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        transaction.refresh_from_db()
        assert transaction.notes == "Updated note"

    def test_admin_can_clear_notes(self, staff_client, student_user):
        transaction = Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-034", amount_total=Decimal("30.00"),
            notes="To be cleared",
        )
        res = staff_client.patch(detail_url(transaction.pk), {"notes": None}, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        transaction.refresh_from_db()
        assert transaction.notes is None

    def test_list_includes_notes(self, staff_client, student_user):
        Transaction.objects.create(
            user=student_user, method=PaymentMethod.CASH,
            receipt_number="RCPT-035", amount_total=Decimal("30.00"),
            notes="Visible in list",
        )
        res = staff_client.get(URL)
        assert res.data["results"][0]["notes"] == "Visible in list"
