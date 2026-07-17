"""
Tests for the admin contributions-overview endpoint.

GET /api/booking/contributions-overview/  (admin only, read only)
  - optional ?status=<status> filter
  - optional ?event=<event_id> filter (contribution linked to the event)
  - each row shows the contribution's user (first_name, last_name, email),
    status, date, role, and the twin contribution (couple partner) with the
    same shape, or null when the contribution has no twin.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Contribution, ContributionStatus
from event.models import Event, PartnerRole
from utils.mock_event import make_event_payload

LIST_URL = "/api/booking/contributions-overview/"


def make_event_at(start_date):
    payload = make_event_payload()
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


@pytest.fixture
def leader_role(db):
    return PartnerRole.objects.create(name="leader")


@pytest.fixture
def follower_role(db):
    return PartnerRole.objects.create(name="follower")


@pytest.fixture
def couple(world_data, subject_user, partner_user, leader_role, follower_role):
    """A couple booking: original contribution + twin, both linked to the same event."""
    event = make_event_at(timezone.now() + timedelta(days=7))
    original = Contribution.objects.create(
        amount=50, user=subject_user, role=leader_role,
        status=ContributionStatus.ACCEPTED, partner=partner_user,
    )
    original.events.add(event)
    twin = Contribution.objects.create(
        amount=50, user=partner_user, role=follower_role,
        status=ContributionStatus.ACCEPTED, partner=subject_user,
        original_contribution=original,
    )
    twin.events.add(event)
    return event, original, twin


# ── Authentication / permissions ─────────────────────────────────────────────

class TestOverviewPermissions:

    def test_unauthenticated_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_returns_403(self, student_client, db):
        assert student_client.get(LIST_URL).status_code == http_status.HTTP_403_FORBIDDEN

    def test_admin_returns_200(self, admin_client, db):
        assert admin_client.get(LIST_URL).status_code == http_status.HTTP_200_OK


# ── Fields ────────────────────────────────────────────────────────────────────

class TestOverviewFields:

    def test_row_contains_expected_fields(self, admin_client, couple):
        res = admin_client.get(LIST_URL)
        row = res.data[0]
        assert {"id", "status", "date", "role", "user", "twin_contribution"}.issubset(row.keys())

    def test_user_fields(self, admin_client, couple, subject_user):
        subject_user.first_name = "Anna"
        subject_user.last_name = "Rossi"
        subject_user.save()
        res = admin_client.get(LIST_URL)
        _, original, _ = couple
        row = next(r for r in res.data if r["id"] == original.pk)
        assert row["user"] == {
            "first_name": "Anna",
            "last_name": "Rossi",
            "email": subject_user.email,
        }

    def test_role_is_rendered_as_name(self, admin_client, couple):
        _, original, _ = couple
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == original.pk)
        assert row["role"] == "leader"

    def test_role_null_when_missing(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == c.pk)
        assert row["role"] is None


# ── Twin contribution ─────────────────────────────────────────────────────────

class TestOverviewTwin:

    def test_twin_shows_original_user_on_partner_row(self, admin_client, couple, subject_user):
        _, original, twin = couple
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == twin.pk)
        assert row["twin_contribution"]["id"] == original.pk
        assert row["twin_contribution"]["user"]["email"] == subject_user.email
        assert row["twin_contribution"]["role"] == "leader"

    def test_twin_shows_partner_user_on_original_row(self, admin_client, couple, partner_user):
        _, original, twin = couple
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == original.pk)
        assert row["twin_contribution"]["id"] == twin.pk
        assert row["twin_contribution"]["user"]["email"] == partner_user.email
        assert row["twin_contribution"]["role"] == "follower"

    def test_twin_contains_status_and_date(self, admin_client, couple):
        _, original, twin = couple
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == original.pk)
        assert row["twin_contribution"]["status"] == ContributionStatus.ACCEPTED
        assert row["twin_contribution"]["date"] is not None

    def test_twin_null_for_solo_contribution(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        res = admin_client.get(LIST_URL)
        row = next(r for r in res.data if r["id"] == c.pk)
        assert row["twin_contribution"] is None


# ── Filters ───────────────────────────────────────────────────────────────────

class TestOverviewFilters:

    def test_filter_by_status(self, admin_client, subject_user, db):
        Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.ACCEPTED)
        Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.WAITING)
        res = admin_client.get(LIST_URL, {"status": ContributionStatus.WAITING})
        assert len(res.data) == 1
        assert res.data[0]["status"] == ContributionStatus.WAITING

    def test_filter_by_event(self, admin_client, subject_user, world_data):
        event_a = make_event_at(timezone.now() + timedelta(days=1))
        event_b = make_event_at(timezone.now() + timedelta(days=2))
        c_a = Contribution.objects.create(amount=10, user=subject_user)
        c_a.events.add(event_a)
        c_b = Contribution.objects.create(amount=10, user=subject_user)
        c_b.events.add(event_b)
        res = admin_client.get(LIST_URL, {"event": event_a.pk})
        assert [r["id"] for r in res.data] == [c_a.pk]

    def test_filter_by_status_and_event(self, admin_client, subject_user, world_data):
        event = make_event_at(timezone.now() + timedelta(days=1))
        c_waiting = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.WAITING)
        c_waiting.events.add(event)
        c_accepted = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.ACCEPTED)
        c_accepted.events.add(event)
        other = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.WAITING)
        res = admin_client.get(LIST_URL, {"event": event.pk, "status": ContributionStatus.WAITING})
        assert [r["id"] for r in res.data] == [c_waiting.pk]

    def test_no_filter_returns_all(self, admin_client, subject_user, db):
        Contribution.objects.create(amount=10, user=subject_user)
        Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.PAYED)
        res = admin_client.get(LIST_URL)
        assert len(res.data) == 2
