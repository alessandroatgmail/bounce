"""
AccommodationRoom — one physical room instance allocated for a specific
event: which accommodation ExtraItem (room type) it is, and the group of
users (occupants) sharing it. Allocation always spans the full event date
range, so there's no per-night granularity here.
"""
import pytest
from django.core.exceptions import ValidationError
from django.db import transaction

from booking.models import AccommodationRoom, AccommodationType, AccomodationRoomType, ExtraItem
from event.models import Event, Location
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_location import make_location_payload


@pytest.fixture
def extra_item(db):
    return ExtraItem.objects.create(
        name='Airone Triple', name_it='Airone Tripla', name_en='Airone Triple', value=120,
    )


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name='Hotel Airone'))


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    for key in ('style_ids', 'genre_ids', 'artist_ids', 'event_ids'):
        payload.pop(key)
    return Event.objects.create(**payload)


_counter = [0]


def make_user(**overrides):
    _counter[0] += 1
    email = overrides.pop('email', f'student{_counter[0]}@bounce.com')
    local = email.split('@')[0]
    return User.objects.create_user(
        email=email, password='StrongPass123!',
        first_name=overrides.pop('first_name', local.capitalize()),
        last_name=overrides.pop('last_name', 'Test'),
        is_active=True, **overrides,
    )


class TestAccommodationRoom:
    def test_create_with_extra_item_event_and_users(self, extra_item, event):
        user = make_user()
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        room.users.add(user)

        assert room.extra_item_id == extra_item.id
        assert room.event_id == event.id
        assert list(room.users.all()) == [user]

    def test_users_can_be_empty(self, extra_item, event):
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        assert room.users.count() == 0

    def test_can_group_multiple_users_in_one_room(self, extra_item, event):
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        u1 = make_user()
        u2 = make_user()
        room.users.set([u1, u2])
        assert set(room.users.values_list('id', flat=True)) == {u1.id, u2.id}

    def test_reverse_accessor_from_user(self, extra_item, event):
        user = make_user()
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        room.users.add(user)
        assert list(user.accommodation_rooms.all()) == [room]

    def test_reverse_accessor_from_event(self, extra_item, event):
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        assert list(event.accommodation_rooms.all()) == [room]

    def test_reverse_accessor_from_extra_item(self, extra_item, event):
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        assert list(extra_item.accommodation_rooms.all()) == [room]

    def test_multiple_rooms_of_the_same_extra_item_for_one_event(self, extra_item, event):
        room1 = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        room2 = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        assert set(event.accommodation_rooms.values_list('id', flat=True)) == {room1.id, room2.id}

    def test_cannot_exceed_occupants_per_room(self, extra_item, event, location):
        AccommodationType.objects.create(
            extra_item=extra_item, location=location, occupants_per_room=1, available_rooms=5,
        )
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        u1 = make_user()
        u2 = make_user()
        room.users.add(u1)
        with pytest.raises(ValidationError):
            with transaction.atomic():
                room.users.add(u2)
        assert list(room.users.values_list('id', flat=True)) == [u1.id]

    def test_cannot_create_more_rooms_than_available_rooms(self, extra_item, event, location):
        AccommodationType.objects.create(
            extra_item=extra_item, location=location, occupants_per_room=1, available_rooms=2,
        )
        AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        AccommodationRoom.objects.create(extra_item=extra_item, event=event)

        with pytest.raises(ValidationError):
            AccommodationRoom.objects.create(extra_item=extra_item, event=event)

        assert AccommodationRoom.objects.filter(extra_item=extra_item).count() == 2

    def test_type_defaults_to_mixed(self, extra_item, event):
        room = AccommodationRoom.objects.create(extra_item=extra_item, event=event)
        assert room.type == AccomodationRoomType.MIXED

    def test_type_can_be_set_explicitly(self, extra_item, event):
        room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=event, type=AccomodationRoomType.FEMALE,
        )
        assert room.type == AccomodationRoomType.FEMALE
