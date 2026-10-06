"""
Tests for POST /api/scanner/log/<event_id>/ — the notes box at the
bottom of the Register view. Staff type a free-text note (e.g. someone
showed up who wasn't on the register and was added by hand) and it's
appended to their own Log row for this event, timestamped, same storage
as the errors check-in appends automatically.

Assumptions baked into these tests (flag if wrong before implementing):
  - Body is {"note": "<text>"}. Missing or blank note is a 400.
  - Scoped to request.user — Log is keyed on (user, event); a second
    staff member posting a note for the same event gets their own row,
    never appending onto someone else's.
  - No existing Log row is created on first use (get_or_create), same
    pattern as check-in.
  - The endpoint is staff/admin only. An unknown event_id is a 404.
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


def update_log_url(event_id):
    return f"/api/scanner/log/{event_id}/"


# ── Authentication / permissions ──────────────────────────────────────────────

class TestUpdateLogAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data):
        event = make_event()
        response = client.post(update_log_url(event.id), {"note": "hello"}, format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data):
        event = make_event()
        response = student_client.post(update_log_url(event.id), {"note": "hello"}, format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(update_log_url(event.id), {"note": "hello"}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data):
        event = make_event()
        response = admin_client.post(update_log_url(event.id), {"note": "hello"}, format="json")
        assert response.status_code == http_status.HTTP_200_OK


# ── Invalid input ──────────────────────────────────────────────────────────────

class TestUpdateLogInvalidInput:

    def test_missing_note_returns_400(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(update_log_url(event.id), {}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_blank_note_returns_400(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(update_log_url(event.id), {"note": "   "}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_unknown_event_id_returns_404(self, staff_client, world_data):
        response = staff_client.post(update_log_url(999999), {"note": "hello"}, format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestUpdateLogSuccess:

    def test_creates_log_row_on_first_note(self, staff_client, world_data, staff_user):
        event = make_event()
        response = staff_client.post(update_log_url(event.id), {"note": "John Doe, not on the register"}, format="json")

        assert response.status_code == http_status.HTTP_200_OK
        log = Log.objects.get(user=staff_user, event=event)
        assert "John Doe, not on the register" in log.logs

    def test_response_includes_updated_logs(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(update_log_url(event.id), {"note": "a note"}, format="json")
        assert "a note" in response.data["logs"]

    def test_second_note_appends_rather_than_overwrites(self, staff_client, world_data, staff_user):
        event = make_event()
        staff_client.post(update_log_url(event.id), {"note": "first note"}, format="json")
        response = staff_client.post(update_log_url(event.id), {"note": "second note"}, format="json")

        log = Log.objects.get(user=staff_user, event=event)
        assert "first note" in log.logs
        assert "second note" in log.logs
        assert log.logs.index("first note") < log.logs.index("second note")
        assert "first note" in response.data["logs"]
        assert "second note" in response.data["logs"]

    def test_different_staff_members_get_separate_log_rows(
        self, staff_client, admin_client, world_data, staff_user, admin_user,
    ):
        event = make_event()
        staff_client.post(update_log_url(event.id), {"note": "staff's note"}, format="json")
        admin_client.post(update_log_url(event.id), {"note": "admin's note"}, format="json")

        assert Log.objects.filter(event=event).count() == 2
        staff_log = Log.objects.get(user=staff_user, event=event)
        admin_log = Log.objects.get(user=admin_user, event=event)
        assert "staff's note" in staff_log.logs
        assert "admin's note" not in staff_log.logs
        assert "admin's note" in admin_log.logs
        assert "staff's note" not in admin_log.logs
