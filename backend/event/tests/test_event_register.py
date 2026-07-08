"""
Tests for GET /api/events/register/<event_id>/ — the attendee grid endpoint.

Returns every user with a payed contribution for the event, arranged in
rows by partner role:
  - couples (contributions linked via original_contribution) share a row
    with couple=True; a partner who has not payed is shown only if their
    contribution is accepted or waiting — each member cell carries its
    contribution status so the frontend can highlight unpaid partners.
    With any other partner status the payed member is treated as single;
  - remaining singles are auto-paired across roles in booking-date order;
  - a leftover single gets a row with null in the other role column.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Contribution, ContributionStatus
from event.models import Event, PartnerRole, Status
from users.models import User
from utils.mock_event import make_event_payload


def register_url(event_id):
    return f"/api/events/register/{event_id}/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event_with_roles(role_names=("Leader", "Follower")):
    """Create a published Event whose event type has the given partner roles."""
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


def pay(user, event, role, status=ContributionStatus.PAYED,
        partner=None, original=None, minutes=0):
    """Create a contribution for `user` on `event` at now + `minutes`."""
    contribution = Contribution.objects.create(
        amount=10,
        user=user,
        status=status,
        role=role,
        partner=partner,
        original_contribution=original,
        date=timezone.now() + timedelta(minutes=minutes),
    )
    contribution.events.set([event])
    return contribution


def pay_couple(user, partner, event, user_role, partner_role, minutes=0):
    """Create the two linked contributions of a couple booking."""
    original = pay(user, event, user_role, partner=partner, minutes=minutes)
    twin = pay(partner, event, partner_role, partner=user,
               original=original, minutes=minutes)
    return original, twin


def row_emails(row, roles):
    """Return the member emails of a row as a tuple following column order."""
    return tuple(
        member["email"] if (member := row["members"][role]) else None
        for role in roles
    )


# ── Authentication / permissions ──────────────────────────────────────────────

class TestEventRegisterAuth:

    def test_unauthenticated_returns_401(self, client, world_data):
        event, _ = make_event_with_roles()
        assert client.get(register_url(event.pk)).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data):
        event, _ = make_event_with_roles()
        assert student_client.get(register_url(event.pk)).status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_returns_200(self, staff_client, world_data):
        event, _ = make_event_with_roles()
        assert staff_client.get(register_url(event.pk)).status_code == http_status.HTTP_200_OK

    def test_unknown_event_returns_404(self, staff_client, db):
        assert staff_client.get(register_url(99999)).status_code == http_status.HTTP_404_NOT_FOUND


# ── Response shape ────────────────────────────────────────────────────────────

class TestEventRegisterShape:

    def test_roles_come_from_event_type(self, staff_client, world_data):
        event, _ = make_event_with_roles(("Leader", "Follower"))
        data = staff_client.get(register_url(event.pk)).json()
        assert data["event_id"] == event.pk
        assert data["roles"] == ["Leader", "Follower"]

    def test_no_contributions_gives_empty_rows(self, staff_client, world_data):
        event, _ = make_event_with_roles()
        data = staff_client.get(register_url(event.pk)).json()
        assert data["rows"] == []

    def test_member_cell_contains_user_fields(self, staff_client, world_data):
        event, (leader_role, _) = make_event_with_roles()
        user = make_user("alice@bounce.com")
        pay(user, event, leader_role)

        data = staff_client.get(register_url(event.pk)).json()
        cell = data["rows"][0]["members"]["Leader"]
        assert cell == {
            "id": user.pk,
            "email": "alice@bounce.com",
            "first_name": "Alice",
            "last_name": "Test",
            "status": "payed",
        }


# ── Filtering ─────────────────────────────────────────────────────────────────

class TestEventRegisterFiltering:

    def test_only_payed_contributions_are_included(self, staff_client, world_data):
        event, (leader_role, _) = make_event_with_roles()
        payed = make_user("payed@bounce.com")
        pay(payed, event, leader_role)
        for i, other_status in enumerate(s for s in ContributionStatus if s != ContributionStatus.PAYED):
            pay(make_user(f"user{i}@bounce.com"), event, leader_role, status=other_status)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 1
        assert data["rows"][0]["members"]["Leader"]["email"] == "payed@bounce.com"

    def test_contributions_for_other_events_are_excluded(self, staff_client, world_data):
        event, (leader_role, _) = make_event_with_roles()
        other_event, _ = make_event_with_roles()
        pay(make_user("other@bounce.com"), other_event, leader_role)

        data = staff_client.get(register_url(event.pk)).json()
        assert data["rows"] == []


# ── Pairing ───────────────────────────────────────────────────────────────────

class TestEventRegisterPairing:

    def test_couple_shares_a_row(self, staff_client, world_data):
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        pay_couple(alice, bob, event, leader_role, follower_role)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["couple"] is True
        assert row_emails(row, data["roles"]) == ("alice@bounce.com", "bob@bounce.com")

    def test_singles_are_auto_paired_in_booking_order(self, staff_client, world_data):
        event, (leader_role, follower_role) = make_event_with_roles()
        pay(make_user("leader1@bounce.com"), event, leader_role, minutes=0)
        pay(make_user("follower1@bounce.com"), event, follower_role, minutes=1)
        pay(make_user("leader2@bounce.com"), event, leader_role, minutes=2)
        pay(make_user("follower2@bounce.com"), event, follower_role, minutes=3)

        data = staff_client.get(register_url(event.pk)).json()
        assert [row["couple"] for row in data["rows"]] == [False, False]
        assert row_emails(data["rows"][0], data["roles"]) == ("leader1@bounce.com", "follower1@bounce.com")
        assert row_emails(data["rows"][1], data["roles"]) == ("leader2@bounce.com", "follower2@bounce.com")

    def test_leftover_single_gets_null_partner(self, staff_client, world_data):
        event, (leader_role, follower_role) = make_event_with_roles()
        pay(make_user("leader1@bounce.com"), event, leader_role, minutes=0)
        pay(make_user("leader2@bounce.com"), event, leader_role, minutes=1)
        pay(make_user("follower1@bounce.com"), event, follower_role, minutes=2)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 2
        assert row_emails(data["rows"][0], data["roles"]) == ("leader1@bounce.com", "follower1@bounce.com")
        assert row_emails(data["rows"][1], data["roles"]) == ("leader2@bounce.com", None)

    def test_couples_come_before_auto_paired_singles(self, staff_client, world_data):
        event, (leader_role, follower_role) = make_event_with_roles()
        pay(make_user("single-leader@bounce.com"), event, leader_role, minutes=0)
        pay(make_user("single-follower@bounce.com"), event, follower_role, minutes=1)
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        pay_couple(alice, bob, event, leader_role, follower_role, minutes=2)

        data = staff_client.get(register_url(event.pk)).json()
        assert [row["couple"] for row in data["rows"]] == [True, False]
        assert row_emails(data["rows"][0], data["roles"]) == ("alice@bounce.com", "bob@bounce.com")
        assert row_emails(data["rows"][1], data["roles"]) == ("single-leader@bounce.com", "single-follower@bounce.com")

    @pytest.mark.parametrize("twin_status", [
        ContributionStatus.ACCEPTED,
        ContributionStatus.WAITING,
    ])
    def test_accepted_or_waiting_twin_is_shown_with_its_status(
            self, staff_client, world_data, twin_status):
        """An accepted/waiting partner appears in the couple row, flagged by status."""
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        original = pay(alice, event, leader_role, partner=bob)
        pay(bob, event, follower_role, partner=alice, original=original,
            status=twin_status)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["couple"] is True
        assert row_emails(row, data["roles"]) == ("alice@bounce.com", "bob@bounce.com")
        assert row["members"]["Leader"]["status"] == "payed"
        assert row["members"]["Follower"]["status"] == twin_status

    @pytest.mark.parametrize("twin_status", [
        ContributionStatus.RECEIVED,
        ContributionStatus.CONFIRMED,
        ContributionStatus.CANCELLED,
    ])
    def test_other_twin_status_hides_partner(
            self, staff_client, world_data, twin_status):
        """A partner who is neither payed, accepted nor waiting is not shown."""
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        original = pay(alice, event, leader_role, partner=bob)
        pay(bob, event, follower_role, partner=alice, original=original,
            status=twin_status)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["couple"] is False
        assert row_emails(row, data["roles"]) == ("alice@bounce.com", None)

    def test_payed_member_with_hidden_partner_is_auto_paired(self, staff_client, world_data):
        """When the partner is hidden the payed member rejoins the singles pool."""
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        original = pay(alice, event, leader_role, partner=bob)
        pay(bob, event, follower_role, partner=alice, original=original,
            status=ContributionStatus.CANCELLED)
        pay(make_user("carol@bounce.com"), event, follower_role, minutes=1)

        data = staff_client.get(register_url(event.pk)).json()
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["couple"] is False
        assert row_emails(row, data["roles"]) == ("alice@bounce.com", "carol@bounce.com")

    def test_original_not_payed_is_still_shown_when_twin_is_payed(self, staff_client, world_data):
        """Linkage works in both directions: a payed twin pulls in a not-payed original."""
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        original = pay(alice, event, leader_role, partner=bob,
                       status=ContributionStatus.ACCEPTED)
        pay(bob, event, follower_role, partner=alice, original=original)

        data = staff_client.get(register_url(event.pk)).json()
        print (data)
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["couple"] is True
        assert row_emails(row, data["roles"]) == ("alice@bounce.com", "bob@bounce.com")
        assert row["members"]["Leader"]["status"] == "accepted"
        assert row["members"]["Follower"]["status"] == "payed"

    def test_couple_with_neither_payed_is_excluded(self, staff_client, world_data):
        """A couple where nobody payed does not appear at all."""
        event, (leader_role, follower_role) = make_event_with_roles()
        alice = make_user("alice@bounce.com")
        bob = make_user("bob@bounce.com")
        original = pay(alice, event, leader_role, partner=bob,
                       status=ContributionStatus.RECEIVED)
        pay(bob, event, follower_role, partner=alice, original=original,
            status=ContributionStatus.RECEIVED)

        data = staff_client.get(register_url(event.pk)).json()
        assert data["rows"] == []
