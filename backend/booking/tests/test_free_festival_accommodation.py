"""
Case 4 (free-choice festival) with an accommodation extra item: the student
can optionally ask for accommodation alongside their chosen classes, via an
`accommodation` object validated by AccommodationSelectionSerializer
(extra_item/event/type/roommate_emails — see test_accommodation_selection.py).

This always bills the extra item (adds it to contribution.extra_items), and
also assigns a room immediately:
- single-occupancy (occupants_per_room=1 — e.g. "Singola"): no one to share
  with, so the student is simply the room's sole occupant.
- mixed/male/female, occupancy > 1: joins an existing room of that same
  type for this extra_item/event that still has a free bed, or creates a
  new one if every existing room is full (or none exist yet) —
  respecting the type's available_rooms cap, same as the admin-created
  path.
- friends: always creates a brand new room (never joins another group's)
  with the student and every validated roommate — only overall room
  availability (available_rooms) is checked.
If no room is or can be made available, the whole registration is
rejected (400) before any Contribution is created.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import AccommodationRoom, AccommodationType, AccomodationRoomType, Booking, Contribution, ExtraItem
from event.models import Event, EventType, Location
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload
from utils.mock_location import make_location_payload

pytestmark = pytest.mark.django_db

LIST_URL = "/api/booking/my-memberships/book-free-festival/"


# ── Helpers (mirrors test_free_festival_booking.py) ───────────────────────────

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


def make_free_festival(membership, n_children=1):
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


def entry(event, role_id=None, partner_id=None):
    return {"event_id": event.id, "role_id": role_id, "partner_id": partner_id}


def make_accommodation_extra_item(event, location):
    extra_item = ExtraItem.objects.create(
        name='Airone Triple', name_it='Airone Tripla', name_en='Airone Triple', value=120,
    )
    AccommodationType.objects.create(
        extra_item=extra_item, location=location, occupants_per_room=3, available_rooms=5,
    )
    event.available_extra_items.add(extra_item)
    return extra_item


def make_single_occupancy_extra_item(event, location, available_rooms=5):
    extra_item = ExtraItem.objects.create(
        name='Singola', name_it='Singola', name_en='Single', value=60,
    )
    AccommodationType.objects.create(
        extra_item=extra_item, location=location, occupants_per_room=1, available_rooms=available_rooms,
    )
    event.available_extra_items.add(extra_item)
    return extra_item


def make_mixed_accommodation_extra_item(event, location, occupants_per_room=3, available_rooms=2):
    extra_item = ExtraItem.objects.create(
        name='Falco Triple', name_it='Falco Tripla', name_en='Falco Triple', value=100,
    )
    AccommodationType.objects.create(
        extra_item=extra_item, location=location,
        occupants_per_room=occupants_per_room, available_rooms=available_rooms,
    )
    event.available_extra_items.add(extra_item)
    return extra_item


def make_student(email):
    return User.objects.create_user(email=email, password='StrongPass123!', is_active=True)


# ── Tests ──────────────────────────────────────────────────────────────────

class TestFreeFestivalAccommodation:
    def test_accommodation_is_optional(self, student_client, student_user, world_data):
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)

        response = student_client.post(
            LIST_URL,
            {"membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get()
        assert contribution.extra_items.count() == 0

    def test_valid_accommodation_bills_the_extra_item(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_accommodation_extra_item(festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution = Contribution.objects.get()
        assert list(contribution.extra_items.all()) == [extra_item]

    def test_single_occupancy_accommodation_creates_room_with_user(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1, contribution=50)
        festival, children = make_free_festival(m)
        extra_item = make_single_occupancy_extra_item(festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        room = AccommodationRoom.objects.get(extra_item=extra_item, event=festival)
        assert list(room.users.all()) == [student_user]

    def test_single_occupancy_accommodation_contribution_total_includes_extra_item_value(
        self, student_client, student_user, world_data,
    ):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1, contribution=50)
        festival, children = make_free_festival(m)
        extra_item = make_single_occupancy_extra_item(festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution = Contribution.objects.get()
        assert contribution.discounted_amount == Decimal('50') + extra_item.value

    def test_mixed_room_joins_existing_partially_occupied_room(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.MIXED,
        )
        existing_room.users.add(make_student('already-in-room@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1
        existing_room.refresh_from_db()
        assert student_user in existing_room.users.all()

    def test_mixed_room_creates_new_room_when_none_exist(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        room = AccommodationRoom.objects.get(extra_item=extra_item, event=festival)
        assert room.type == AccomodationRoomType.MIXED
        assert list(room.users.all()) == [student_user]

    def test_mixed_room_creates_new_room_when_existing_ones_are_full(
        self, student_client, student_user, world_data,
    ):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(
            festival, location, occupants_per_room=2, available_rooms=2,
        )
        full_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.MIXED,
        )
        full_room.users.add(make_student('full1@bounce.com'), make_student('full2@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 2
        new_room = AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).exclude(
            pk=full_room.pk,
        ).get()
        assert list(new_room.users.all()) == [student_user]

    def test_female_room_joins_existing_partially_occupied_room(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FEMALE,
        )
        existing_room.users.add(make_student('already-in-room@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FEMALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1
        existing_room.refresh_from_db()
        assert student_user in existing_room.users.all()

    def test_female_room_creates_new_room_when_none_exist(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FEMALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        room = AccommodationRoom.objects.get(extra_item=extra_item, event=festival)
        assert room.type == AccomodationRoomType.FEMALE
        assert list(room.users.all()) == [student_user]

    def test_female_room_raises_error_when_no_rooms_available(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(
            festival, location, occupants_per_room=2, available_rooms=1,
        )
        full_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FEMALE,
        )
        full_room.users.add(make_student('full1@bounce.com'), make_student('full2@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FEMALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST, response.data
        assert Contribution.objects.count() == 0
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1

    def test_male_room_joins_existing_partially_occupied_room(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.MALE,
        )
        existing_room.users.add(make_student('already-in-room@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1
        existing_room.refresh_from_db()
        assert student_user in existing_room.users.all()

    def test_male_room_creates_new_room_when_none_exist(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        room = AccommodationRoom.objects.get(extra_item=extra_item, event=festival)
        assert room.type == AccomodationRoomType.MALE
        assert list(room.users.all()) == [student_user]

    def test_male_room_raises_error_when_no_rooms_available(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(
            festival, location, occupants_per_room=2, available_rooms=1,
        )
        full_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.MALE,
        )
        full_room.users.add(make_student('full1@bounce.com'), make_student('full2@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MALE,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST, response.data
        assert Contribution.objects.count() == 0
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1

    def test_accommodation_extra_item_not_on_event_rejected(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        other_festival, _ = make_free_festival(make_membership(max_events=1))
        extra_item = make_accommodation_extra_item(other_festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.MIXED,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_friends_room_without_roommates_rejected(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_accommodation_extra_item(festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS,
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_friends_room_with_valid_roommate_succeeds(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        roommate = User.objects.create_user(
            email='roommate@bounce.com', password='StrongPass123!', is_active=True,
        )
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_accommodation_extra_item(festival, location)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [roommate.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution = Contribution.objects.get()
        assert list(contribution.extra_items.all()) == [extra_item]

    def test_friends_room_creates_new_room_with_all_roommates(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        roommate = User.objects.create_user(
            email='roommate@bounce.com', password='StrongPass123!', is_active=True,
        )
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [roommate.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        room = AccommodationRoom.objects.get(extra_item=extra_item, event=festival)
        assert room.type == AccomodationRoomType.FRIENDS
        assert set(room.users.all()) == {student_user, roommate}

    def test_friends_room_each_request_creates_its_own_new_room(self, student_client, student_user, world_data):
        """Friends never join someone else's room, even if it has free beds —
        only availability (room count vs available_rooms) is checked."""
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        roommate = User.objects.create_user(
            email='roommate@bounce.com', password='StrongPass123!', is_active=True,
        )
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)
        other_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FRIENDS,
        )
        other_room.users.add(make_student('other-friend@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [roommate.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 2
        new_room = AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).exclude(
            pk=other_room.pk,
        ).get()
        assert set(new_room.users.all()) == {student_user, roommate}

    def test_friends_room_raises_error_when_no_rooms_available(self, student_client, student_user, world_data):
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        roommate = User.objects.create_user(
            email='roommate@bounce.com', password='StrongPass123!', is_active=True,
        )
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(
            festival, location, occupants_per_room=3, available_rooms=1,
        )
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FRIENDS,
        )
        existing_room.users.add(make_student('already-in-room@bounce.com'))

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [roommate.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST, response.data
        assert Contribution.objects.count() == 0
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1

    def test_friends_room_resubmission_by_already_seated_roommate_joins_existing_room(
        self, student_client, student_user, world_data,
    ):
        """student_user was added to a friends room by someone else's
        earlier registration (room.users.add() in create()) before ever
        registering themselves — their own registration must join that
        same room, not create a second one."""
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(festival, location, occupants_per_room=3)
        other_friend = make_student('friend@bounce.com')
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FRIENDS,
        )
        existing_room.users.add(other_friend, student_user)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [other_friend.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1
        existing_room.refresh_from_db()
        assert set(existing_room.users.all()) == {other_friend, student_user}

    def test_friends_room_resubmission_by_already_seated_roommate_skips_capacity_check(
        self, student_client, student_user, world_data,
    ):
        """Same as above, but available_rooms is already fully used by the
        one room student_user is already in — that must not block their
        own registration, since no new room is needed."""
        location = Location.objects.create(**make_location_payload(name='Hotel Airone'))
        m = make_membership(max_events=1)
        festival, children = make_free_festival(m)
        extra_item = make_mixed_accommodation_extra_item(
            festival, location, occupants_per_room=3, available_rooms=1,
        )
        other_friend = make_student('friend@bounce.com')
        existing_room = AccommodationRoom.objects.create(
            extra_item=extra_item, event=festival, type=AccomodationRoomType.FRIENDS,
        )
        existing_room.users.add(other_friend, student_user)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])],
                "accommodation": {
                    "event_id": festival.id, "extra_item_id": extra_item.id,
                    "type": AccomodationRoomType.FRIENDS, "roommate_emails": [other_friend.email],
                },
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert AccommodationRoom.objects.filter(extra_item=extra_item, event=festival).count() == 1
