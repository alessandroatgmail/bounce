"""
AccommodationSelectionSerializer — validates what a student must choose to
request an accommodation extra item: which accommodation ExtraItem (room
class/location), what kind of room (AccomodationRoomType), and — only for a
"friends" room — who the roommates are (by email, each must already be a
registered, active user).
"""
from datetime import datetime, timedelta, timezone as dt_timezone

import pytest
from django.utils import timezone

from booking.models import AccommodationType, AccomodationRoomType, ExtraItem
from booking.serializers import AccommodationSelectionSerializer
from event.models import Event, Location
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_location import make_location_payload


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name='Hotel Airone'))


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    for key in ('style_ids', 'genre_ids', 'artist_ids', 'event_ids'):
        payload.pop(key)
    return Event.objects.create(**payload)


@pytest.fixture
def accommodation_extra_item(event, location):
    extra_item = ExtraItem.objects.create(
        name='Airone Triple', name_it='Airone Tripla', name_en='Airone Triple', value=120,
    )
    AccommodationType.objects.create(
        extra_item=extra_item, location=location, occupants_per_room=3, available_rooms=5,
    )
    event.available_extra_items.add(extra_item)
    return extra_item


_counter = [0]


def make_user(**overrides):
    _counter[0] += 1
    email = overrides.pop('email', f'student{_counter[0]}@bounce.com')
    is_active = overrides.pop('is_active', True)
    return User.objects.create_user(
        email=email, password='StrongPass123!', is_active=is_active, **overrides,
    )


class TestAccommodationSelectionSerializer:
    def test_valid_selection_without_roommates(self, event, accommodation_extra_item):
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.MIXED,
        })
        assert serializer.is_valid(), serializer.errors

    def test_rejects_extra_item_not_on_the_event(self, event, location):
        other_item = ExtraItem.objects.create(name='Other', name_it='Other', name_en='Other', value=50)
        AccommodationType.objects.create(
            extra_item=other_item, location=location, occupants_per_room=2, available_rooms=5,
        )
        # Note: never added to event.available_extra_items.
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': other_item.id,
            'type': AccomodationRoomType.MIXED,
        })
        assert not serializer.is_valid()
        assert 'extra_item_id' in serializer.errors

    def test_rejects_expired_extra_item(self, event, location):
        expired_item = ExtraItem.objects.create(
            name='Expired Room', name_it='Expired Room', name_en='Expired Room', value=80,
            expiration_date=datetime(2020, 1, 1, tzinfo=dt_timezone.utc),
        )
        AccommodationType.objects.create(
            extra_item=expired_item, location=location, occupants_per_room=2, available_rooms=5,
        )
        event.available_extra_items.add(expired_item)
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': expired_item.id,
            'type': AccomodationRoomType.MIXED,
        })
        assert not serializer.is_valid()
        assert 'extra_item_id' in serializer.errors

    def test_rejects_extra_item_that_is_not_an_accommodation(self, event):
        plain_item = ExtraItem.objects.create(name='T-Shirt', name_it='Maglietta', name_en='T-Shirt', value=15)
        event.available_extra_items.add(plain_item)
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': plain_item.id,
            'type': AccomodationRoomType.MIXED,
        })
        assert not serializer.is_valid()
        assert 'extra_item_id' in serializer.errors

    def test_friends_room_requires_roommates(self, event, accommodation_extra_item):
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.FRIENDS,
        })
        assert not serializer.is_valid()
        assert 'roommate_emails' in serializer.errors

    def test_friends_room_accepts_active_registered_roommates(self, event, accommodation_extra_item):
        roommate = make_user(email='roommate@bounce.com')
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.FRIENDS,
            'roommate_emails': [roommate.email],
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['roommates'] == [roommate]

    def test_friends_room_rejects_unregistered_roommate_email(self, event, accommodation_extra_item):
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.FRIENDS,
            'roommate_emails': ['nobody@bounce.com'],
        })
        assert not serializer.is_valid()
        assert 'roommate_emails' in serializer.errors

    def test_friends_room_rejects_inactive_roommate_email(self, event, accommodation_extra_item):
        roommate = make_user(email='inactive@bounce.com', is_active=False)
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.FRIENDS,
            'roommate_emails': [roommate.email],
        })
        assert not serializer.is_valid()
        assert 'roommate_emails' in serializer.errors

    def test_non_friends_room_rejects_roommates(self, event, accommodation_extra_item):
        roommate = make_user(email='roommate2@bounce.com')
        serializer = AccommodationSelectionSerializer(data={
            'event_id': event.id,
            'extra_item_id': accommodation_extra_item.id,
            'type': AccomodationRoomType.MIXED,
            'roommate_emails': [roommate.email],
        })
        assert not serializer.is_valid()
        assert 'roommate_emails' in serializer.errors
