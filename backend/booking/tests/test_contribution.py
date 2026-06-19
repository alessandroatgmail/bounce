"""
Tests for the Contribution API and the automatic booking sync logic.

Sync rules:
  - Bookings are only created/updated when a contribution has status=confirmed.
  - When status transitions to confirmed → sync bookings for all events.
  - When events are updated on a confirmed contribution → sync bookings for diff.
  - Event removed from confirmed contribution → user's bookings for *future*
    children are deleted; past bookings (already attended) are preserved.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, EventType
from membership.models import Membership, MembershipRule, Discount
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

def make_contribution_payload(user, event_ids=None, status=ContributionStatus.RECEIVED, **overrides):
    return {
        "amount": "50.00",
        "user": user.pk,
        "status": status,
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
        assert {"id", "amount", "user", "events", "membership", "start_date", "end_date"}.issubset(res.data.keys())

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


# ── start_date assignment ─────────────────────────────────────────────────────

class TestContributionStartDate:

    def _create_via_api(self, admin_client, subject_user, event, membership):
        payload = make_contribution_payload(
            subject_user,
            event_ids=[event.pk],
            membership_id=membership.pk,
        )
        return admin_client.post(LIST_URL, payload, format="json")

    def test_future_event_start_date_is_event_start(self, admin_client, subject_user, world_data):
        now = timezone.now()
        future_event = make_event_at(now + timedelta(days=10))
        membership = Membership.objects.create(name="Pass", contribution=100)
        res = self._create_via_api(admin_client, subject_user, future_event, membership)
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.start_date is not None
        assert abs((c.start_date - future_event.start_date).total_seconds()) < 1

    def test_past_event_start_date_is_now(self, admin_client, subject_user, world_data):
        now = timezone.now()
        past_event = make_event_at(now - timedelta(days=10))
        membership = Membership.objects.create(name="Pass", contribution=100)
        res = self._create_via_api(admin_client, subject_user, past_event, membership)
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.start_date is not None
        assert c.start_date >= now - timedelta(seconds=5)


# ── Booking sync helpers ──────────────────────────────────────────────────────

def confirm_contribution(contribution):
    """Set status to confirmed via queryset.update to bypass __init__ tracking, then reload."""
    Contribution.objects.filter(pk=contribution.pk).update(status=ContributionStatus.CONFIRMED)
    contribution.refresh_from_db()
    return contribution


# ── Booking sync on create ────────────────────────────────────────────────────

class TestBookingSyncOnCreate:

    def test_create_does_not_sync_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=0, n_future=3, parent_started=False)
        admin_client.post(LIST_URL, make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0


# ── Booking sync on confirmation ──────────────────────────────────────────────

class TestBookingSyncOnConfirmation:

    def _create(self, admin_client, subject_user, event_ids=None):
        payload = make_contribution_payload(subject_user, event_ids=event_ids or [])
        res = admin_client.post(LIST_URL, payload, format="json")
        return Contribution.objects.get(pk=res.data["id"])

    def test_confirm_with_no_events_creates_no_bookings(self, admin_client, subject_user, db):
        c = self._create(admin_client, subject_user)
        c.status = ContributionStatus.CONFIRMED
        c.save()
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_confirm_future_parent_books_all_children(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=3, parent_started=False)
        c = self._create(admin_client, subject_user, event_ids=[parent.pk])
        c.status = ContributionStatus.CONFIRMED
        c.save()
        assert Booking.objects.filter(user=subject_user).count() == 3

    def test_confirm_started_parent_books_only_future_children(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=2, n_future=3, parent_started=True)
        c = self._create(admin_client, subject_user, event_ids=[parent.pk])
        c.status = ContributionStatus.CONFIRMED
        c.save()
        assert Booking.objects.filter(user=subject_user).count() == 3

    def test_confirm_started_parent_with_no_future_children_creates_no_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=2, n_future=0, parent_started=True)
        c = self._create(admin_client, subject_user, event_ids=[parent.pk])
        c.status = ContributionStatus.CONFIRMED
        c.save()
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_confirm_books_exactly_future_children(self, admin_client, subject_user, world_data):
        parent, past_children, future_children = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        c = self._create(admin_client, subject_user, event_ids=[parent.pk])
        c.status = ContributionStatus.CONFIRMED
        c.save()
        booked_ids = set(Booking.objects.filter(user=subject_user).values_list("event_id", flat=True))
        assert booked_ids == {child.pk for child in future_children}

    def test_confirming_twice_does_not_duplicate_bookings(self, admin_client, subject_user, world_data):
        parent, _, _ = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        c = self._create(admin_client, subject_user, event_ids=[parent.pk])
        c.status = ContributionStatus.CONFIRMED
        c.save()
        c.save()  # second save, same status — no re-trigger
        assert Booking.objects.filter(user=subject_user).count() == 2


# ── Booking sync on update (confirmed contributions) ──────────────────────────

class TestBookingSyncOnUpdateAdd:

    def test_adding_event_to_confirmed_contribution_books_future_children(self, admin_client, subject_user, world_data):
        c = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.CONFIRMED)
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[parent.pk], status=ContributionStatus.CONFIRMED), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2

    def test_adding_event_to_unconfirmed_contribution_does_not_book(self, admin_client, subject_user, world_data):
        c = Contribution.objects.create(amount=10, user=subject_user)
        parent, _, _ = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[parent.pk]), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_updating_confirmed_with_same_events_does_not_duplicate_bookings(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=2, parent_started=False)
        c = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.CONFIRMED)
        c.events.set([parent])
        # Seed the bookings that would have been created on initial confirmation
        for fc in future_children:
            Booking.objects.create(user=subject_user, event=fc)
        assert Booking.objects.filter(user=subject_user).count() == 2

        # PUT same events again — get_or_create means no duplicates
        admin_client.put(
            detail_url(c.pk),
            make_contribution_payload(subject_user, event_ids=[parent.pk], status=ContributionStatus.CONFIRMED),
            format="json",
        )
        assert Booking.objects.filter(user=subject_user).count() == 2


# ── Booking sync on update — removing events ──────────────────────────────────

class TestBookingSyncOnUpdateRemove:

    def test_removing_event_from_confirmed_deletes_future_bookings(self, admin_client, subject_user, world_data):
        parent, _, future_children = make_parent_with_children(n_past=0, n_future=3, parent_started=False)
        c = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.CONFIRMED)
        c.events.set([parent])
        for fc in future_children:
            Booking.objects.create(user=subject_user, event=fc)
        assert Booking.objects.filter(user=subject_user).count() == 3

        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[], status=ContributionStatus.CONFIRMED), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 0

    def test_removing_event_preserves_past_bookings(self, admin_client, subject_user, world_data):
        parent, past_children, future_children = make_parent_with_children(n_past=2, n_future=2, parent_started=True)
        c = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.CONFIRMED)
        c.events.set([parent])
        for child in past_children + future_children:
            Booking.objects.get_or_create(user=subject_user, event=child)
        assert Booking.objects.filter(user=subject_user).count() == 4

        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[], status=ContributionStatus.CONFIRMED), format="json")
        assert Booking.objects.filter(user=subject_user).count() == 2  # only past survive

    def test_removing_event_with_only_past_children_deletes_nothing(self, admin_client, subject_user, world_data):
        parent, past_children, _ = make_parent_with_children(n_past=2, n_future=0, parent_started=True)
        c = Contribution.objects.create(amount=10, user=subject_user, status=ContributionStatus.CONFIRMED)
        c.events.set([parent])
        for child in past_children:
            Booking.objects.create(user=subject_user, event=child)

        admin_client.put(detail_url(c.pk), make_contribution_payload(subject_user, event_ids=[], status=ContributionStatus.CONFIRMED), format="json")
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
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, event_ids=[e1.pk], membership_id=m.pk),
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
            make_contribution_payload(subject_user, event_ids=[e2.pk], membership_id=m.pk),
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


# ── Discounts (admin) ─────────────────────────────────────────────────────────

def make_discount(name="DISC", rate=None, amount=None):
    return Discount.objects.create(
        name=name, name_ext=f"{name} extended", description="test discount",
        rate=rate, amount=amount,
    )


class TestContributionDiscounts:

    def test_create_with_discounts(self, admin_client, subject_user, db):
        d1 = make_discount("D1", rate=10)
        d2 = make_discount("D2", amount="5.00")
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, amount="100.00", discount_ids=[d1.pk, d2.pk]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert set(c.discounts.values_list("pk", flat=True)) == {d1.pk, d2.pk}

    def test_create_without_discounts(self, admin_client, subject_user, db):
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert res.data["discounts"] == []

    def test_response_includes_discounts_and_discounted_amount(self, admin_client, subject_user, db):
        d = make_discount("RATE10", rate=10)
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, amount="100.00", discount_ids=[d.pk]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        assert len(res.data["discounts"]) == 1
        assert res.data["discounts"][0]["name"] == "RATE10"
        assert float(res.data["discounted_amount"]) == pytest.approx(90.0)

    def test_discounted_amount_stacks_rate_and_amount(self, admin_client, subject_user, db):
        d1 = make_discount("D1", rate=10)
        d2 = make_discount("D2", amount="5.00")
        res = admin_client.post(
            LIST_URL,
            make_contribution_payload(subject_user, amount="100.00", discount_ids=[d1.pk, d2.pk]),
            format="json",
        )
        # 100 * 0.9 = 90, then -5 = 85 (order-independent since rate applies to base each time)
        assert float(res.data["discounted_amount"]) == pytest.approx(85.0)

    def test_update_adds_discounts(self, admin_client, subject_user, db):
        c = Contribution.objects.create(amount="100.00", user=subject_user)
        d = make_discount("LATE", rate=20)
        res = admin_client.put(
            detail_url(c.pk),
            make_contribution_payload(subject_user, amount="100.00", discount_ids=[d.pk]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        assert list(c.discounts.values_list("pk", flat=True)) == [d.pk]
        assert float(res.data["discounted_amount"]) == pytest.approx(80.0)

    def test_update_removes_discounts(self, admin_client, subject_user, db):
        d = make_discount("GONE", rate=50)
        c = Contribution.objects.create(amount="100.00", user=subject_user)
        c.discounts.add(d)
        res = admin_client.put(
            detail_url(c.pk),
            make_contribution_payload(subject_user, amount="100.00", discount_ids=[]),
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        assert c.discounts.count() == 0

    def test_update_without_discount_ids_keeps_existing(self, admin_client, subject_user, db):
        d = make_discount("KEEP", rate=10)
        c = Contribution.objects.create(amount="100.00", user=subject_user)
        c.discounts.add(d)
        res = admin_client.put(
            detail_url(c.pk),
            make_contribution_payload(subject_user, amount="100.00"),
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK
        assert list(c.discounts.values_list("pk", flat=True)) == [d.pk]

    def test_list_includes_discounts(self, admin_client, subject_user, db):
        d = make_discount("LIST", rate=10)
        c = Contribution.objects.create(amount="100.00", user=subject_user)
        c.discounts.add(d)
        res = admin_client.get(LIST_URL)
        assert res.data[0]["discounts"][0]["name"] == "LIST"


# ── end_date auto-computation (admin) ─────────────────────────────────────────

class TestContributionEndDate:

    def test_end_date_set_when_membership_has_duration(self, admin_client, subject_user, db):
        from dateutil.relativedelta import relativedelta
        from datetime import timedelta
        m = Membership.objects.create(name="Monthly", contribution=50, duration=2)
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, membership_id=m.pk), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.end_date is not None
        expected = c.start_date + relativedelta(months=2)
        assert abs((c.end_date - expected).total_seconds()) < 2

    def test_end_date_none_when_no_membership(self, admin_client, subject_user, db):
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.end_date is None

    def test_end_date_none_when_duration_is_zero(self, admin_client, subject_user, db):
        m = Membership.objects.create(name="Perpetual", contribution=0, duration=0)
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, membership_id=m.pk), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.end_date is None

    def test_end_date_in_response(self, admin_client, subject_user, db):
        m = Membership.objects.create(name="Annual", contribution=100, duration=12)
        res = admin_client.post(LIST_URL, make_contribution_payload(subject_user, membership_id=m.pk), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert "end_date" in res.data
        assert res.data["end_date"] is not None
