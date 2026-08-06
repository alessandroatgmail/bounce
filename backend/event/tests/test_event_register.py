"""
Tests for GET /api/events/register/<event_id>/ — the attendee grid
endpoint.

The register is a view over the Booking model: bookings are created when
a contribution becomes payed (or by consolidation), so an event without
bookings has an empty register. The grid semantics — pairing, unpaid
partners, couple flags, consolidation — are covered in
booking/tests/test_consolidate_register.py; here we only check the
endpoint itself: permissions and the response shape.
"""
import pytest
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, PartnerRole, Status
from users.models import User
from utils.mock_event import make_event_payload

pytestmark = pytest.mark.django_db


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

    def test_no_bookings_gives_empty_unconsolidated_grid(self, staff_client, world_data):
        event, _ = make_event_with_roles()
        data = staff_client.get(register_url(event.pk)).json()
        assert data["rows"] == []
        assert data["consolidated"] is False
        assert data["parent"] is True
        assert data["can_consolidate"] is True

    def test_booked_member_cell_contains_user_fields(self, staff_client, world_data):
        event, (leader_role, _) = make_event_with_roles()
        anna = make_user("anna@bounce.com")
        Booking.objects.create(user=anna, event=event, role=leader_role)

        data = staff_client.get(register_url(event.pk)).json()
        assert data["consolidated"] is True
        cell = data["rows"][0]["members"]["Leader"]
        assert cell["id"] == anna.id
        assert cell["email"] == anna.email
        assert cell["first_name"] == "Anna"
        assert cell["attended"] is False

    def test_child_event_is_not_parent(self, staff_client, world_data):
        parent, _ = make_event_with_roles()
        child, _ = make_event_with_roles()
        parent.events.set([child])

        data = staff_client.get(register_url(child.pk)).json()

        assert data["parent"] is False
        assert data["can_consolidate"] is False

    def test_multi_event_child_is_parent_but_cannot_consolidate(self, staff_client, world_data):
        """A multi_events festival's own child event (a level class or a
        fix_events social) is directly editable — same as a regular
        parent — but it's a leaf: there's nothing beneath it to push
        bookings onto, so it can never consolidate."""
        festival, _ = make_event_with_roles()
        festival.multi_events = True
        festival.save()
        level_class, _ = make_event_with_roles()
        festival.events.set([level_class])

        data = staff_client.get(register_url(level_class.pk)).json()

        assert data["parent"] is True
        assert data["can_consolidate"] is False

    def test_roleless_event_lists_students_by_contribution_status(self, staff_client, world_data):
        """A fix_events "social" (partners=0, no roles configured on its
        event type) skips role pairing entirely — the grid just lists
        whoever is registered, one row per booking, driven by their
        contribution status rather than a Leader/Follower column.

        Seeded via Booking (not Contribution.events): a festival's
        fix_events children get a Booking at registration time without
        ever being added to the contribution's own `events` M2M (see
        booking.utils.book_events_for_contribution), so the register must
        read from Booking to see them — this is what the real flow
        produces, exercised end-to-end in
        booking/tests/test_bounce_blues_festival.py."""
        event, _ = make_event_with_roles(())
        anna = make_user("anna@bounce.com")
        contribution = Contribution.objects.create(
            user=anna, status=ContributionStatus.ACCEPTED, amount=0,
        )
        Booking.objects.create(user=anna, event=event, contribution=contribution)

        data = staff_client.get(register_url(event.pk)).json()

        assert data["roles"] == ["Member"]
        cell = data["rows"][0]["members"]["Member"]
        assert cell["email"] == anna.email
        assert cell["status"] == ContributionStatus.ACCEPTED

    def test_roleless_event_without_contributions_has_empty_register(self, staff_client, world_data):
        event, _ = make_event_with_roles(())

        data = staff_client.get(register_url(event.pk)).json()

        assert data["roles"] == []
        assert data["rows"] == []
