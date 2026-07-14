"""
Tests for register consolidation.

consolidate_register(event, rows) inserts the attendee grid into Booking:
one row per member with a user id, carrying the member's partner role, the
email of the row mate and the row's ``couple`` flag. Members without an
account (id null) are dropped and their mate is treated as single (no
partner_email). Real couples (twin contributions) cannot be split across
rows. The function is idempotent — re-running updates
role/partner_email/couple but never touches ``attended``.

Exposed via POST /api/events/register/<event_id>/ (admin only) and run
automatically by the consolidate_upcoming_parent_events beat task for
parent events starting within the next settings.CONSOLIDATE_TIME_HR
hours. Both write the parent's data replicated onto all its children.
"""
import pytest
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from booking.register import (
    CoupleSplitError,
    PayedMemberRemovalError,
    build_register,
    consolidate_register,
)
from booking.tasks import consolidate_upcoming_parent_events
from event.models import Event, PartnerRole, Status
from users.models import User
from utils.mock_event import make_event_payload

pytestmark = pytest.mark.django_db


def register_url(event_id):
    return f"/api/events/register/{event_id}/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event_with_roles(role_names=("Leader", "Follower"), **overrides):
    """Create a published Event whose event type has the given partner roles."""
    payload = make_event_payload(status=Status.PUBLISHED)
    payload.update(overrides)
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


def member(user, status=ContributionStatus.PAYED):
    """Build the member cell of a register row for a real user."""
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": status,
    }


def email_only(email):
    return {"id": None, "email": email, "first_name": None,
            "last_name": None, "status": None}


def row(leader=None, follower=None, couple=False):
    return {"couple": couple, "members": {"Leader": leader, "Follower": follower}}


def pay(user, event, role, status=ContributionStatus.PAYED,
        partner=None, partner_email=None, original=None, minutes=0):
    contribution = Contribution.objects.create(
        amount=10,
        user=user,
        status=status,
        role=role,
        partner=partner,
        partner_email=partner_email,
        original_contribution=original,
        date=timezone.now() + timedelta(minutes=minutes),
    )
    contribution.events.set([event])
    return contribution


@pytest.fixture
def event_and_roles(world_data):
    return make_event_with_roles()


# ── Service: consolidate_register ─────────────────────────────────────────────

