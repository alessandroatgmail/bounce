"""
Case 4 — festival, free choice: event.multi_events=True, event.free=True.

Unlike Case 3 (fixed choice: one level + role picked once, applied to
every child at that level — see test_festival_booking.py), a free-choice
festival lets the student pick any set of child events themselves, each
with its own role. That set is submitted as `event_ids` alongside the
usual `event_id` (the festival/parent) on the regular
POST /api/booking/my-memberships/ endpoint — this case was never routed
through the dedicated book-festival/ endpoint, since there's no single
level to apply. Each entry is an object: `{"event_id": ..., "role_id":
...}` — `role_id` is null/omitted for a child whose event type has no
partner role.

Contract under test (nothing else about Case 4 yet — no event_ids,
or the wrong number of event_ids, must be rejected before anything is
created):
- `event_ids` is required when booking a free-choice festival; omitting
  it returns 400.
- The number of entries given (not counting the parent/festival itself)
  must equal the membership's `max_events`; a mismatched count returns
  400.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution
from event.models import Event, EventType
from membership.models import Membership
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

LIST_URL = "/api/booking/my-memberships/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event(event_type, start_date, capacity=None):
    payload = make_event_payload(event_type_id=event_type.pk)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=capacity if capacity is not None else payload["capacity"],
    )


def make_free_festival(membership, n_children=3):
    """A free-choice multi_events festival (event.free=True) with
    `n_children` child events, linked to `membership` so
    _validate_membership_events accepts it."""
    event_type = EventType.objects.create(**make_event_type_payload())
    now = timezone.now()
    festival = make_event(event_type, now - timedelta(days=1))
    festival.multi_events = True
    festival.free = True
    festival.save()
    festival.memberships.add(membership)
    children = [
        make_event(event_type, now + timedelta(hours=i + 1))
        for i in range(n_children)
    ]
    festival.events.set(children)
    return festival, children


def make_membership(max_events, **overrides):
    defaults = {"name": "Festival Plan", "contribution": 50, "max_events": max_events, "duration": 0}
    defaults.update(overrides)
    return Membership.objects.create(**defaults)


def entry(event, role_id=None):
    """One `event_ids` list entry — role_id stays null for an event
    whose type has no partner role."""
    return {"event_id": event.id, "role_id": role_id}


# ── event_ids is required ─────────────────────────────────────────────────────

class TestFreeFestivalRequiresEventIds:

    def test_missing_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, _children = make_free_festival(m)

        response = student_client.post(
            LIST_URL, {"membership_id": m.pk, "event_id": festival.id}, format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_empty_event_ids_list_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, _children = make_free_festival(m)

        response = student_client.post(
            LIST_URL,
            {"membership_id": m.pk, "event_id": festival.id, "event_ids": []},
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0


# ── event_ids count must match the membership's max_events ───────────────────

class TestFreeFestivalEventIdsCountMustMatchMaxEvents:

    def test_too_few_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {"membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_too_many_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(c) for c in children],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_matching_count_is_accepted(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(children[0]), entry(children[1])],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get(pk=response.data["id"])
        assert set(contribution.events.values_list("id", flat=True)) == {
            children[0].id, children[1].id,
        }
        assert Booking.objects.filter(
            user=student_user, event_id__in=[children[0].id, children[1].id],
        ).count() == 2


# ── Membership fix_events are booked alongside the chosen events ─────────────

class TestFreeFestivalFixEvents:
    """A membership's fix_events (bonus events bundled with the plan
    regardless of what the student picks — e.g. a festival party) are
    always booked alongside whatever was explicitly chosen, same as the
    fixed-choice festival case already does."""

    def test_books_selected_events_plus_fixed_events(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        party_type = EventType.objects.create(**make_event_type_payload())
        now = timezone.now()
        party1 = make_event(party_type, now + timedelta(hours=5))
        party2 = make_event(party_type, now + timedelta(hours=6))
        m.fix_events.set([party1, party2])

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(children[0]), entry(children[1])],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get(pk=response.data["id"])
        assert set(contribution.events.values_list("id", flat=True)) == {
            children[0].id, children[1].id, party1.id, party2.id,
        }
        assert Booking.objects.filter(
            user=student_user,
            event_id__in=[children[0].id, children[1].id, party1.id, party2.id],
        ).count() == 4
