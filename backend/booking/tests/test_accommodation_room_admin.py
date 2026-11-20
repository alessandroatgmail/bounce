"""
Admin CRUD for AccommodationRoom — allocating specific users (occupants)
into a physical room instance of a given AccommodationType, for a specific
event. Includes list filters (event, location, occupant name), the
occupation-rate calculated fields, and the AccomodationRoomType choices
endpoint used by the admin form's "type" select.
"""
import pytest
from rest_framework import status

from booking.models import (
    AccommodationRoom, AccommodationType, AccomodationRoomType, Contribution, ContributionStatus, ExtraItem,
)
from event.models import Location
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_location import make_location_payload

LIST_URL = "/api/booking/accommodation-rooms/"
TYPES_URL = "/api/booking/accommodation-rooms/types/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name="Hotel Airone"))


@pytest.fixture
def other_location(world_data):
    return Location.objects.create(**make_location_payload(name="Hotel Falco"))


@pytest.fixture
def extra_item(db, location):
    item = ExtraItem.objects.create(
        name="Airone Triple", name_it="Airone Tripla", name_en="Airone Triple", value=120,
    )
    AccommodationType.objects.create(
        extra_item=item, location=location, occupants_per_room=3, available_rooms=2,
    )
    return item


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    from event.models import Event
    return Event.objects.create(**payload)


@pytest.fixture
def other_event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    from event.models import Event
    return Event.objects.create(**payload)


def make_student(email, **overrides):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email, password="StrongPass123!",
        first_name=overrides.pop("first_name", local.capitalize()),
        last_name=overrides.pop("last_name", "Test"),
        is_active=True, **overrides,
    )


def make_user(email="student", **overrides):
    return make_student(f"{email}@bounce.com", **overrides)


def make_user_with_contribution(event, email="student", status=ContributionStatus.CONFIRMED, **overrides):
    """A user holding a Contribution for `event` with the given status —
    used to test paid_occupation_rate, which derives "paid" from this link
    rather than from any field stored directly on AccommodationRoom."""
    user = make_user(email=email, **overrides)
    contribution = Contribution.objects.create(user=user, amount=0, status=status)
    contribution.events.add(event)
    return user


def make_room(extra_item, event, **overrides):
    return AccommodationRoom.objects.create(extra_item=extra_item, event=event, **overrides)


# ── Permissions ──────────────────────────────────────────────────────────────