class TestConsolidateRegister:
    def test_creates_one_booking_per_member(self, event_and_roles):
        event, (leader_role, follower_role) = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")

        created, updated = consolidate_register(event, [row(member(anna), member(bruno))])

        assert (created, updated) == (2, 0)
        anna_booking = Booking.objects.get(user=anna, event=event)
        assert anna_booking.role == leader_role
        assert anna_booking.partner_email == bruno.email
        assert anna_booking.attended is False
        bruno_booking = Booking.objects.get(user=bruno, event=event)
        assert bruno_booking.role == follower_role
        assert bruno_booking.partner_email == anna.email

    def test_couple_flag_is_stored_on_both_bookings(self, event_and_roles):
        event, _ = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        carla, dario = make_user("carla@test.com"), make_user("dario@test.com")

        consolidate_register(event, [
            row(member(anna), member(bruno), couple=True),
            row(member(dario), member(carla), couple=False),
        ])

        assert Booking.objects.filter(event=event).count() == 4
        assert Booking.objects.get(user=anna, event=event).couple is True
        assert Booking.objects.get(user=bruno, event=event).couple is True
        assert Booking.objects.get(user=carla, event=event).couple is False
        assert Booking.objects.get(user=dario, event=event).couple is False

    def test_user_without_contribution_can_be_booked(self, event_and_roles):
        """An admin can place any registered user in the grid, even one who
        never purchased the event."""
        event, (leader_role, _) = event_and_roles
        outsider = make_user("outsider@test.com")
        assert not Contribution.objects.filter(user=outsider).exists()

        consolidate_register(event, [row(member(outsider), None)])

        assert Booking.objects.filter(user=outsider, event=event).exists()

    def test_removed_users_lose_their_bookings(self, event_and_roles, world_data):
        event, _ = event_and_roles
        child, _ = make_event_with_roles()
        event.events.set([child])
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        consolidate_register(event, [row(member(anna), member(bruno))])

        consolidate_register(
            event, [row(member(anna), None)], removed_user_ids=[bruno.id],
        )

        assert not Booking.objects.filter(user=bruno).exists()
        assert Booking.objects.filter(user=anna, event=event).exists()
        assert Booking.objects.filter(user=anna, event=child).exists()

    def test_removing_a_payed_user_is_rejected(self, event_and_roles):
        event, (leader_role, _) = event_and_roles
        anna = make_user("anna@test.com")
        pay(anna, event, leader_role)
        consolidate_register(event, [row(member(anna), None)])

        with pytest.raises(PayedMemberRemovalError):
            consolidate_register(event, [], removed_user_ids=[anna.id])

        assert Booking.objects.filter(user=anna, event=event).exists()

    def test_removed_user_still_in_rows_is_kept(self, event_and_roles):
        """The rows are the truth: a user present in the grid is never
        deleted, whatever the removed list says."""
        event, _ = event_and_roles
        anna = make_user("anna@test.com")
        consolidate_register(event, [row(member(anna), None)])

        consolidate_register(
            event, [row(member(anna), None)], removed_user_ids=[anna.id],
        )

        assert Booking.objects.filter(user=anna, event=event).exists()

    def test_splitting_a_real_couple_is_rejected(self, event_and_roles):
        """Users who booked together as a couple (twin contributions) must
        stay in the same row."""
        event, (leader_role, follower_role) = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        carla, dario = make_user("carla@test.com"), make_user("dario@test.com")
        original = pay(anna, event, leader_role, partner=bruno)
        pay(bruno, event, follower_role, partner=anna, original=original)

        with pytest.raises(CoupleSplitError):
            consolidate_register(event, [
                row(member(anna), member(carla)),
                row(member(dario), member(bruno)),
            ])

        assert not Booking.objects.exists()

    def test_member_status_does_not_matter(self, event_and_roles):
        """Accepted (unpaid) partners in the grid are booked too."""
        event, _ = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")

        consolidate_register(
            event,
            [row(member(anna), member(bruno, status=ContributionStatus.ACCEPTED), couple=True)],
        )

        assert Booking.objects.filter(event=event).count() == 2

    def test_email_only_member_is_dropped_and_mate_treated_as_single(self, event_and_roles):
        """An unregistered partner (email only, no account) cannot be booked:
        it is dropped and the registered member becomes a single."""
        event, _ = event_and_roles
        anna = make_user("anna@test.com")

        created, _ = consolidate_register(
            event, [row(member(anna), email_only("ghost@test.com"), couple=True)]
        )

        assert created == 1
        booking = Booking.objects.get(event=event)
        assert booking.user == anna
        assert booking.partner_email is None

    def test_leftover_single_has_no_partner_email(self, event_and_roles):
        event, _ = event_and_roles
        anna = make_user("anna@test.com")

        consolidate_register(event, [row(member(anna), None)])

        booking = Booking.objects.get(event=event)
        assert booking.partner_email is None

    def test_unknown_role_column_gives_null_role(self, event_and_roles):
        event, _ = event_and_roles
        anna = make_user("anna@test.com")

        consolidate_register(
            event, [{"couple": False, "members": {"unknown": member(anna)}}]
        )

        assert Booking.objects.get(event=event).role is None

    def test_is_idempotent_and_updates_without_touching_attended(self, event_and_roles):
        event, (leader_role, follower_role) = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")

        consolidate_register(event, [row(member(anna), member(bruno))])
        Booking.objects.filter(user=anna, event=event).update(attended=True)

        # Re-run with the roles swapped: no duplicates, fields updated.
        created, updated = consolidate_register(event, [row(member(bruno), member(anna))])

        assert (created, updated) == (0, 2)
        anna_booking = Booking.objects.get(user=anna, event=event)
        assert anna_booking.role == follower_role
        assert anna_booking.attended is True

    def test_applies_to_all_children_events(self, event_and_roles, world_data):
        event, _ = event_and_roles
        children = [make_event_with_roles()[0] for _ in range(2)]
        event.events.set(children)
        anna = make_user("anna@test.com")

        created, _ = consolidate_register(event, [row(member(anna), None)])

        assert created == 3
        for target in [event, *children]:
            assert Booking.objects.filter(user=anna, event=target).exists()


# ── Grid source: bookings win over contributions ──────────────────────────────

class TestRegisterFromBookings:
    def test_flags_parent_and_not_consolidated(self, event_and_roles):
        event, _ = event_and_roles
        grid = build_register(event)
        assert grid["parent"] is True
        assert grid["consolidated"] is False

    def test_child_event_is_not_parent(self, event_and_roles, world_data):
        parent, _ = event_and_roles
        child, _ = make_event_with_roles()
        parent.events.set([child])
        assert build_register(child)["parent"] is False
        assert build_register(parent)["parent"] is True

    def test_booking_grid_keeps_singles_alone(self, event_and_roles):
        event, _ = event_and_roles
        anna = make_user("anna@test.com")
        consolidate_register(event, [row(member(anna), None)])

        grid = build_register(event)

        assert len(grid["rows"]) == 1
        assert grid["rows"][0]["members"]["Leader"]["email"] == anna.email
        assert grid["rows"][0]["members"]["Follower"] is None

    def test_booking_cells_expose_payed_status(self, event_and_roles):
        """Cells rebuilt from bookings carry status 'payed' when the user
        has a payed contribution for the event — the frontend uses it to
        forbid deleting those members."""
        event, (leader_role, _) = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        pay(anna, event, leader_role)
        consolidate_register(event, [row(member(anna), member(bruno))])

        members = build_register(event)["rows"][0]["members"]

        assert members["Leader"]["status"] == ContributionStatus.PAYED
        assert members["Follower"]["status"] is None

    def test_empty_grid_when_no_bookings(self, event_and_roles):
        """The register is a view over the Booking model only — the old
        contribution-computed grid is gone (bookings are created on
        payment, so a register without bookings is genuinely empty)."""
        event, _ = event_and_roles

        grid = build_register(event)

        assert grid["consolidated"] is False
        assert grid["rows"] == []
        assert grid["roles"] == ["Leader", "Follower"]


    def test_email_only_partner_shown_as_unregistered(self, event_and_roles):
        event, (leader_role, _) = event_and_roles
        anna = make_user("anna@test.com")
        Booking.objects.create(user=anna, event=event, role=leader_role,
                               partner_email="ghost@test.com", couple=True)

        grid = build_register(event)

        follower = grid["rows"][0]["members"]["Follower"]
        assert follower["id"] is None
        assert follower["email"] == "ghost@test.com"


