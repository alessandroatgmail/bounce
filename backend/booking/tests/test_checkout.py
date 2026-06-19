"""
Tests for the Stripe checkout flow:
  - POST /api/booking/checkout-session/
  - POST /api/booking/stripe-webhook/
  - GET  /api/booking/payment/success/
"""
import json
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from rest_framework import status as http_status

from booking.models import Contribution, ContributionStatus
from membership.models import Membership

CHECKOUT_URL = "/api/booking/checkout-session/"
WEBHOOK_URL = "/api/booking/stripe-webhook/"
SUCCESS_URL = "/api/booking/payment/success/"


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def membership(db):
    return Membership.objects.create(name="Full Pass", contribution=100)


@pytest.fixture
def accepted_contribution(db, student_user, membership):
    return Contribution.objects.create(
        user=student_user,
        membership=membership,
        amount=Decimal("100.00"),
        status=ContributionStatus.ACCEPTED,
    )


@pytest.fixture
def twin_contribution(db, partner_user, membership, accepted_contribution):
    """Partner's contribution linked to accepted_contribution as the original."""
    return Contribution.objects.create(
        user=partner_user,
        membership=membership,
        amount=Decimal("100.00"),
        status=ContributionStatus.ACCEPTED,
        original_contribution=accepted_contribution,
    )


def _mock_session(url="https://checkout.stripe.com/pay/cs_test_123"):
    session = MagicMock()
    session.url = url
    return session


def _mock_event(contribution_ids: list[int], event_type="checkout.session.completed"):
    metadata = MagicMock()
    metadata.__contains__ = lambda self, k: k == "contribution_ids"
    metadata.__getitem__ = lambda self, k: ",".join(str(i) for i in contribution_ids)

    session_obj = MagicMock()
    session_obj.metadata = metadata

    event = MagicMock()
    event.__getitem__ = lambda self, k: {
        "type": event_type,
        "data": {"object": session_obj},
    }[k]
    return event


# ── create_checkout_session ───────────────────────────────────────────────────

