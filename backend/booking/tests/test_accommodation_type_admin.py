"""
Admin CRUD for AccommodationType — a dedicated endpoint so staff never have
to touch the generic /extra-items/ endpoint to set up accommodation: one
request creates the billable ExtraItem (name/value) and the AccommodationType
extension (location/capacity) together.
"""
import pytest
from rest_framework import status

from booking.models import AccommodationType, ExtraItem
from event.models import Location
from utils.mock_location import make_location_payload

LIST_URL = "/api/booking/accommodation-types/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name="Hotel Airone"))


def make_payload(location, **overrides):
    payload = {
        "extra_item": {
            "name": "Airone Triple",
            "name_it": "Airone Tripla",
            "name_en": "Airone Triple",
            "value": "120.00",
            "description": "Camera tripla, bagno condiviso",
            "description_en": "Triple room, shared bathroom",
            "description_en_it": "Camera tripla, bagno condiviso",
            "expiration_date": "2027-06-30T00:00:00Z",
        },
        "location_id": location.id,
        "occupants_per_room": 3,
        "available_rooms": 13,
    }
    payload.update(overrides)
    return payload


def make_accommodation_type(location, **overrides):
    extra_item = ExtraItem.objects.create(
        name="Airone Double", name_it="Airone Doppia", name_en="Airone Double", value=90,
    )
    defaults = dict(
        extra_item=extra_item, location=location,
        occupants_per_room=2, available_rooms=22,
    )
    defaults.update(overrides)
    return AccommodationType.objects.create(**defaults)


# ── Permissions ────────────────────────────────────────────────────────────

class TestAccommodationTypePermissions:
    def test_unauthenticated_request_returns_401(self, client, location):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list(self, student_client, location):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create(self, student_client, location):
        response = student_client.post(LIST_URL, make_payload(location), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, location):
        accommodation_type = make_accommodation_type(location)
        response = student_client.patch(detail_url(accommodation_type.pk), {"available_rooms": 5}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, location):
        accommodation_type = make_accommodation_type(location)
        response = student_client.delete(detail_url(accommodation_type.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ───────────────────────────────────────────────────────────────────

class TestAccommodationTypeList:
    def test_admin_can_list(self, admin_client, location):
        make_accommodation_type(location)
        response = admin_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_list_includes_nested_extra_item_and_location(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        response = admin_client.get(LIST_URL)
        entry = response.data[0]
        assert entry["extra_item"]["name"] == accommodation_type.extra_item.name
        assert entry["extra_item"]["value"] == "90.00"
        assert entry["location"]["id"] == location.id


# ── Create ─────────────────────────────────────────────────────────────────

class TestAccommodationTypeCreate:
    def test_admin_can_create(self, admin_client, location):
        response = admin_client.post(LIST_URL, make_payload(location), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_extra_item_and_accommodation_type(self, admin_client, location):
        admin_client.post(LIST_URL, make_payload(location), format="json")
        assert ExtraItem.objects.filter(name="Airone Triple").exists()
        accommodation_type = AccommodationType.objects.get(extra_item__name="Airone Triple")
        assert accommodation_type.location_id == location.id
        assert accommodation_type.occupants_per_room == 3
        assert accommodation_type.available_rooms == 13

    def test_create_returns_nested_data(self, admin_client, location):
        response = admin_client.post(LIST_URL, make_payload(location), format="json")
        assert response.data["extra_item"]["name"] == "Airone Triple"
        assert response.data["extra_item"]["expiration_date"][:10] == "2027-06-30"
        assert response.data["location"]["id"] == location.id
        assert response.data["available_rooms"] == 13

    def test_create_missing_extra_item_returns_400(self, admin_client, location):
        payload = make_payload(location)
        del payload["extra_item"]
        response = admin_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_missing_extra_item_name_returns_400(self, admin_client, location):
        payload = make_payload(location)
        del payload["extra_item"]["name"]
        response = admin_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_invalid_location_returns_400(self, admin_client, location):
        payload = make_payload(location, location_id=99999)
        response = admin_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ───────────────────────────────────────────────────────────────

class TestAccommodationTypeRetrieve:
    def test_admin_can_retrieve(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        response = admin_client.get(detail_url(accommodation_type.pk))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == accommodation_type.pk

    def test_retrieve_nonexistent_returns_404(self, admin_client, location):
        response = admin_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ───────────────────────────────────────────────────────────

class TestAccommodationTypeUpdate:
    def test_full_update_changes_accommodation_and_extra_item_fields(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        new_payload = make_payload(location, available_rooms=30)
        response = admin_client.put(detail_url(accommodation_type.pk), new_payload, format="json")
        assert response.status_code == status.HTTP_200_OK

        accommodation_type.refresh_from_db()
        accommodation_type.extra_item.refresh_from_db()
        assert accommodation_type.available_rooms == 30
        assert accommodation_type.extra_item.name == "Airone Triple"


# ── Partial update (PATCH) ────────────────────────────────────────────────

class TestAccommodationTypePartialUpdate:
    def test_partial_update_changes_only_provided_field(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        original_extra_item_name = accommodation_type.extra_item.name

        response = admin_client.patch(detail_url(accommodation_type.pk), {"available_rooms": 5}, format="json")
        assert response.status_code == status.HTTP_200_OK

        accommodation_type.refresh_from_db()
        assert accommodation_type.available_rooms == 5
        assert accommodation_type.occupants_per_room == 2
        assert accommodation_type.extra_item.name == original_extra_item_name

    def test_partial_update_can_change_nested_extra_item_value(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        response = admin_client.patch(
            detail_url(accommodation_type.pk), {"extra_item": {"value": "150.00"}}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        accommodation_type.extra_item.refresh_from_db()
        assert str(accommodation_type.extra_item.value) == "150.00"

    def test_partial_update_can_change_nested_extra_item_expiration_date(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        response = admin_client.patch(
            detail_url(accommodation_type.pk),
            {"extra_item": {"expiration_date": "2026-01-15T00:00:00Z"}}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK

        accommodation_type.extra_item.refresh_from_db()
        assert accommodation_type.extra_item.expiration_date.date().isoformat() == "2026-01-15"


# ── Delete ─────────────────────────────────────────────────────────────────

class TestAccommodationTypeDelete:
    def test_admin_can_delete(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        response = admin_client.delete(detail_url(accommodation_type.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_also_removes_linked_extra_item(self, admin_client, location):
        accommodation_type = make_accommodation_type(location)
        extra_item_id = accommodation_type.extra_item_id
        admin_client.delete(detail_url(accommodation_type.pk))
        assert not ExtraItem.objects.filter(pk=extra_item_id).exists()

    def test_delete_nonexistent_returns_404(self, admin_client, location):
        response = admin_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