class TestAccommodationRoomPermissions:
    def test_unauthenticated_request_returns_401(self, client, extra_item, event):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list(self, student_client, extra_item, event):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create(self, student_client, extra_item, event):
        response = student_client.post(
            LIST_URL, {"extra_item_id": extra_item.pk, "event_id": event.pk}, format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, extra_item, event):
        room = make_room(extra_item, event)
        response = student_client.delete(detail_url(room.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Create ───────────────────────────────────────────────────────────────────

class TestAccommodationRoomCreate:
    def test_admin_can_create(self, admin_client, extra_item, event):
        response = admin_client.post(
            LIST_URL, {"extra_item_id": extra_item.pk, "event_id": event.pk}, format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["extra_item"]["id"] == extra_item.pk
        assert response.data["event"]["id"] == event.pk
        assert response.data["users"] == []
        assert response.data["type"] == AccomodationRoomType.MIXED

    def test_create_missing_extra_item_returns_400(self, admin_client, event):
        response = admin_client.post(LIST_URL, {"event_id": event.pk}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_can_assign_users(self, admin_client, extra_item, event):
        u1 = make_user(email="u1")
        u2 = make_user(email="u2")
        response = admin_client.post(
            LIST_URL,
            {"extra_item_id": extra_item.pk, "event_id": event.pk, "user_ids": [u1.pk, u2.pk]},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert {u["id"] for u in response.data["users"]} == {u1.pk, u2.pk}

    def test_create_can_set_type(self, admin_client, extra_item, event):
        response = admin_client.post(
            LIST_URL,
            {"extra_item_id": extra_item.pk, "event_id": event.pk, "type": AccomodationRoomType.FEMALE},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["type"] == AccomodationRoomType.FEMALE

    def test_create_beyond_occupants_per_room_returns_400(self, admin_client, extra_item, event):
        users = [make_user(email=f"u{i}") for i in range(4)]  # capacity is 3
        response = admin_client.post(
            LIST_URL,
            {
                "extra_item_id": extra_item.pk, "event_id": event.pk,
                "user_ids": [u.pk for u in users],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert AccommodationRoom.objects.filter(extra_item=extra_item).count() == 0

    def test_create_beyond_available_rooms_returns_400(self, admin_client, extra_item, event):
        make_room(extra_item, event)
        make_room(extra_item, event)  # available_rooms is 2
        response = admin_client.post(
            LIST_URL, {"extra_item_id": extra_item.pk, "event_id": event.pk}, format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert AccommodationRoom.objects.filter(extra_item=extra_item).count() == 2


# ── Update ───────────────────────────────────────────────────────────────────

class TestAccommodationRoomUpdate:
    def test_admin_can_patch_users(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        u1 = make_user(email="u1")
        response = admin_client.patch(
            detail_url(room.pk), {"user_ids": [u1.pk]}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        room.refresh_from_db()
        assert list(room.users.values_list("id", flat=True)) == [u1.pk]

    def test_admin_can_patch_type(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        response = admin_client.patch(
            detail_url(room.pk), {"type": AccomodationRoomType.FRIENDS}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        room.refresh_from_db()
        assert room.type == AccomodationRoomType.FRIENDS

    def test_patch_beyond_occupants_per_room_returns_400(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        users = [make_user(email=f"u{i}") for i in range(4)]
        response = admin_client.patch(
            detail_url(room.pk),
            {"user_ids": [u.pk for u in users]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert room.users.count() == 0


# ── Delete ───────────────────────────────────────────────────────────────────

class TestAccommodationRoomDelete:
    def test_admin_can_delete(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        response = admin_client.delete(detail_url(room.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT


# ── List filters ─────────────────────────────────────────────────────────────

class TestAccommodationRoomListFilters:
    def test_filter_by_event(self, admin_client, extra_item, event, other_event):
        room1 = make_room(extra_item, event)
        make_room(extra_item, other_event)
        response = admin_client.get(LIST_URL, {"event": event.pk})
        assert [r["id"] for r in response.data] == [room1.pk]

    def test_filter_by_location(self, admin_client, extra_item, event, other_location):
        other_item = ExtraItem.objects.create(
            name="Falco Double", name_it="Falco Doppia", name_en="Falco Double", value=90,
        )
        AccommodationType.objects.create(
            extra_item=other_item, location=other_location, occupants_per_room=2, available_rooms=5,
        )
        room1 = make_room(extra_item, event)
        make_room(other_item, event)
        location_id = extra_item.accommodation_type.location_id
        response = admin_client.get(LIST_URL, {"location": location_id})
        assert [r["id"] for r in response.data] == [room1.pk]

    def test_filter_by_extra_item(self, admin_client, extra_item, event):
        other_item = ExtraItem.objects.create(
            name="Falco Double", name_it="Falco Doppia", name_en="Falco Double", value=90,
        )
        AccommodationType.objects.create(
            extra_item=other_item,
            location=extra_item.accommodation_type.location,
            occupants_per_room=2, available_rooms=5,
        )
        room1 = make_room(extra_item, event)
        make_room(other_item, event)
        response = admin_client.get(LIST_URL, {"extra_item": extra_item.pk})
        assert [r["id"] for r in response.data] == [room1.pk]

    def test_filter_by_occupant_name(self, admin_client, extra_item, event):
        target = make_user(email="findme", first_name="Mario", last_name="Rossi")
        make_user(email="other", first_name="Luigi", last_name="Verdi")
        room1 = make_room(extra_item, event)
        room1.users.add(target)
        make_room(extra_item, event)
        # second room would exceed available_rooms (2) if a third existed; stop at two for this test
        response = admin_client.get(LIST_URL, {"name": "Mario"})
        assert [r["id"] for r in response.data] == [room1.pk]


# ── Calculated fields ──────────────────────────────────────────────────────

class TestAccommodationRoomOccupationRate:
    def test_occupation_rate(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        room.users.add(make_user(email="u1"), make_user(email="u2"))
        response = admin_client.get(detail_url(room.pk))
        assert response.data["occupation_rate"] == "2/3"

    def test_paid_occupation_rate(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        room.users.add(
            make_user_with_contribution(event, email="u1", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, email="u2", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, email="u3", status=ContributionStatus.WAITING),
        )
        response = admin_client.get(detail_url(room.pk))
        assert response.data["occupation_rate"] == "3/3"
        assert response.data["paid_occupation_rate"] == "2/3"

    def test_paid_occupation_rate_ignores_contribution_for_a_different_event(
        self, admin_client, extra_item, event, other_event,
    ):
        room = make_room(extra_item, event)
        # Paid, but for a different event — shouldn't count as paid for this room's event.
        room.users.add(make_user_with_contribution(other_event, email="u1", status=ContributionStatus.PAYED))
        response = admin_client.get(detail_url(room.pk))
        assert response.data["occupation_rate"] == "1/3"
        assert response.data["paid_occupation_rate"] == "0/3"


# ── Type choices endpoint ────────────────────────────────────────────────────

class TestAccommodationRoomTypesEndpoint:
    def test_unauthenticated_cannot_list_types(self, client):
        response = client.get(TYPES_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_can_list_types(self, student_client):
        response = student_client.get(TYPES_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_list_types(self, admin_client):
        response = admin_client.get(TYPES_URL)
        assert response.status_code == status.HTTP_200_OK
        assert {c["value"] for c in response.data} == {
            AccomodationRoomType.FRIENDS, AccomodationRoomType.MALE,
            AccomodationRoomType.FEMALE, AccomodationRoomType.MIXED,
        }
