"""
Tests for POST /api/scanner/check-in/ — staff scans a student's QR code
(their uuid) against the event chosen in the "today's events" select on
the frontend, marking the student's Booking.attended.

Flow: look up the Booking for (user, event_id).
- No booking at all: log the miss and return 404, nothing to update.
- Booking found: mark it attended regardless of what follows, then
  validate the booking's contribution — status must be PAYED, and it
  must have an end_date that is not before the event's start_date. Any
  failure (a missing contribution, a missing/null end_date, an end_date
  before the event, or a non-PAYED status) still lets attended=True
  stand, but appends the error to the scanner Log row for
  (user, event) — `user` is the staff member operating the scanner, so
  each staff member scanning at an event gets their own row, which
  keeps growing (across however many different students they scan)
  rather than spawning one row per student. The scanned student's
  identity is recorded inline in each appended line, not as its own
  column, since one row can cover many different students.

Assumptions baked into these tests (flag if wrong before implementing):
  - A validation failure still responds 200 (the booking WAS updated),
    just with an "errors" list in the body — only the true no-booking
    case is a 404.
  - A null contribution.end_date is itself an error to log (not treated
    as "never expires") — same "log it, still mark attended" handling
    as every other validation failure.
  - The endpoint is staff/admin only (custom `role` field, not Django's
    built-in is_staff) — a student gets 403.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event
from membership.models import Membership
from scanner.models import Log
from users.models import User
from utils.mock_event import make_event_payload

pytestmark = pytest.mark.django_db

CHECK_IN_URL = "/api/scanner/check-in/"


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


def make_contribution(user, event, status=ContributionStatus.PAYED, end_date=None, membership=None):
    contribution = Contribution.objects.create(
        user=user,
        membership=membership or make_membership(),
        amount=50,
        status=status,
        end_date=end_date,
    )
    contribution.events.add(event)
    return contribution


def make_booking(user, event, contribution=None):
    return Booking.objects.create(user=user, event=event, contribution=contribution)


def check_in(client, user, event):
    return client.post(CHECK_IN_URL, {"uuid": str(user.uuid), "event_id": event.id}, format="json")


# ── Authentication / permissions ──────────────────────────────────────────────

class TestCheckInAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data, student_user):
        event = make_event()
        response = check_in(client, student_user, event)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data, student_user):
        event = make_event()
        response = check_in(student_client, student_user, event)
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, make_contribution(student_user, event))
        response = check_in(staff_client, student_user, event)
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, make_contribution(student_user, event))
        response = check_in(admin_client, student_user, event)
        assert response.status_code == http_status.HTTP_200_OK


# ── Malformed / unknown input ─────────────────────────────────────────────────

class TestCheckInInvalidInput:

    def test_missing_uuid_returns_400(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(CHECK_IN_URL, {"event_id": event.id}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_missing_event_id_returns_400(self, staff_client, world_data, student_user):
        response = staff_client.post(CHECK_IN_URL, {"uuid": str(student_user.uuid)}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_unknown_uuid_returns_404(self, staff_client, world_data):
        event = make_event()
        response = staff_client.post(
            CHECK_IN_URL,
            {"uuid": "00000000-0000-0000-0000-000000000000", "event_id": event.id},
            format="json",
        )
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_unknown_event_id_returns_404(self, staff_client, world_data, student_user):
        response = staff_client.post(
            CHECK_IN_URL,
            {"uuid": str(student_user.uuid), "event_id": 999999},
            format="json",
        )
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestCheckInSuccess:

    def test_marks_booking_attended(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.PAYED)
        booking = make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True

    def test_response_includes_student_name(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=timezone.now() + timedelta(days=365),
        )
        make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.data["first_name"] == student_user.first_name
        assert response.data["last_name"] == student_user.last_name

    def test_no_log_row_created_on_success(self, staff_client, world_data, student_user, staff_user):
        event = make_event()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=timezone.now() + timedelta(days=365),
        )
        make_booking(student_user, event, contribution)

        check_in(staff_client, student_user, event)

        assert not Log.objects.filter(user=staff_user, event=event).exists()

    def test_end_date_after_event_start_is_valid(self, staff_client, world_data, student_user, staff_user):
        event = make_event(start_date=timezone.now().isoformat())
        event.refresh_from_db()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=event.start_date + timedelta(days=1),
        )
        make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        assert not Log.objects.filter(user=staff_user, event=event).exists()

    def test_end_date_equal_to_event_start_is_valid(self, staff_client, world_data, student_user, staff_user):
        event = make_event(start_date=timezone.now().isoformat())
        event.refresh_from_db()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=event.start_date,
        )
        make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        assert not Log.objects.filter(user=staff_user, event=event).exists()


# ── No booking at all ──────────────────────────────────────────────────────────

class TestCheckInNoBooking:

    def test_returns_404(self, staff_client, world_data, student_user):
        event = make_event()
        response = check_in(staff_client, student_user, event)
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_response_still_includes_student_name(self, staff_client, world_data, student_user):
        """The student was already resolved before the booking lookup
        failed, so staff still see who was scanned even without a match."""
        event = make_event()
        response = check_in(staff_client, student_user, event)
        assert response.data["first_name"] == student_user.first_name
        assert response.data["last_name"] == student_user.last_name

    def test_logs_the_miss(self, staff_client, world_data, student_user, staff_user):
        event = make_event()
        check_in(staff_client, student_user, event)
        log = Log.objects.get(user=staff_user, event=event)
        assert "booking" in log.logs.lower()

    def test_log_mentions_the_scanned_student(self, staff_client, world_data, student_user, staff_user):
        """The row is keyed on the scanning staff member, not the
        student — but the student's identity must still show up in the
        text so staff can tell who a given entry was about."""
        event = make_event()
        check_in(staff_client, student_user, event)
        log = Log.objects.get(user=staff_user, event=event)
        assert student_user.email in log.logs

    def test_no_booking_is_created(self, staff_client, world_data, student_user):
        event = make_event()
        check_in(staff_client, student_user, event)
        assert not Booking.objects.filter(user=student_user, event=event).exists()


# ── Contribution status isn't PAYED ───────────────────────────────────────────

class TestCheckInInvalidContributionStatus:

    @pytest.mark.parametrize("status", [
        ContributionStatus.RECEIVED, ContributionStatus.ACCEPTED, ContributionStatus.CONFIRMED,
        ContributionStatus.WAITING, ContributionStatus.APPROVING, ContributionStatus.CANCELLED,
    ])
    def test_non_payed_status_still_marks_attended(self, staff_client, world_data, student_user, status):
        event = make_event()
        contribution = make_contribution(student_user, event, status=status)
        booking = make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True

    def test_non_payed_status_logs_the_error(self, staff_client, world_data, student_user, staff_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.ACCEPTED)
        make_booking(student_user, event, contribution)

        check_in(staff_client, student_user, event)

        log = Log.objects.get(user=staff_user, event=event)
        assert "accepted" in log.logs.lower() or "status" in log.logs.lower()

    def test_response_still_includes_student_name_on_warning(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.ACCEPTED)
        make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.data["first_name"] == student_user.first_name
        assert response.data["last_name"] == student_user.last_name


# ── Contribution expired before the event ─────────────────────────────────────

class TestCheckInExpiredContribution:

    def test_end_date_before_event_still_marks_attended(self, staff_client, world_data, student_user):
        event = make_event(start_date=timezone.now().isoformat())
        event.refresh_from_db()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=event.start_date - timedelta(days=1),
        )
        booking = make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True

    def test_end_date_before_event_logs_the_error(self, staff_client, world_data, student_user, staff_user):
        event = make_event(start_date=timezone.now().isoformat())
        event.refresh_from_db()
        contribution = make_contribution(
            student_user, event, status=ContributionStatus.PAYED,
            end_date=event.start_date - timedelta(days=1),
        )
        make_booking(student_user, event, contribution)

        check_in(staff_client, student_user, event)

        log = Log.objects.get(user=staff_user, event=event)
        assert log.logs

    def test_null_end_date_still_marks_attended(self, staff_client, world_data, student_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.PAYED, end_date=None)
        booking = make_booking(student_user, event, contribution)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True

    def test_null_end_date_logs_the_error(self, staff_client, world_data, student_user, staff_user):
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.PAYED, end_date=None)
        make_booking(student_user, event, contribution)

        check_in(staff_client, student_user, event)

        log = Log.objects.get(user=staff_user, event=event)
        assert "end_date" in log.logs.lower() or "end date" in log.logs.lower()


# ── Booking with no linked contribution ───────────────────────────────────────

class TestCheckInMissingContribution:

    def test_booking_without_contribution_still_marks_attended(self, staff_client, world_data, student_user):
        event = make_event()
        booking = make_booking(student_user, event, contribution=None)

        response = check_in(staff_client, student_user, event)

        assert response.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True

    def test_booking_without_contribution_logs_the_error(self, staff_client, world_data, student_user, staff_user):
        event = make_event()
        make_booking(student_user, event, contribution=None)

        check_in(staff_client, student_user, event)

        log = Log.objects.get(user=staff_user, event=event)
        assert log.logs


# ── Log rows are keyed on the scanning staff member, not the student ─────────

class TestLogGroupedByStaffMember:

    def test_second_scan_by_the_same_staff_appends_to_the_same_row(
        self, staff_client, world_data, student_user, staff_user,
    ):
        """The same staff member hitting two different errors at the same
        event — even for two different students — grows one Log row
        instead of creating a second one; `logs` keeps every entry."""
        event = make_event()
        second_student = User.objects.create_user(
            email="second@bounce.com", password="StrongPass123!", role="student", is_active=True,
        )
        contribution = make_contribution(student_user, event, status=ContributionStatus.ACCEPTED)
        make_booking(student_user, event, contribution)
        second_contribution = make_contribution(second_student, event, status=ContributionStatus.WAITING)
        make_booking(second_student, event, second_contribution)

        check_in(staff_client, student_user, event)
        first_logs = Log.objects.get(user=staff_user, event=event).logs

        check_in(staff_client, second_student, event)

        assert Log.objects.filter(user=staff_user, event=event).count() == 1
        log = Log.objects.get(user=staff_user, event=event)
        assert log.logs.startswith(first_logs)
        assert len(log.logs) > len(first_logs)
        assert student_user.email in log.logs
        assert second_student.email in log.logs

    def test_different_staff_get_separate_log_rows_for_the_same_event(
        self, staff_client, admin_client, world_data, student_user, staff_user, admin_user,
    ):
        """Three staff members scanning at the same event end up with
        three separate Log rows for that event, not one shared row."""
        event = make_event()
        contribution = make_contribution(student_user, event, status=ContributionStatus.ACCEPTED)
        make_booking(student_user, event, contribution)

        check_in(staff_client, student_user, event)
        check_in(admin_client, student_user, event)

        assert Log.objects.filter(event=event).count() == 2
        assert Log.objects.filter(user=staff_user, event=event).exists()
        assert Log.objects.filter(user=admin_user, event=event).exists()