@pytest.mark.integration
class TestCreateCheckoutSession:

    def test_unauthenticated_returns_401(self, client):
        res = client.post(CHECKOUT_URL, {"contribution_ids": []}, format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_empty_ids_returns_400(self, student_client):
        res = student_client.post(CHECKOUT_URL, {"contribution_ids": []}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_non_accepted_contribution_returns_400(self, student_client, db, membership, student_user):
        c = Contribution.objects.create(
            user=student_user, membership=membership,
            amount=Decimal("50.00"), status=ContributionStatus.RECEIVED,
        )
        res = student_client.post(CHECKOUT_URL, {"contribution_ids": [c.id]}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_other_users_contribution_returns_400(self, student_client, db, membership, partner_user):
        other = Contribution.objects.create(
            user=partner_user, membership=membership,
            amount=Decimal("80.00"), status=ContributionStatus.ACCEPTED,
        )
        res = student_client.post(CHECKOUT_URL, {"contribution_ids": [other.id]}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    @patch("booking.views_checkout.stripe.checkout.Session.create")
    def test_happy_path_returns_stripe_url(self, mock_create, student_client, accepted_contribution):
        mock_create.return_value = _mock_session()
        res = student_client.post(
            CHECKOUT_URL,
            {"contribution_ids": [accepted_contribution.id]},
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["url"] == "https://checkout.stripe.com/pay/cs_test_123"
        mock_create.assert_called_once()

    @patch("booking.views_checkout.stripe.checkout.Session.create")
    def test_line_item_uses_discounted_amount(self, mock_create, student_client, db, membership, student_user):
        from membership.models import Discount
        discount = Discount.objects.create(name="EARLY", name_ext="Early Bird", rate=10)
        c = Contribution.objects.create(
            user=student_user, membership=membership,
            amount=Decimal("100.00"), status=ContributionStatus.ACCEPTED,
        )
        c.discounts.add(discount)
        mock_create.return_value = _mock_session()

        student_client.post(CHECKOUT_URL, {"contribution_ids": [c.id]}, format="json")

        call_kwargs = mock_create.call_args[1]
        unit_amount = call_kwargs["line_items"][0]["price_data"]["unit_amount"]
        assert unit_amount == 9000  # €90.00 after 10% discount

    @patch("booking.views_checkout.stripe.checkout.Session.create")
    def test_twin_contribution_included_when_original_user_pays(
        self, mock_create, student_client, accepted_contribution, twin_contribution
    ):
        mock_create.return_value = _mock_session()
        res = student_client.post(
            CHECKOUT_URL,
            {"contribution_ids": [accepted_contribution.id, twin_contribution.id]},
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        call_kwargs = mock_create.call_args[1]
        assert len(call_kwargs["line_items"]) == 2

    @patch("booking.views_checkout.stripe.checkout.Session.create")
    def test_twin_contribution_included_when_partner_pays(
        self, mock_create, partner_client, accepted_contribution, twin_contribution
    ):
        mock_create.return_value = _mock_session()
        res = partner_client.post(
            CHECKOUT_URL,
            {"contribution_ids": [accepted_contribution.id, twin_contribution.id]},
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        call_kwargs = mock_create.call_args[1]
        assert len(call_kwargs["line_items"]) == 2


# ── stripe_webhook ────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestStripeWebhook:

    @patch("booking.views_checkout.stripe.Webhook.construct_event")
    def test_completed_event_marks_contributions_payed(
        self, mock_construct, client, accepted_contribution
    ):
        mock_construct.return_value = _mock_event([accepted_contribution.id])

        res = client.post(
            WEBHOOK_URL,
            data=json.dumps({}),
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
        )

        assert res.status_code == http_status.HTTP_200_OK
        accepted_contribution.refresh_from_db()
        assert accepted_contribution.status == ContributionStatus.PAYED

    @patch("booking.views_checkout.stripe.Webhook.construct_event")
    def test_non_completed_event_does_not_update_status(
        self, mock_construct, client, accepted_contribution
    ):
        mock_construct.return_value = _mock_event(
            [accepted_contribution.id], event_type="payment_intent.created"
        )

        client.post(
            WEBHOOK_URL,
            data=json.dumps({}),
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
        )

        accepted_contribution.refresh_from_db()
        assert accepted_contribution.status == ContributionStatus.ACCEPTED

    @patch("booking.views_checkout.stripe.Webhook.construct_event")
    def test_invalid_signature_returns_400(self, mock_construct, client):
        import stripe
        mock_construct.side_effect = stripe.error.SignatureVerificationError("bad", "sig")

        res = client.post(
            WEBHOOK_URL,
            data=json.dumps({}),
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="bad",
        )

        assert res.status_code == 400

    @patch("booking.views_checkout.stripe.Webhook.construct_event")
    def test_missing_contribution_ids_in_metadata_does_not_crash(
        self, mock_construct, client
    ):
        metadata = MagicMock()
        metadata.__contains__ = lambda self, k: False  # no contribution_ids key
        session_obj = MagicMock()
        session_obj.metadata = metadata

        event = MagicMock()
        event.__getitem__ = lambda self, k: {
            "type": "checkout.session.completed",
            "data": {"object": session_obj},
        }[k]
        mock_construct.return_value = event

        res = client.post(
            WEBHOOK_URL,
            data=json.dumps({}),
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
        )
        assert res.status_code == http_status.HTTP_200_OK


# ── payment_success ───────────────────────────────────────────────────────────

@pytest.mark.integration
class TestPaymentSuccess:

    def test_missing_session_id_returns_400(self, student_client):
        res = student_client.get(SUCCESS_URL)
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    @patch("booking.views_checkout.stripe.checkout.Session.retrieve")
    def test_paid_session_returns_true(self, mock_retrieve, student_client):
        mock_session = MagicMock()
        mock_session.payment_status = "paid"
        mock_session.customer_email = "student@bounce.com"
        mock_retrieve.return_value = mock_session

        res = student_client.get(SUCCESS_URL, {"session_id": "cs_test_123"})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["paid"] is True
        assert res.data["customer_email"] == "student@bounce.com"

    @patch("booking.views_checkout.stripe.checkout.Session.retrieve")
    def test_unpaid_session_returns_false(self, mock_retrieve, student_client):
        mock_session = MagicMock()
        mock_session.payment_status = "unpaid"
        mock_retrieve.return_value = mock_session

        res = student_client.get(SUCCESS_URL, {"session_id": "cs_test_456"})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["paid"] is False

    def test_unauthenticated_returns_401(self, client):
        res = client.get(SUCCESS_URL, {"session_id": "cs_test_123"})
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED
