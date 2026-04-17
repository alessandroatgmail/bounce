import pytest
from rest_framework import status

from event.models import Location
from utils.mock_location import make_location_payload, make_location_payloads

LIST_URL = "/api/events/locations/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestLocationPermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_locations(self, student_client, world_data):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_location(self, student_client, world_data):
        response = student_client.post(LIST_URL, make_location_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_location(self, student_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = student_client.put(detail_url(location.pk), make_location_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_location(self, student_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = student_client.delete(detail_url(location.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestLocationList:

    def test_staff_can_list_locations(self, staff_client, world_data):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_locations(self, staff_client, world_data):
        for payload in make_location_payloads(3):
            Location.objects.create(**payload)

        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, world_data):
        Location.objects.create(**make_location_payload())

        response = staff_client.get(LIST_URL)
        assert set(response.data[0].keys()) == {"id", "name", "address", "city"}
        assert set(response.data[0]["city"].keys()) == {"id", "name", "country"}

    def test_empty_list_returns_empty_array(self, staff_client, world_data):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create ────────────────────────────────────────────────────────────────────

class TestLocationCreate:

    def test_staff_can_create_location(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_location_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, world_data):
        payload = make_location_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Location.objects.filter(name=payload["name"]).exists()

    def test_create_returns_id(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_location_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_correct_data(self, staff_client, world_data):
        payload = make_location_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["name"] == payload["name"]
        assert response.data["address"] == payload["address"]
        assert response.data["city"]["id"] == payload["city_id"]

    def test_create_response_city_contains_name_and_country(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_location_payload(), format="json")
        assert "name" in response.data["city"]
        assert "country" in response.data["city"]

    @pytest.mark.parametrize("field", ["name", "address", "city_id"])
    def test_create_missing_required_field_returns_400(self, staff_client, world_data, field):
        payload = make_location_payload()
        del payload[field]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_invalid_city_returns_400(self, staff_client, world_data):
        payload = make_location_payload(city_id=99999)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestLocationRetrieve:

    def test_staff_can_retrieve_location(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = staff_client.get(detail_url(location.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, world_data):
        payload = make_location_payload()
        location = Location.objects.create(**payload)
        response = staff_client.get(detail_url(location.pk))
        assert response.data["name"] == payload["name"]
        assert response.data["address"] == payload["address"]
        assert response.data["city"]["id"] == payload["city_id"]
        assert "name" in response.data["city"]
        assert "country" in response.data["city"]

    def test_retrieve_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestLocationUpdate:

    def test_staff_can_full_update_location(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = staff_client.put(detail_url(location.pk), make_location_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_fields(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        new_payload = make_location_payload(name="Updated Studio", address="Via Roma 1")
        staff_client.put(detail_url(location.pk), new_payload, format="json")

        location.refresh_from_db()
        assert location.name == "Updated Studio"
        assert location.address == "Via Roma 1"

    def test_full_update_missing_field_returns_400(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        payload = make_location_payload()
        del payload["city_id"]
        response = staff_client.put(detail_url(location.pk), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestLocationPartialUpdate:

    def test_staff_can_partial_update_location(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = staff_client.patch(detail_url(location.pk), {"name": "Patched Studio"}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_only_provided_fields(self, staff_client, world_data):
        payload = make_location_payload(address="Via Originale 5")
        location = Location.objects.create(**payload)

        staff_client.patch(detail_url(location.pk), {"name": "Patched Name"}, format="json")

        location.refresh_from_db()
        assert location.name == "Patched Name"
        assert location.address == "Via Originale 5"


# ── Delete ────────────────────────────────────────────────────────────────────

class TestLocationDelete:

    def test_staff_can_delete_location(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        response = staff_client.delete(detail_url(location.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, world_data):
        location = Location.objects.create(**make_location_payload())
        pk = location.pk
        staff_client.delete(detail_url(pk))
        assert not Location.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
