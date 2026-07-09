"""
When a contribution becomes PAYED the payer is automatically added to the
Booking model for the contribution's events and all their children.

Existing bookings are never overwritten (an admin may have re-arranged the
register), and the Stripe webhook path must go through Contribution.save()
so the transition hook fires.
"""
import json
import pytest
from unittest.mock import MagicMock, patch

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, PartnerRole, Status
from users.models import User
from utils.mock_event import make_event_payload

pytestmark = pytest.mark.django_db

WEBHOOK_URL = "/api/booking/stripe-webhook/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event_with_roles(role_names=("Leader", "Follower")):
    payload = make_event_payload(status=Status.PUBLISHED)
    event = Event.objects.create(
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
    roles = [PartnerRole.objects.get_or_create(name=name)[0] for name in role_names]
    event.event_type.partner_roles.set(roles)
    return event, roles


def make_user(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        first_name=local.capitalize(),
        last_name="Test",
        is_active=True,
    )


def accepted_contribution(user, event, role=None, partner=None,
                          partner_email=None, original=None):
    contribution = Contribution.objects.create(
        amount=10,
        user=user,
        status=ContributionStatus.ACCEPTED,
        role=role,
        partner=partner,
        partner_email=partner_email,
        original_contribution=original,
    )
    contribution.events.set([event])
    return contribution


@pytest.fixture
def parent_with_children(world_data):
    parent, roles = make_event_with_roles()
    children = [make_event_with_roles()[0] for _ in range(2)]
    parent.events.set(children)
    return parent, children, roles


# ── Contribution.save() transition hook ───────────────────────────────────────

class TestBookingOnPayment:
    def test_paying_creates_bookings_for_parent_and_children(self, parent_with_children):
        parent, children, (leader_role, _) = parent_with_children
        anna = make_user("anna@test.com")
        contribution = accepted_contribution(anna, parent, role=leader_role)

        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=["status"])

        for target in [parent, *children]:
            booking = Booking.objects.get(user=anna, event=target)
            assert booking.role == leader_role
            assert booking.couple is False
            assert booking.partner_email is None

    def test_couple_payment_sets_couple_and_partner_email(self, parent_with_children):
        parent, children, (leader_role, follower_role) = parent_with_children
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        original = accepted_contribution(anna, parent, role=leader_role, partner=bruno)
        accepted_contribution(
            bruno, parent, role=follower_role, partner=anna, original=original,
        )

        original.status = ContributionStatus.PAYED
        original.save(update_fields=["status"])

        booking = Booking.objects.get(user=anna, event=parent)
        assert booking.couple is True
        assert booking.partner_email == bruno.email
        # Only the payer gets bookings.
        assert not Booking.objects.filter(user=bruno).exists()

    def test_existing_booking_is_not_overwritten(self, parent_with_children):
        parent, children, (leader_role, follower_role) = parent_with_children
        anna = make_user("anna@test.com")
        contribution = accepted_contribution(anna, parent, role=leader_role)
        Booking.objects.create(user=anna, event=parent, role=follower_role)

        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=["status"])

        assert Booking.objects.filter(user=anna, event=parent).count() == 1
        assert Booking.objects.get(user=anna, event=parent).role == follower_role
        # Children bookings are still created.
        for child in children:
            assert Booking.objects.filter(user=anna, event=child).exists()

    def test_other_transitions_create_no_bookings(self, parent_with_children):
        parent, _, (leader_role, _) = parent_with_children
        anna = make_user("anna@test.com")
        contribution = accepted_contribution(anna, parent, role=leader_role)

        contribution.status = ContributionStatus.CANCELLED
        contribution.save(update_fields=["status"])

        assert not Booking.objects.exists()

    def test_repaying_does_not_duplicate_bookings(self, parent_with_children):
        parent, children, (leader_role, _) = parent_with_children
        anna = make_user("anna@test.com")
        contribution = accepted_contribution(anna, parent, role=leader_role)

        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=["status"])
        contribution.status = ContributionStatus.ACCEPTED
        contribution.save(update_fields=["status"])
        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=["status"])

        assert Booking.objects.filter(user=anna).count() == 1 + len(children)


