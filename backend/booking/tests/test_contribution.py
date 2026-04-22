"""
Tests for the Contribution API and the automatic booking sync logic.

Sync rules:
  - Event added to contribution  → user booked into all children of that event.
      If the parent event has already started, only future children are booked.
  - Event removed from contribution → user's bookings for *future* children are
      deleted; past bookings (already attended) are preserved.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution
from event.models import Event, EventType
from membership.models import Membership, MembershipRule
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

LIST_URL = "/api/booking/contributions/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Event helpers ─────────────────────────────────────────────────────────────

def make_event_at(start_date):
    """Create a minimal Event with a specific start_date."""
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


def make_parent_with_children(n_past, n_future, parent_started=True):
    """
    Create a parent event linked to n_past past children and n_future future
    children via the Event.events M2M.

    Returns (parent, past_children, future_children).
    """
    now = timezone.now()
    parent_start = now - timedelta(days=1) if parent_started else now + timedelta(days=1)
    parent = make_event_at(parent_start)

    past_children = [make_event_at(now - timedelta(hours=n_past - i)) for i in range(n_past)]
    future_children = [make_event_at(now + timedelta(hours=i + 1)) for i in range(n_future)]

    parent.events.set(past_children + future_children)
    return parent, past_children, future_children


# ── Payload helper ────────────────────────────────────────────────────────────

def make_contribution_payload(user, event_ids=None, **overrides):
    return {
        "amount": "50.00",
        "user": user.pk,
        "event_ids": event_ids if event_ids is not None else [],
        **overrides,
    }


# ── Authentication ────────────────────────────────────────────────────────────

class TestContributionAuthentication:

    def test_unauthenticated_list_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, subject_user, db):
        res = client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        assert client.get(detail_url(999)).status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Permissions ───────────────────────────────────────────────────────────────

class TestContributionPermissions:

    def test_student_cannot_list(self, student_client, db):
        assert student_client.get(LIST_URL).status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_create(self, student_client, subject_user, db):
        res = student_client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_retrieve(self, student_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        assert student_client.get(detail_url(c.pk)).status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        res = student_client.put(detail_url(c.pk), make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        assert student_client.delete(detail_url(c.pk)).status_code == http_status.HTTP_403_FORBIDDEN


# ── CRUD ──────────────────────────────────────────────────────────────────────

class TestContributionCRUD:

    def test_admin_can_list(self, admin_client, db):
        assert admin_client.get(LIST_URL).status_code == http_status.HTTP_200_OK

    def test_admin_can_create(self, admin_client, subject_user, db):
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_create_persists(self, admin_client, subject_user, db):
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, amount="75.50"), format="json")
        assert Contribution.objects.filter(user=subject_user).exists()

    def test_create_returns_correct_fields(self, admin_client, subject_user, db):
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert set(res.data.keys()) == {"id", "amount", "user", "events", "membership"}

    def test_admin_can_retrieve(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        assert admin_client.get(detail_url(c.pk)).status_code == http_status.HTTP_200_OK

    def test_retrieve_returns_amount(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount="99.99", user=subject_user)
        res = admin_client.get(detail_url(c.pk))
        assert float(res.data["amount"]) == pytest.approx(99.99)

    def test_retrieve_nonexistent_returns_404(self, admin_client, db):
        assert admin_client.get(detail_url(9999)).status_code == http_status.HTTP_404_NOT_FOUND

    def test_admin_can_update_amount(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        res = admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, amount="200.00"), format="json")
        assert res.status_code == http_status.HTTP_200_OK
        c.refresh_from_db()
        assert float(c.amount) == pytest.approx(200.0)

    def test_admin_can_delete(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount=10, user=subject_user)
        res = admin_client.delete(detail_url(c.pk))
        assert res.status_code == http_status.HTTP_204_NO_CONTENT
        assert not Contribution.objects.filter(pk=c.pk).exists()

    def test_list_shows_all_contributions(self, admin_client, subject_user, db):
        Contribution.objects.create(amount=10, user=subject_user)
        Contribution.objects.create(amount=20, user=subject_user)
        res = admin_client.get(LIST_URL)
        assert len(res.data) == 2


# ── Booking sync on create ────────────────────────────────────────────────────

class TestBookingSyncOnCreate:

    def test_no_events_creates_no_bookings(self, admin_client, subject_user, db):
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_event_with_no_children_creates_no_bookings(self, admin_client, subject_user, world_data):
        now = timezone.now()
        childless_event = make_event_at(now + timedelta(days=1))
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[childless_event.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_future_parent_books_all_children(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=3, parent_started=False)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 3

    def test_started_parent_books_only_future_children(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=2, n_future=3, parent_started=True)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 3

    def test_started_parent_with_no_future_children_creates_no_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=2, n_future=0, parent_started=True)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_booked_events_are_exactly_the_future_children(self, admin_client, subject_user, world_data):
        parent, past_children, future_children = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        booked_ids = set(Booking.objects.filter(user=subject_user).values_list("event_id", flat=True))
        assert booked_ids == {c.pk for c in future_children}

    def test_past_children_are_not_booked(self, admin_client, subject_user, world_data):
        parent, past_children, _ = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        past_ids = {c.pk for c in past_children}
        booked_ids = set(Booking.objects.filter(user=subject_user).values_list("event_id", flat=True))
        assert booked_ids.isdisjoint(past_ids)


# ── Booking sync on update — adding events ────────────────────────────────────

class TestBookingSyncOnUpdateAdd:

    def test_adding_event_books_future_children(self, admin_client, subject_user, world_data):
        c = Contribution.objects.create(amount=10, user=subject_user)
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2

    def test_adding_started_event_books_only_future_children(self, admin_client, subject_user, world_data):
        c = Contribution.objects.create(amount=10, user=subject_user)
        parent, _, future_children = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2

    def test_updating_with_same_events_does_not_duplicate_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        contribution_id = res.data["id"]
        # PUT with the same event again
        admin_client.put(
            detail_url(contribution_id),
            make_contribution_payload(subject_user, event_ids=[parent.pk]),
            format="json",
        )
        assert Booking.objects.filter(user=subject_user).count() == 2


# ── Booking sync on update — removing events ──────────────────────────────────

class TestBookingSyncOnUpdateRemove:

    def test_removing_event_deletes_future_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=0, n_future=3, parent_started=False)
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 3

        admin_client.put(detail_url(res.data["id"]), make_contribution_payload(subject_user, event_ids=[]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_removing_event_preserves_past_bookings(self, admin_client, subject_user, world_data):
        parent, past_children, _ = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        # Simulate user already having attended past sessions
        for child in past_children:
            Booking.objects.create(user=subject_user, event=child)

        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 4  # 2 past + 2 future

        admin_client.put(detail_url(res.data["id"]), make_contribution_payload(subject_user, event_ids=[]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2  # only past survive

    def test_removing_preserves_correct_past_bookings(self, admin_client, subject_user, world_data):
        parent, past_children, _ = make_parent_with_children(n_past=2, n_future=1, parent_started=True)
        for child in past_children:
            Booking.objects.create(user=subject_user, event=child)

        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        admin_client.put(detail_url(res.data["id"]), make_contribution_payload(subject_user, event_ids=[]), format="json")

        surviving_ids = set(Booking.objects.filter(user=subject_user).values_list("event_id", flat=True))
        assert surviving_ids == {c.pk for c in past_children}

    def test_removing_event_with_only_past_children_deletes_nothing(self, admin_client, subject_user, world_data):
        parent, past_children, _ = make_parent_with_children(n_past=2, n_future=0, parent_started=True)
        for child in past_children:
            Booking.objects.create(user=subject_user, event=child)

        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        admin_client.put(detail_url(res.data["id"]), make_contribution_payload(subject_user, event_ids=[]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2


# ── Membership rule validation ─────────────────────────────────────────────────

def make_event_type():
    return EventType.objects.create(**make_event_type_payload())


def make_event_with_type(event_type, start_date=None):
    """Create an Event with a specific EventType, using random dependencies for the rest."""
    now = timezone.now()
    start = start_date or (now - timedelta(days=1))
    payload = make_event_payload()
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


def make_membership_with_rule(event_type, max_events=1):
    m = Membership.objects.create(name="Test Plan", contribution=100)
    MembershipRule.objects.create(membership=m, event_type=event_type, max_events=max_events)
    return m


class TestMembershipRuleValidation:
    """
    Membership rules (MembershipRule.max_events per EventType) must be enforced
    on both create and update.
    """

    def test_create_within_limit_is_accepted(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=1)
        event = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[event.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_create_exceeds_limit_returns_400(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=1)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        payload = make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk)
        print (payload)
        res = admin_client.post(
            LIST_URL,
            payload,
            format="json",
        )
        print (res.data)
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_exceeds_limit_error_mentions_type(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=1)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk),
            format="json",
        )
        body = str(res.data)
        assert et.name in body or "event_ids" in body

    def test_create_higher_limit_allows_multiple(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=2)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_create_different_event_types_each_within_limit(self, admin_client, subject_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = Membership.objects.create(name="Combo Plan", contribution=200)
        MembershipRule.objects.create(membership=m, event_type=et_a, max_events=1)
        MembershipRule.objects.create(membership=m, event_type=et_b, max_events=1)
        event_a = make_event_with_type(et_a)
        event_b = make_event_with_type(et_b)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[event_a.pk, event_b.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_create_event_type_not_in_rules_returns_400(self, admin_client, subject_user, world_data):
        """Membership has a rule for et_a only; events of et_b must be rejected."""
        et_a = make_event_type()
        et_b = make_event_type()
        m = make_membership_with_rule(et_a, max_events=1)
        event_b = make_event_with_type(et_b)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[event_b.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_no_membership_allows_any_events(self, admin_client, subject_user, world_data):
        et = make_event_type()
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_membership_without_rules_allows_any_events(self, admin_client, subject_user, world_data):
        m = Membership.objects.create(name="Open Plan", contribution=0)
        et = make_event_type()
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_update_exceeds_limit_returns_400(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=1)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        cid = res.data["id"]
        res2 = admin_client.put(
            detail_url(cid),
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk),
            format="json",
        )
        assert res2.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_update_within_limit_is_accepted(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=2)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk], membership_id=m.pk),
            format="json",
        )
        cid = res.data["id"]
        res2 = admin_client.put(
            detail_url(cid),
            make_contribution_payload(subject_user, event_ids=[e1.pk, e2.pk], membership_id=m.pk),
            format="json",
        )
        assert res2.status_code == http_status.HTTP_200_OK

    def test_update_replacing_event_same_type_stays_within_limit(self, admin_client, subject_user, world_data):
        et = make_event_type()
        m = make_membership_with_rule(et, max_events=1)
        e1 = make_event_with_type(et)
        e2 = make_event_with_type(et)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk], membership_id=m.pk),
            format="json",
        )
        cid = res.data["id"]
        # Swap e1 for e2 — still only 1 event of this type
        res2 = admin_client.put(
            detail_url(cid),
            make_contribution_payload(subject_user, event_ids=[e2.pk], membership_id=m.pk),
            format="json",
        )
        assert res2.status_code == http_status.HTTP_200_OK


# ── Membership total max_events cap ───────────────────────────────────────────

class TestMembershipTotalCap:
    """
    Membership.max_events is a hard ceiling on total events regardless of type.
    0 means unlimited.
    """

    def _make_membership_two_rules(self, et_a, et_b, total_max):
        m = Membership.objects.create(name="Capped Plan", contribution=100, max_events=total_max)
        MembershipRule.objects.create(membership=m, event_type=et_a, max_events=2)
        MembershipRule.objects.create(membership=m, event_type=et_b, max_events=2)
        return m

    def test_total_cap_exceeded_returns_400(self, admin_client, subject_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = self._make_membership_two_rules(et_a, et_b, total_max=1)
        e_a = make_event_with_type(et_a)
        e_b = make_event_with_type(et_b)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e_a.pk, e_b.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_total_cap_within_limit_is_accepted(self, admin_client, subject_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = self._make_membership_two_rules(et_a, et_b, total_max=2)
        e_a = make_event_with_type(et_a)
        e_b = make_event_with_type(et_b)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e_a.pk, e_b.pk], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_total_cap_zero_means_unlimited(self, admin_client, subject_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = self._make_membership_two_rules(et_a, et_b, total_max=0)
        events = [make_event_with_type(et_a), make_event_with_type(et_b), make_event_with_type(et_a)]
        # 3 events, no total cap (max_events=0), each type within its per-type limit of 2
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e.pk for e in events], membership_id=m.pk),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_total_cap_on_update_returns_400(self, admin_client, subject_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = self._make_membership_two_rules(et_a, et_b, total_max=1)
        e_a = make_event_with_type(et_a)
        e_b = make_event_with_type(et_b)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e_a.pk], membership_id=m.pk),
            format="json",
        )
        cid = res.data["id"]
        res2 = admin_client.put(
            detail_url(cid),
            make_contribution_payload(subject_user, event_ids=[e_a.pk, e_b.pk], membership_id=m.pk),
            format="json",
        )
        assert res2.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_no_membership_ignores_total_cap(self, admin_client, subject_user, world_data):
        et = make_event_type()
        events = [make_event_with_type(et) for _ in range(3)]
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e.pk for e in events]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
