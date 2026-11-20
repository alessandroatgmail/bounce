"""
GET /api/events/events/<id>/detail/ — the festival event itself (not its
children) reports, for the logged-in user, whether they're already seated
in an AccommodationRoom for this event.

This matters for the "friends" room case: when a student lists a roommate
by email, that roommate is added straight to room.users (see
FreeFestivalContributionSerializer.create()) even though they haven't
registered for the festival themselves yet. When that roommate later opens
this same festival's page to register, the frontend needs to know they're
already seated — including who else is in the room — so it can
pre-populate and lock their own accommodation choice instead of asking
them to pick again from scratch.
"""
import pytest
from datetime import timedelta
from django.utils import timezone

from booking.models import AccommodationRoom, AccommodationType, AccomodationRoomType, ExtraItem
from event.models import Event, EventType, Location, Status
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload
from utils.mock_location import make_location_payload

pytestmark = pytest.mark.django_db


def make_event(event_type, start_date):
    payload = make_event_payload(event_type_id=event_type.pk)
    return Event.objects.create(
        name=payload["name"],
        status=Status.PUBLISHED,
        event_type=event_type,
        type=payload["type"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


def make_festival():
    event_type = EventType.objects.create(**make_event_type_payload())
    return make_event(event_type, timezone.now())


def make_accommodation_extra_item():
    location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
    extra_item = ExtraItem.objects.create(
        name='Airone Triple', name_it='Airone Tripla', name_en='Airone Triple', value=120,
    )
    AccommodationType.objects.create(
        extra_item=extra_item, location=location, occupants_per_room=3, available_rooms=5,
    )
    return extra_item


def make_other_user(email):
    return User.objects.create_user(email=email, password='StrongPass123!', is_active=True, first_name='Other', last_name='Friend')


def test_accommodation_assignment_is_null_when_not_in_any_room(student_client, student_user, world_data):
    festival = make_festival()

    response = student_client.get(f"/api/events/events/{festival.id}/detail/")

    assert response.status_code == 200
    assert response.data["accommodation_assignment"] is None


def test_accommodation_assignment_reflects_existing_room_membership(student_client, student_user, world_data):
    festival = make_festival()
    extra_item = make_accommodation_extra_item()
    roommate = make_other_user('roommate@bounce.com')
    room = AccommodationRoom.objects.create(
        extra_item=extra_item, event=festival, type=AccomodationRoomType.FRIENDS,
    )
    room.users.add(student_user, roommate)

    response = student_client.get(f"/api/events/events/{festival.id}/detail/")

    assert response.status_code == 200
    assignment = response.data["accommodation_assignment"]
    assert assignment["extra_item_id"] == extra_item.id
    assert assignment["type"] == AccomodationRoomType.FRIENDS
    assert assignment["roommates"] == [
        {"email": roommate.email, "first_name": roommate.first_name, "last_name": roommate.last_name},
    ]


def test_accommodation_assignment_is_false_for_anonymous_request(world_data):
    from rest_framework.test import APIClient
    festival = make_festival()

    response = APIClient().get(f"/api/events/events/{festival.id}/detail/")

    assert response.status_code == 200
    assert response.data["accommodation_assignment"] is None
