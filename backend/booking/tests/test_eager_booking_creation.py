"""
Booking rows for a single event or a regular repeating class (cases 1 & 2 —
festivals are a separate follow-up) are now created eagerly at registration
time, through POST /api/booking/my-memberships/, regardless of the status
the contribution ends up in (ACCEPTED, WAITING, ...).

This replaces the previous payment-gated behaviour (see
test_booking_on_payment.py, which still covers the Contribution.save()
PAYED-transition hook — that hook is untouched and keeps working the same
way for anything that flips a contribution's status directly via the ORM).
The admin register page + Consolidate are the intended tool for cleaning up
no-shows/non-payers now, not automatic status gating.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, EventType, PartnerRole
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_student(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        first_name=local.capitalize(),
        last_name="Test",
        is_active=True,
    )


def make_membership(**overrides):
    defaults = {"name": "Plan", "contribution": 50, "max_events": 0, "duration": 0}
    defaults.update(overrides)
    return Membership.objects.create(**defaults)


def make_event(event_type=None, start_date=None, capacity=None):
    event_type = event_type or EventType.objects.create(**make_event_type_payload())
    payload = make_event_payload(event_type_id=event_type.pk)
    start = start_date or (timezone.now() + timedelta(days=7))
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
        capacity=capacity if capacity is not None else payload["capacity"],
    )


def make_parent_with_children(n, event_type=None, capacity=None):
    event_type = event_type or EventType.objects.create(**make_event_type_payload())
    now = timezone.now()
    parent = make_event(event_type, start_date=now - timedelta(days=1), capacity=capacity)
    children = [
        make_event(event_type, start_date=now + timedelta(hours=i + 1))
        for i in range(n)
    ]
    parent.events.set(children)
    return parent, children


def book(student, event, membership, role=None, partner_id=None, partner_email=None):
    client = APIClient()
    client.force_authenticate(user=student)
    payload = {"membership_id": membership.pk, "event_id": event.pk}
    if role is not None:
        payload["role_id"] = role.pk
    if partner_id is not None:
        payload["partner_id"] = partner_id
    if partner_email is not None:
        payload["partner_email"] = partner_email
    return client.post(MY_MEMBERSHIPS_URL, payload, format="json")


def make_partner_role_type():
    event_type = EventType.objects.create(**make_event_type_payload(partners=2))
    leader = PartnerRole.objects.get_or_create(name="Leader")[0]
    follower = PartnerRole.objects.get_or_create(name="Follower")[0]
    event_type.partner_roles.set([leader, follower])
    return event_type, leader, follower


# ── Case 1: single event ──────────────────────────────────────────────────────

class TestEagerBookingSingleEvent:
    def test_registering_creates_a_booking_immediately(self, world_data):
        event = make_event()
        student = make_student("anna@test.com")
        membership = make_membership()

        res = book(student, event, membership)

        assert res.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get(user=student)
        assert contribution.status == ContributionStatus.ACCEPTED
        booking = Booking.objects.get(user=student, event=event)
        assert booking.contribution == contribution

    def test_booking_carries_the_chosen_role(self, world_data):
        event_type, leader, _follower = make_partner_role_type()
        event = make_event(event_type)
        student = make_student("anna@test.com")
        membership = make_membership()

        book(student, event, membership, role=leader)

        assert Booking.objects.get(user=student, event=event).role == leader

    def test_couple_booking_pairs_both_users_on_creation(self, world_data):
        """Registering with a partner_id auto-mirrors a contribution for
        the partner (service._create_partner_contribution) — a single
        POST, not two. Auto-partnering used to only happen at payment
        time (add_payed_bookings); now that Booking rows exist from
        registration, both sides must already be paired."""
        event_type, leader, follower = make_partner_role_type()
        event = make_event(event_type)
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        membership = make_membership()

        res = book(anna, event, membership, role=leader, partner_id=bruno.id)
        assert res.status_code == http_status.HTTP_201_CREATED

        anna_booking = Booking.objects.get(user=anna, event=event)
        bruno_booking = Booking.objects.get(user=bruno, event=event)
        assert anna_booking.partner == bruno
        assert anna_booking.couple is True
        assert bruno_booking.partner == anna
        assert bruno_booking.couple is True
        assert bruno_booking.role == follower


# ── Case 2: regular repeating class ───────────────────────────────────────────

class TestEagerBookingRegularRepeatingClass:
    def test_registering_creates_bookings_for_parent_and_all_children(self, world_data):
        parent, children = make_parent_with_children(3)
        student = make_student("anna@test.com")
        membership = make_membership()

        res = book(student, parent, membership)

        assert res.status_code == http_status.HTTP_201_CREATED
        for target in [parent, *children]:
            assert Booking.objects.filter(user=student, event=target).exists()

    def test_bookings_carry_the_same_role_on_every_session(self, world_data):
        event_type, leader, _follower = make_partner_role_type()
        parent, children = make_parent_with_children(2, event_type=event_type)
        student = make_student("anna@test.com")
        membership = make_membership()

        book(student, parent, membership, role=leader)

        for target in [parent, *children]:
            assert Booking.objects.get(user=student, event=target).role == leader

    def test_existing_booking_is_not_overwritten(self, world_data):
        """An admin may have already re-arranged the register for one of
        the sessions before the student (re-)registers; that row must be
        left untouched, exactly like the payment-time behaviour."""
        event_type, leader, follower = make_partner_role_type()
        parent, children = make_parent_with_children(1, event_type=event_type)
        student = make_student("anna@test.com")
        membership = make_membership()
        Booking.objects.create(user=student, event=parent, role=follower)

        book(student, parent, membership, role=leader)

        assert Booking.objects.filter(user=student, event=parent).count() == 1
        assert Booking.objects.get(user=student, event=parent).role == follower
        # The child session is still booked fresh with the chosen role.
        assert Booking.objects.get(user=student, event=children[0]).role == leader


# ── Booking exists regardless of the contribution's resulting status ─────────

class TestEagerBookingRegardlessOfStatus:
    def test_waiting_list_contribution_still_gets_a_booking(self, world_data):
        """The event detail page shows what has been booked, not what the
        user is allowed to do — a waiting-list user already sees their
        real status on the contribution itself."""
        event = make_event(capacity=2)
        membership = make_membership()
        students = [make_student(f"solo{i}@test.com") for i in range(3)]

        for student in students:
            res = book(student, event, membership)
            assert res.status_code == http_status.HTTP_201_CREATED

        statuses = [Contribution.objects.get(user=s).status for s in students]
        assert statuses[:2] == [ContributionStatus.ACCEPTED] * 2
        assert statuses[2] == ContributionStatus.WAITING
        for student in students:
            assert Booking.objects.filter(user=student, event=event).exists()

    def test_available_spot_still_counts_contributions_not_bookings(self, world_data):
        """Capacity math is unaffected by the timing change: it's driven
        by Contribution status (ACCEPTED/PAYED), never by Booking rows."""
        event = make_event(capacity=2)
        membership = make_membership()
        students = [make_student(f"solo{i}@test.com") for i in range(3)]

        for student in students:
            book(student, event, membership)

        event.refresh_from_db()
        # 2 accepted + 1 waiting: only the 2 accepted count against capacity.
        assert event.available_spot == 0
