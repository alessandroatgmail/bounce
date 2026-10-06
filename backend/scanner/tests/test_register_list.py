"""
Tests for GET /api/scanner/register/<event_id>/ — staff picks a class on
the scanner screen and switches to the "Register" view: one row per
Booking for that event, with the booker's name, their contribution's
status, and whether they've been marked attended. No partner info (that
belongs to the full admin register at booking.register.build_register,
not this staff check-in screen).

Assumptions baked into these tests (flag if wrong before implementing):
  - Every Booking for the event is returned regardless of contribution
    status (including None/no contribution) — staff see the status
    rather than it being filtered out, since that's the point of
    showing it.
  - The endpoint is staff/admin only, same as check-in.
  - An unknown event_id is a 404.
"""
import pytest
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload

pytestmark = pytest.mark.django_db


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_event(**overrides):
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


def make_membership(**overrides):
    defaults = {"name": "Plan", "contribution": 50, "max_events": 0, "duration": 0}
    defaults.update(overrides)
    return Membership.objects.create(**defaults)


def make_contribution(user, event, status=ContributionStatus.PAYED, membership=None):
    contribution = Contribution.objects.create(
        user=user,
        membership=membership or make_membership(),
        amount=50,
        status=status,
    )
    contribution.events.add(event)
    return contribution


def make_booking(user, event, contribution=None, attended=False):
    return Booking.objects.create(user=user, event=event, contribution=contribution, attended=attended)


def register_list_url(event_id):
    return f"/api/scanner/register/{event_id}/"


# ── Authentication / permissions ──────────────────────────────────────────────

class TestRegisterListAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data):
        event = make_event()
        response = client.get(register_list_url(event.id))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data):
        event = make_event()
        response = student_client.get(register_list_url(event.id))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(register_list_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data):
        event = make_event()
        response = admin_client.get(register_list_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK


# ── Unknown event ──────────────────────────────────────────────────────────────

class TestRegisterListUnknownEvent:

    def test_unknown_event_id_returns_404(self, staff_client, world_data):
        response = staff_client.get(register_list_url(999999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestRegisterListSuccess:

    def test_empty_event_returns_empty_rows(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(register_list_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data["rows"] == []

    def test_includes_name_status_and_attended(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.PAYED)
        make_booking(student_user, event, contribution, attended=False)

        response = staff_client.get(register_list_url(event.id))

        assert response.status_code == http_status.HTTP_200_OK
        rows = response.data["rows"]
        assert len(rows) == 1
        row = rows[0]
        assert row["first_name"] == student_user.first_name
        assert row["last_name"] == student_user.last_name
        assert row["status"] == ContributionStatus.PAYED
        assert row["attended"] is False

    def test_attended_true_is_reflected(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.PAYED)
        make_booking(student_user, event, contribution, attended=True)

        response = staff_client.get(register_list_url(event.id))

        assert response.data["rows"][0]["attended"] is True

    def test_booking_without_contribution_has_null_status(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, contribution=None)

        response = staff_client.get(register_list_url(event.id))

        assert response.data["rows"][0]["status"] is None

    def test_non_payed_statuses_are_still_included(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.WAITING)
        make_booking(student_user, event, contribution)

        response = staff_client.get(register_list_url(event.id))

        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["status"] == ContributionStatus.WAITING

    def test_multiple_bookings_all_returned(self, staff_client, world_data, student_user):
        event = make_event()
        second_student = User.objects.create_user(
            email="second@bounce.com", password="StrongPass123!", role="student", is_active=True,
        )
        make_booking(student_user, event, make_contribution(student_user, event))
        make_booking(second_student, event, make_contribution(second_student, event))

        response = staff_client.get(register_list_url(event.id))

        emails_in_response = {(row["first_name"], row["last_name"]) for row in response.data["rows"]}
        assert (student_user.first_name, student_user.last_name) in emails_in_response
        assert (second_student.first_name, second_student.last_name) in emails_in_response
        assert len(response.data["rows"]) == 2

    def test_only_bookings_for_the_requested_event_are_returned(self, staff_client, world_data, student_user):
        event = make_event()
        other_event = make_event()
        make_booking(student_user, other_event, make_contribution(student_user, other_event))

        response = staff_client.get(register_list_url(event.id))

        assert response.data["rows"] == []

    def test_no_partner_fields_in_rows(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, make_contribution(student_user, event))

        response = staff_client.get(register_list_url(event.id))

        row = response.data["rows"][0]
        assert "partner_email" not in row
        assert "partner" not in row
        assert "couple" not in row
