"""
Tests for PATCH /api/scanner/bookings/<booking_id>/attendance/ — staff
directly flips a row's attended flag from the Register view (as opposed
to check-in, which only ever sets it True via a QR scan).

Assumptions baked into these tests (flag if wrong before implementing):
  - `attended` is explicit (true/false) in the body, not a toggle, so a
    duplicate/retried request is a no-op rather than flipping twice.
  - The endpoint is staff/admin only, same as check-in and the register
    list.
  - An unknown booking_id is a 404. A missing or non-boolean `attended`
    is a 400.
"""
import pytest
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event
from membership.models import Membership
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


def attendance_url(booking_id):
    return f"/api/scanner/bookings/{booking_id}/attendance/"


# ── Authentication / permissions ──────────────────────────────────────────────

class TestUpdateAttendanceAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = client.patch(attendance_url(booking.id), {"attended": True}, format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = student_client.patch(attendance_url(booking.id), {"attended": True}, format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = staff_client.patch(attendance_url(booking.id), {"attended": True}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = admin_client.patch(attendance_url(booking.id), {"attended": True}, format="json")
        assert response.status_code == http_status.HTTP_200_OK


# ── Invalid input ──────────────────────────────────────────────────────────────

class TestUpdateAttendanceInvalidInput:

    def test_missing_attended_returns_400(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = staff_client.patch(attendance_url(booking.id), {}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_non_boolean_attended_returns_400(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event))
        response = staff_client.patch(attendance_url(booking.id), {"attended": "yes"}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_unknown_booking_id_returns_404(self, staff_client, world_data):
        response = staff_client.patch(attendance_url(999999), {"attended": True}, format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestUpdateAttendanceSuccess:

    def test_sets_attended_true(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event), attended=False)

        response = staff_client.patch(attendance_url(booking.id), {"attended": True}, format="json")

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True
        assert response.data["attended"] is True

    def test_sets_attended_false(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event), attended=True)

        response = staff_client.patch(attendance_url(booking.id), {"attended": False}, format="json")

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is False
        assert response.data["attended"] is False

    def test_repeating_the_same_value_is_a_no_op(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, make_contribution(student_user, event), attended=True)

        response = staff_client.patch(attendance_url(booking.id), {"attended": True}, format="json")

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True
