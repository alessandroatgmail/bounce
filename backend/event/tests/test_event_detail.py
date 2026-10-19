"""
GET /api/events/events/<id>/detail/ — each child event nested under
"events" must say whether the current user already has a Booking for it,
regardless of whether a Contribution backs that booking.

This matters for a free-choice festival: a user added as someone else's
partner gets a plain Booking with no Contribution of their own (see
FreeFestivalContributionSerializer.create()) — when that partner later
opens this same festival's page to register themselves, the frontend
needs to know which child events are already theirs so it can show them
pre-selected and locked, instead of letting the partner pick (or
unknowingly double-book) a class they're already in.
"""
import pytest
from datetime import timedelta
from django.utils import timezone

from booking.models import Booking
from event.models import Event, EventType, Status
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db


def make_event(event_type, start_date):
    payload = make_event_payload(event_type_id=event_type.pk)
    return Event.objects.create(
        name=payload["name"],
        # Published — EventDetailView only serves published events to a
        # non-staff client.
        status=Status.PUBLISHED,
        event_type=event_type,
        type=payload["type"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


def make_festival_with_children(n_children=2):
    event_type = EventType.objects.create(**make_event_type_payload())
    now = timezone.now()
    festival = make_event(event_type, now - timedelta(days=1))
    festival.multi_events = True
    festival.save()
    children = [make_event(event_type, now + timedelta(hours=i + 1)) for i in range(n_children)]
    festival.events.set(children)
    return festival, children


def test_already_booked_is_true_only_for_the_childs_own_booking(
    student_client, student_user, world_data,
):
    festival, children = make_festival_with_children(n_children=2)
    # A plain Booking with no Contribution at all — same shape as a
    # free-festival partner pairing.
    Booking.objects.create(user=student_user, event=children[0])

    response = student_client.get(f"/api/events/events/{festival.id}/detail/")

    assert response.status_code == 200
    by_id = {ev["id"]: ev for ev in response.data["events"]}
    assert by_id[children[0].id]["already_booked"] is True
    assert by_id[children[1].id]["already_booked"] is False


def test_already_booked_is_false_for_anonymous_request(world_data):
    from rest_framework.test import APIClient
    festival, children = make_festival_with_children(n_children=1)

    response = APIClient().get(f"/api/events/events/{festival.id}/detail/")

    assert response.status_code == 200
    assert response.data["events"][0]["already_booked"] is False
