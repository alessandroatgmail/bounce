"""
Case 3 — festival, fixed choice: level + role + partner are chosen once and
apply to every child event at that level (event.multi_events=True,
event.free=False).

Booking now goes through a dedicated endpoint,
POST /api/booking/my-memberships/book-festival/, which requires level_id
and only accepts a fixed-choice festival event. The generic
POST /api/booking/my-memberships/ rejects that event shape and points
callers here instead.

The waiting-list/capacity/partner/cancellation mechanics for this case are
already exhaustively covered by test_bounce_blues_festival.py (migrated to
this endpoint); this file covers only what's new: routing/validation
between the two endpoints, and that eager booking creation expands to the
chosen level's children specifically.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, EventType, Level, PartnerRole
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"
BOOK_FESTIVAL_URL = "/api/booking/my-memberships/book-festival/"


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


def make_event(event_type, start_date, level=None, capacity=None, accepted_roles=None):
    payload = make_event_payload(event_type_id=event_type.pk)
    event = Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        level=level,
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=capacity if capacity is not None else payload["capacity"],
    )
    if accepted_roles:
        event.accepted_roles.set(accepted_roles)
    return event


def make_festival_with_levels(event_type=None, accepted_roles=None):
    """A non-free multi_events festival with two levels, two child
    classes each."""
    event_type = event_type or EventType.objects.create(**make_event_type_payload())
    level_a = Level.objects.create(name="Level A")
    level_b = Level.objects.create(name="Level B")
    now = timezone.now()
    festival = make_event(event_type, now - timedelta(days=1), accepted_roles=accepted_roles)
    festival.multi_events = True
    festival.save()
    children_a = [
        make_event(event_type, now + timedelta(hours=i + 1), level=level_a, accepted_roles=accepted_roles)
        for i in range(2)
    ]
    children_b = [
        make_event(event_type, now + timedelta(hours=i + 1), level=level_b, accepted_roles=accepted_roles)
        for i in range(2)
    ]
    festival.events.set(children_a + children_b)
    return festival, level_a, level_b, children_a, children_b


def book_festival(student, festival, membership, level, role=None, partner_id=None):
    # A membership must be linked to the festival to book it at all
    # (_validate_membership_events) — link it here so every test doesn't
    # have to repeat the step.
    festival.memberships.add(membership)
    client = APIClient()
    client.force_authenticate(user=student)
    payload = {"membership_id": membership.pk, "event_id": festival.pk, "level_id": level.pk}
    if role is not None:
        payload["role_id"] = role.pk
    if partner_id is not None:
        payload["partner_id"] = partner_id
    return client.post(BOOK_FESTIVAL_URL, payload, format="json")


# ── Endpoint routing ───────────────────────────────────────────────────────────

class TestFestivalEndpointRouting:
    def test_generic_endpoint_rejects_a_fixed_choice_festival(self, world_data):
        festival, level_a, _lb, _ca, _cb = make_festival_with_levels()
        student = make_student("anna@test.com")
        membership = make_membership()
        client = APIClient()
        client.force_authenticate(user=student)

        res = client.post(
            MY_MEMBERSHIPS_URL,
            {"membership_id": membership.pk, "event_id": festival.pk, "level_id": level_a.pk},
            format="json",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_festival_endpoint_requires_level_id(self, world_data):
        festival, _la, _lb, _ca, _cb = make_festival_with_levels()
        student = make_student("anna@test.com")
        membership = make_membership()
        client = APIClient()
        client.force_authenticate(user=student)

        res = client.post(
            BOOK_FESTIVAL_URL,
            {"membership_id": membership.pk, "event_id": festival.pk},
            format="json",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_festival_endpoint_rejects_a_single_event(self, world_data):
        event_type = EventType.objects.create(**make_event_type_payload())
        event = make_event(event_type, timezone.now() + timedelta(days=7))
        level = Level.objects.create(name="Solo level")
        student = make_student("anna@test.com")
        membership = make_membership()
        client = APIClient()
        client.force_authenticate(user=student)

        res = client.post(
            BOOK_FESTIVAL_URL,
            {"membership_id": membership.pk, "event_id": event.pk, "level_id": level.pk},
            format="json",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_festival_endpoint_rejects_a_free_choice_festival(self, world_data):
        festival, level_a, _lb, _ca, _cb = make_festival_with_levels()
        festival.free = True
        festival.save()
        student = make_student("anna@test.com")
        membership = make_membership()

        res = book_festival(student, festival, membership, level_a)
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Eager booking, level-scoped ────────────────────────────────────────────────

class TestFestivalEagerBooking:
    def test_registering_books_only_the_chosen_level_children(self, world_data):
        festival, level_a, _level_b, children_a, children_b = make_festival_with_levels()
        student = make_student("anna@test.com")
        membership = make_membership()

        res = book_festival(student, festival, membership, level_a)

        assert res.status_code == http_status.HTTP_201_CREATED
        assert Booking.objects.filter(user=student, event=festival).exists()
        for child in children_a:
            assert Booking.objects.filter(user=student, event=child).exists()
        for child in children_b:
            assert not Booking.objects.filter(user=student, event=child).exists()

    def test_booking_exists_regardless_of_resulting_status(self, world_data):
        festival, level_a, _level_b, children_a, _children_b = make_festival_with_levels()
        # capacity=2 on every level-A child forces the 3rd registrant to WAITING
        for child in children_a:
            child.capacity = 2
            child.save()
        membership = make_membership()
        students = [make_student(f"solo{i}@test.com") for i in range(3)]

        for student in students:
            res = book_festival(student, festival, membership, level_a)
            assert res.status_code == http_status.HTTP_201_CREATED

        statuses = [Contribution.objects.get(user=s).status for s in students]
        assert statuses[:2] == [ContributionStatus.ACCEPTED] * 2
        assert statuses[2] == ContributionStatus.WAITING
        for student in students:
            assert Booking.objects.filter(user=student, event=festival).exists()

    def test_couple_booking_pairs_both_users_immediately(self, world_data):
        event_type = EventType.objects.create(**make_event_type_payload(partners=2))
        leader = PartnerRole.objects.get_or_create(name="Leader")[0]
        follower = PartnerRole.objects.get_or_create(name="Follower")[0]
        event_type.partner_roles.set([leader, follower])
        festival, level_a, _level_b, children_a, _children_b = make_festival_with_levels(
            event_type=event_type, accepted_roles=[leader, follower],
        )
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        membership = make_membership()

        res = book_festival(anna, festival, membership, level_a, role=leader, partner_id=bruno.id)

        assert res.status_code == http_status.HTTP_201_CREATED
        assert Contribution.objects.get(user=anna).status == ContributionStatus.ACCEPTED
        assert Booking.objects.get(user=anna, event=festival).partner == bruno
        assert Booking.objects.get(user=bruno, event=festival).partner == anna
        for child in children_a:
            assert Booking.objects.get(user=bruno, event=child).partner == anna
