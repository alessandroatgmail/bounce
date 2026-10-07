import pytest
from rest_framework import status

from event.models import Event, Location, Room, Status
from users.models import City
from utils.mock_event import make_event_payload
from utils.mock_location import make_location_payload
from utils.mock_room import make_room_payload

LIST_URL = "/api/events/cities/"


def create_event_in_city(city, **overrides):
    location = Location.objects.create(**make_location_payload(city_id=city.id))
    room = Room.objects.create(**make_room_payload(location_id=location.id))
    payload = make_event_payload(room_id=room.id, **overrides)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=payload["start_date"],
        end_date=payload["end_date"],
        duration=payload["duration"],
        capacity=payload["capacity"],
    )


class TestAvailableCitiesList:

    def test_unauthenticated_list_returns_200(self, client, world_data):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_only_cities_with_published_events_are_returned(self, client, world_data):
        city_with_published, city_with_draft_only, city_with_no_events = City.objects.all()[:3]
        create_event_in_city(city_with_published, status=Status.PUBLISHED)
        create_event_in_city(city_with_draft_only, status=Status.DRAFT)

        response = client.get(LIST_URL)

        ids = [row["id"] for row in response.json()]
        assert ids == [city_with_published.id]

    def test_city_appears_once_even_with_multiple_published_events(self, client, world_data):
        city = City.objects.first()
        create_event_in_city(city, status=Status.PUBLISHED)
        create_event_in_city(city, status=Status.PUBLISHED)

        response = client.get(LIST_URL)

        ids = [row["id"] for row in response.json()]
        assert ids.count(city.id) == 1

    def test_staff_also_sees_cities_with_only_draft_events(self, staff_client, world_data):
        city = City.objects.first()
        create_event_in_city(city, status=Status.DRAFT)

        response = staff_client.get(LIST_URL)

        ids = [row["id"] for row in response.json()]
        assert city.id in ids
