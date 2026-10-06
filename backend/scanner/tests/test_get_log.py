"""
Tests for GET /api/scanner/log/<event_id>/ — the notes box at the bottom
of the Register view: shows the requesting staff member's own Log row
for this event (their running notes/errors, e.g. for someone checked in
who wasn't on the register), so it can be prefilled before they add more.

Assumptions baked into these tests (flag if wrong before implementing):
  - Scoped to request.user — Log is keyed on (user, event), so this
    never returns another staff member's notes for the same event.
  - No Log row yet is not an error: returns 200 with an empty string,
    since "no notes yet" is the normal starting state.
  - The endpoint is staff/admin only, same as the rest of the scanner
    endpoints. An unknown event_id is a 404.
"""
import pytest
from rest_framework import status as http_status

from event.models import Event
from scanner.models import Log
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


def log_url(event_id):
    return f"/api/scanner/log/{event_id}/"


# ── Authentication / permissions ──────────────────────────────────────────────

class TestGetLogAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data):
        event = make_event()
        response = client.get(log_url(event.id))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data):
        event = make_event()
        response = student_client.get(log_url(event.id))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(log_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data):
        event = make_event()
        response = admin_client.get(log_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK


# ── Unknown event ──────────────────────────────────────────────────────────────

class TestGetLogUnknownEvent:

    def test_unknown_event_id_returns_404(self, staff_client, world_data):
        response = staff_client.get(log_url(999999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestGetLogSuccess:

    def test_no_log_row_returns_empty_string(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(log_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data["logs"] == ""

    def test_returns_existing_log_content(self, staff_client, world_data, staff_user):
        event = make_event()
        Log.objects.create(user=staff_user, event=event, logs="some note here")

        response = staff_client.get(log_url(event.id))

        assert response.data["logs"] == "some note here"

    def test_scoped_to_requesting_user_not_another_staff_members_log(
        self, staff_client, world_data, staff_user, admin_user,
    ):
        event = make_event()
        Log.objects.create(user=admin_user, event=event, logs="admin's private notes")

        response = staff_client.get(log_url(event.id))

        assert response.data["logs"] == ""

    def test_different_event_does_not_leak_into_this_one(self, staff_client, world_data, staff_user):
        event = make_event()
        other_event = make_event()
        Log.objects.create(user=staff_user, event=other_event, logs="notes for the other event")

        response = staff_client.get(log_url(event.id))

        assert response.data["logs"] == ""
