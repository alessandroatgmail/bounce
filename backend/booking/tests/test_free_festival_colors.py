"""
Per-child-event availability colors for a free-choice festival
(event.multi_events=True, event.free=True) —
GET /api/events/events/<festival_id>/children-availability/.

Unlike the fixed-choice case's children_levels (one color per level,
since booking a level books every one of its classes as a bundle), a
free-choice festival books each child individually, so each child gets
its own color(s) per partner role, computed independently of every
other child. This reuses the exact same event._level_colors /
_role_would_be_accepted math already proven by
test_availability_colors_scenario.py, just evaluated per child instead
of per representative-level-child — and counts per-child roles from
Booking rather than Contribution, since one free-choice contribution
can cover several events, each with its own role.

The endpoint returns [] for anything that isn't a free-choice festival,
mirroring how children_levels returns [] for anything that is.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from event.models import Event, EventType, PartnerRole
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"


def availability_url(festival_id):
    return f"{EVENTS_URL}{festival_id}/children-availability/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_student(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email, password="StrongPass123!",
        first_name=local.capitalize(), last_name="Test", is_active=True,
    )


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_event(event_type, start_date, capacity=10, extras=0, warning_threshold=3, accepted_roles=None):
    payload = make_event_payload(event_type_id=event_type.pk)
    event = Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=capacity,
        extras=extras,
        warning_threshold=warning_threshold,
    )
    if accepted_roles:
        event.accepted_roles.set(accepted_roles)
    return event


def make_membership(max_events=1, **overrides):
    defaults = {"name": "Festival Plan", "contribution": 50, "max_events": max_events, "duration": 0}
    defaults.update(overrides)
    return Membership.objects.create(**defaults)


def make_free_festival(membership, n_children=2, with_roles=True, **child_kwargs):
    """A free-choice multi_events festival with `n_children` children,
    linked to `membership`. With roles (default): two partner roles,
    Leader/Follower, both accepted on every child. Without: a
    no-partner event type, so colors key on 'default'."""
    partners = 2 if with_roles else 0
    event_type = EventType.objects.create(**make_event_type_payload(partners=partners))
    roles = {}
    accepted_roles = None
    if with_roles:
        leader = PartnerRole.objects.create(name="Leader")
        follower = PartnerRole.objects.create(name="Follower")
        event_type.partner_roles.set([leader, follower])
        roles = {"Leader": leader, "Follower": follower}
        accepted_roles = [leader, follower]

    now = timezone.now()
    festival = make_event(event_type, now - timedelta(days=1))
    festival.multi_events = True
    festival.free = True
    festival.save()
    festival.memberships.add(membership)

    children = [
        make_event(event_type, now + timedelta(hours=i + 1), accepted_roles=accepted_roles, **child_kwargs)
        for i in range(n_children)
    ]
    festival.events.set(children)
    return festival, children, roles


def book_single(student, festival, membership, child, role=None):
    """One student books exactly one child event, alone, with `role`."""
    payload = {
        "membership_id": membership.pk,
        "event_id": festival.id,
        "event_ids": [{"event_id": child.id, "role_id": role.id if role else None}],
    }
    response = client_for(student).post(MY_MEMBERSHIPS_URL, payload, format="json")
    assert response.status_code == http_status.HTTP_201_CREATED, response.data
    return response


def colors_by_child(client, festival_id):
    response = client.get(availability_url(festival_id))
    assert response.status_code == http_status.HTTP_200_OK, response.data
    return {row["event_id"]: row["colors"] for row in response.data}


# ── Scope: only a free-choice festival returns anything ───────────────────────

class TestChildrenAvailabilityScope:

    def test_fixed_choice_festival_returns_empty(self, admin_client, world_data):
        event_type = EventType.objects.create(**make_event_type_payload(partners=0))
        festival = make_event(event_type, timezone.now() + timedelta(days=1))
        festival.multi_events = True
        festival.free = False
        festival.save()

        response = admin_client.get(availability_url(festival.id))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data == []

    def test_plain_event_returns_empty(self, admin_client, world_data):
        event_type = EventType.objects.create(**make_event_type_payload(partners=0))
        event = make_event(event_type, timezone.now() + timedelta(days=1))

        response = admin_client.get(availability_url(event.id))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data == []


# ── Colors per child, independent of other children ──────────────────────────

class TestChildrenAvailabilityColors:

    def test_fresh_children_are_green(self, admin_client, world_data):
        m = make_membership()
        festival, children, roles = make_free_festival(m, n_children=2)

        by_child = colors_by_child(admin_client, festival.id)

        for child in children:
            assert by_child[child.id] == {"Leader": "green", "Follower": "green"}

    def test_role_imbalance_turns_orange_without_affecting_other_children(
        self, admin_client, world_data,
    ):
        m = make_membership()
        festival, children, roles = make_free_festival(
            m, n_children=2, capacity=10, extras=2, warning_threshold=3,
        )
        child_a, child_b = children

        # Fill child_a with 2 Leaders and nothing else: min_count=0,
        # max_count=2 == min_count(0) + extras(2) -> no longer accepted.
        book_single(make_student("s1@test.com"), festival, m, child_a, role=roles["Leader"])
        book_single(make_student("s2@test.com"), festival, m, child_a, role=roles["Leader"])

        by_child = colors_by_child(admin_client, festival.id)
        assert by_child[child_a.id]["Leader"] == "orange"
        assert by_child[child_a.id]["Follower"] == "green"
        # child_b was never touched — must stay fully green.
        assert by_child[child_b.id] == {"Leader": "green", "Follower": "green"}

    def test_full_capacity_is_red_for_every_role(self, admin_client, world_data):
        m = make_membership()
        festival, children, roles = make_free_festival(
            m, n_children=1, capacity=2, extras=0, warning_threshold=1,
        )
        child = children[0]

        book_single(make_student("s1@test.com"), festival, m, child, role=roles["Leader"])
        book_single(make_student("s2@test.com"), festival, m, child, role=roles["Follower"])

        by_child = colors_by_child(admin_client, festival.id)
        assert by_child[child.id] == {"Leader": "red", "Follower": "red"}

    def test_warning_threshold_turns_yellow(self, admin_client, world_data):
        # No partner role, so there's no role-imbalance math to interact
        # with — purely available_spot vs. warning_threshold.
        m = make_membership()
        festival, children, _roles = make_free_festival(
            m, n_children=1, with_roles=False, capacity=3, extras=0, warning_threshold=2,
        )
        child = children[0]

        book_single(make_student("s1@test.com"), festival, m, child)

        by_child = colors_by_child(admin_client, festival.id)
        # available_spot = 3 - 1 = 2 <= warning_threshold(2) -> yellow.
        assert by_child[child.id] == {"default": "yellow"}

    def test_no_partner_role_event_uses_default_key(self, admin_client, world_data):
        m = make_membership()
        festival, children, _roles = make_free_festival(
            m, n_children=1, with_roles=False, capacity=2, extras=0, warning_threshold=1,
        )
        child = children[0]

        by_child = colors_by_child(admin_client, festival.id)
        assert by_child[child.id] == {"default": "green"}

        book_single(make_student("s1@test.com"), festival, m, child)
        book_single(make_student("s2@test.com"), festival, m, child)

        by_child = colors_by_child(admin_client, festival.id)
        assert by_child[child.id] == {"default": "red"}