# ── API: POST /api/events/register/<event_id>/ ────────────────────────────────

class TestConsolidateRegisterApi:
    def test_requires_authentication(self, client, event_and_roles):
        event, _ = event_and_roles
        response = client.post(register_url(event.pk), [], format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_forbidden_for_non_staff(self, student_client, event_and_roles):
        event, _ = event_and_roles
        response = student_client.post(register_url(event.pk), [], format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_unknown_event_returns_404(self, admin_client, db):
        response = admin_client.post(register_url(99999), [], format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_consolidates_payload(self, admin_client, event_and_roles):
        event, _ = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")

        response = admin_client.post(
            register_url(event.pk),
            [row(member(anna), member(bruno), couple=True)],
            format="json",
        )

        assert response.status_code == http_status.HTTP_200_OK
        assert response.json() == {"event_id": event.pk, "created": 2, "updated": 0}
        assert Booking.objects.filter(event=event).count() == 2

    def test_accepts_rows_wrapper(self, admin_client, event_and_roles):
        """The GET response shape {event_id, roles, rows} can be posted back as is."""
        event, _ = event_and_roles
        anna = make_user("anna@test.com")

        response = admin_client.post(
            register_url(event.pk),
            {"rows": [row(member(anna), None)]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_200_OK
        assert Booking.objects.filter(event=event).count() == 1

    def test_rejects_bodies_without_rows(self, admin_client, event_and_roles):
        event, _ = event_and_roles
        response = admin_client.post(register_url(event.pk), {"rows": "no"}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_removes_users_listed_in_removed_user_ids(self, admin_client, event_and_roles):
        event, _ = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        consolidate_register(event, [row(member(anna), member(bruno))])

        response = admin_client.post(
            register_url(event.pk),
            {"rows": [row(member(anna), None)], "removed_user_ids": [bruno.id]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_200_OK
        assert not Booking.objects.filter(user=bruno).exists()

    def test_rejects_removing_a_payed_user(self, admin_client, event_and_roles):
        event, (leader_role, _) = event_and_roles
        anna = make_user("anna@test.com")
        pay(anna, event, leader_role)
        consolidate_register(event, [row(member(anna), None)])

        response = admin_client.post(
            register_url(event.pk),
            {"rows": [], "removed_user_ids": [anna.id]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Booking.objects.filter(user=anna, event=event).exists()

    def test_rejects_payload_splitting_a_couple(self, admin_client, event_and_roles):
        event, (leader_role, follower_role) = event_and_roles
        anna, bruno = make_user("anna@test.com"), make_user("bruno@test.com")
        original = pay(anna, event, leader_role, partner=bruno)
        pay(bruno, event, follower_role, partner=anna, original=original)

        response = admin_client.post(
            register_url(event.pk),
            [row(member(anna), None), row(None, member(bruno))],
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert not Booking.objects.exists()


# ── Beat task: consolidate_upcoming_parent_events ─────────────────────────────

# The consolidation window is settings.CONSOLIDATE_TIME_HR hours before the
# event start. Offsets are derived from it so the tests keep passing if the
# setting changes.
WINDOW = timedelta(hours=settings.CONSOLIDATE_TIME_HR)
INSIDE_WINDOW = WINDOW / 2
OUTSIDE_WINDOW = WINDOW * 3


class TestConsolidateUpcomingParentEvents:
    def make_event_starting_in(self, delta, roles=("Leader", "Follower")):
        start = timezone.now() + delta
        return make_event_with_roles(
            roles, start_date=start, end_date=start + timedelta(hours=1)
        )

    @patch("booking.tasks.consolidate_event_register.delay")
    def test_scans_only_parent_events_inside_the_window(self, mock_delay, world_data):
        inside, _ = self.make_event_starting_in(INSIDE_WINDOW)
        self.make_event_starting_in(OUTSIDE_WINDOW)
        self.make_event_starting_in(-timedelta(minutes=10))
        # A child inside the window is never scanned on its own.
        outside_parent, _ = self.make_event_starting_in(OUTSIDE_WINDOW)
        inside_child, _ = self.make_event_starting_in(INSIDE_WINDOW)
        outside_parent.events.set([inside_child])

        consolidate_upcoming_parent_events()

        scheduled = {call.args[0] for call in mock_delay.call_args_list}
        assert scheduled == {inside.id}