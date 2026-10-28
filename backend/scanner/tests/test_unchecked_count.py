"""
Tests for GET /api/scanner/register/<event_id>/unchecked-count/ — the number
shown under the event picker on the scanner screen, so staff know how many
students still need to be checked in without opening the Register tab.

"Unchecked" means: not yet attended, and either their contribution is PAYED
or they have no contribution at all (a booking with a non-payed, non-null
contribution — e.g. waiting/cancelled — isn't someone staff are expected to
check in, so it doesn't count).

Assumptions baked into these tests (flag if wrong before implementing):
  - Already-attended bookings never count, regardless of contribution status.
  - The endpoint is staff/admin only, same as check-in and register list.
  - An unknown event_id is a 404.
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
        multi_events=overrides.get("multi_events", False),
        free=overrides.get("free", False),
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


def unchecked_count_url(event_id):
    return f"/api/scanner/register/{event_id}/unchecked-count/"


# ── Authentication / permissions ──────────────────────────────────────────────

class TestUncheckedCountAuthentication:

    def test_unauthenticated_returns_401(self, client, world_data):
        event = make_event()
        response = client.get(unchecked_count_url(event.id))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, world_data):
        event = make_event()
        response = student_client.get(unchecked_count_url(event.id))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_is_allowed(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK

    def test_admin_is_allowed(self, admin_client, world_data):
        event = make_event()
        response = admin_client.get(unchecked_count_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK


# ── Unknown event ──────────────────────────────────────────────────────────────

class TestUncheckedCountUnknownEvent:

    def test_unknown_event_id_returns_404(self, staff_client, world_data):
        response = staff_client.get(unchecked_count_url(999999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Counting logic ───────────────────────────────────────────────────────────

class TestUncheckedCountLogic:

    def test_empty_event_has_zero_unchecked(self, staff_client, world_data):
        event = make_event()
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 0

    def test_payed_not_attended_counts(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, make_contribution(student_user, event, status=ContributionStatus.PAYED))
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 1

    def test_no_contribution_counts(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, contribution=None)
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 1

    def test_already_attended_does_not_count(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(
            student_user, event,
            make_contribution(student_user, event, status=ContributionStatus.PAYED),
            attended=True,
        )
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 0

    def test_already_attended_with_no_contribution_does_not_count(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, contribution=None, attended=True)
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 0

    def test_non_payed_contribution_does_not_count(self, staff_client, world_data, student_user):
        event = make_event()
        make_booking(student_user, event, make_contribution(student_user, event, status=ContributionStatus.WAITING))
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 0

    def test_mix_of_rows_counts_only_matching_ones(self, staff_client, world_data, student_user, second_student):
        event = make_event()
        # Counts: payed + not attended.
        make_booking(student_user, event, make_contribution(student_user, event, status=ContributionStatus.PAYED))
        # Counts: no contribution + not attended.
        make_booking(second_student, event, contribution=None)
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 2

    def test_only_counts_bookings_for_the_requested_event(self, staff_client, world_data, student_user):
        event = make_event()
        other_event = make_event()
        make_booking(student_user, other_event, contribution=None)
        response = staff_client.get(unchecked_count_url(event.id))
        assert response.data["unchecked_count"] == 0


@pytest.fixture
def second_student():
    from users.models import User
    return User.objects.create_user(
        email="second-unchecked@bounce.com", password="StrongPass123!", role="student", is_active=True,
    )
