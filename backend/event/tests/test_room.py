import pytest
from rest_framework import status

from event.models import Room
from utils.mock_room import make_room_payload, make_room_payloads

LIST_URL = "/api/events/rooms/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestRoomPermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_rooms(self, student_client, world_data):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_room(self, student_client, world_data):
        response = student_client.post(LIST_URL, make_room_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_room(self, student_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = student_client.put(detail_url(room.pk), make_room_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_room(self, student_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = student_client.delete(detail_url(room.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestRoomList:

    def test_staff_can_list_rooms(self, staff_client, world_data):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_rooms(self, staff_client, world_data):
        for payload in make_room_payloads(3):
            Room.objects.create(**payload)

        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, world_data):
        Room.objects.create(**make_room_payload())

        response = staff_client.get(LIST_URL)
        assert set(response.data[0].keys()) == {"id", "name", "capacity", "location"}

    def test_list_location_contains_expected_fields(self, staff_client, world_data):
        Room.objects.create(**make_room_payload())

        response = staff_client.get(LIST_URL)
        location = response.data[0]["location"]
        assert set(location.keys()) == {"id", "name", "address", "city"}
        assert set(location["city"].keys()) == {"id", "name", "country"}

    def test_empty_list_returns_empty_array(self, staff_client, world_data):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create ────────────────────────────────────────────────────────────────────

class TestRoomCreate:

    def test_staff_can_create_room(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_room_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, world_data):
        payload = make_room_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Room.objects.filter(name=payload["name"]).exists()

    def test_create_returns_id(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_room_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_correct_data(self, staff_client, world_data):
        payload = make_room_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["name"] == payload["name"]
        assert response.data["capacity"] == payload["capacity"]
        assert response.data["location"]["id"] == payload["location_id"]

    def test_create_response_location_contains_city_details(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_room_payload(), format="json")
        location = response.data["location"]
        assert "name" in location
        assert "address" in location
        assert "name" in location["city"]
        assert "country" in location["city"]

    @pytest.mark.parametrize("field", ["name", "capacity", "location_id"])
    def test_create_missing_required_field_returns_400(self, staff_client, world_data, field):
        payload = make_room_payload()
        del payload[field]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_invalid_location_returns_400(self, staff_client, world_data):
        payload = make_room_payload(location_id=99999)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestRoomRetrieve:

    def test_staff_can_retrieve_room(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = staff_client.get(detail_url(room.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, world_data):
        payload = make_room_payload()
        room = Room.objects.create(**payload)
        response = staff_client.get(detail_url(room.pk))
        assert response.data["name"] == payload["name"]
        assert response.data["capacity"] == payload["capacity"]
        assert response.data["location"]["id"] == payload["location_id"]
        assert "name" in response.data["location"]
        assert "name" in response.data["location"]["city"]
        assert "country" in response.data["location"]["city"]

    def test_retrieve_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestRoomUpdate:

    def test_staff_can_full_update_room(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = staff_client.put(detail_url(room.pk), make_room_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_fields(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        new_payload = make_room_payload(name="Main Hall", capacity=100)
        staff_client.put(detail_url(room.pk), new_payload, format="json")

        room.refresh_from_db()
        assert room.name == "Main Hall"
        assert room.capacity == 100

    def test_full_update_missing_field_returns_400(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        payload = make_room_payload()
        del payload["location_id"]
        response = staff_client.put(detail_url(room.pk), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestRoomPartialUpdate:

    def test_staff_can_partial_update_room(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = staff_client.patch(detail_url(room.pk), {"name": "Patched Room"}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_only_provided_fields(self, staff_client, world_data):
        payload = make_room_payload(capacity=30)
        room = Room.objects.create(**payload)

        staff_client.patch(detail_url(room.pk), {"name": "Patched Name"}, format="json")

        room.refresh_from_db()
        assert room.name == "Patched Name"
        assert room.capacity == 30


# ── Delete ────────────────────────────────────────────────────────────────────

class TestRoomDelete:

    def test_staff_can_delete_room(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = staff_client.delete(detail_url(room.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        pk = room.pk
        staff_client.delete(detail_url(pk))
        assert not Room.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