class TestAutoPartnerOnPayment:
    """A single payer is automatically partnered with the first
    unpartnered booking of another role, mutually and persistently."""

    def _pay(self, contribution):
        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=["status"])

    def test_payer_pairs_with_unpartnered_other_role(self, parent_with_children):
        parent, children, (leader_role, follower_role) = parent_with_children
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")

        self._pay(accepted_contribution(anna, parent, role=leader_role))
        assert Booking.objects.get(user=anna, event=parent).partner_email is None

        self._pay(accepted_contribution(bruno, parent, role=follower_role))

        for target in [parent, *children]:
            assert Booking.objects.get(user=bruno, event=target).partner_email == anna.email
            assert Booking.objects.get(user=anna, event=target).partner_email == bruno.email

    def test_pairs_with_the_first_unpartnered(self, parent_with_children):
        parent, _, (leader_role, follower_role) = parent_with_children
        anna, carla = make_user("anna@test.com"), make_user("carla@test.com")
        bruno = make_user("bruno@test.com")

        self._pay(accepted_contribution(anna, parent, role=leader_role))
        self._pay(accepted_contribution(carla, parent, role=leader_role))
        self._pay(accepted_contribution(bruno, parent, role=follower_role))

        assert Booking.objects.get(user=bruno, event=parent).partner_email == anna.email
        assert Booking.objects.get(user=anna, event=parent).partner_email == bruno.email
        assert Booking.objects.get(user=carla, event=parent).partner_email is None

    def test_same_role_never_pairs(self, parent_with_children):
        parent, _, (leader_role, _) = parent_with_children
        anna, carla = make_user("anna@test.com"), make_user("carla@test.com")

        self._pay(accepted_contribution(anna, parent, role=leader_role))
        self._pay(accepted_contribution(carla, parent, role=leader_role))

        assert Booking.objects.get(user=anna, event=parent).partner_email is None
        assert Booking.objects.get(user=carla, event=parent).partner_email is None

    def test_couple_payer_keeps_their_partner(self, parent_with_children):
        """A payer who booked as a couple never auto-pairs with a single."""
        parent, _, (leader_role, follower_role) = parent_with_children
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        dario = make_user("dario@test.com")

        self._pay(accepted_contribution(dario, parent, role=follower_role))
        original = accepted_contribution(anna, parent, role=leader_role, partner=bruno)
        accepted_contribution(bruno, parent, role=follower_role, partner=anna,
                              original=original)
        self._pay(original)

        assert Booking.objects.get(user=anna, event=parent).partner_email == bruno.email
        assert Booking.objects.get(user=dario, event=parent).partner_email is None

    def test_paired_singles_share_a_row_in_the_register(self, parent_with_children):
        from booking.register import build_register

        parent, _, (leader_role, follower_role) = parent_with_children
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        self._pay(accepted_contribution(anna, parent, role=leader_role))
        self._pay(accepted_contribution(bruno, parent, role=follower_role))

        grid = build_register(parent)

        assert len(grid["rows"]) == 1
        assert grid["rows"][0]["members"]["Leader"]["email"] == anna.email
        assert grid["rows"][0]["members"]["Follower"]["email"] == bruno.email
        assert grid["rows"][0]["couple"] is False


# ── Stripe webhook path ───────────────────────────────────────────────────────

def _mock_event(contribution_ids, event_type="checkout.session.completed"):
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


@pytest.mark.integration
class TestWebhookCreatesBookings:
    @patch("booking.views_checkout.stripe.Webhook.construct_event")
    def test_webhook_payment_creates_bookings(
        self, mock_construct, client, parent_with_children
    ):
        parent, children, (leader_role, _) = parent_with_children
        anna = make_user("anna@test.com")
        contribution = accepted_contribution(anna, parent, role=leader_role)
        mock_construct.return_value = _mock_event([contribution.id])

        response = client.post(
            WEBHOOK_URL,
            data=json.dumps({}),
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
        )

        assert response.status_code == 200
        contribution.refresh_from_db()
        assert contribution.status == ContributionStatus.PAYED
        for target in [parent, *children]:
            assert Booking.objects.filter(user=anna, event=target).exists()
