import pytest
from django.urls import reverse
from rest_framework import status

from event.models import EventType, Frequency
from utils.mock_event_type import make_event_type_payload, make_event_type_payloads

LIST_URL = "/api/events/event-types/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestEventTypePermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_event_types(self, student_client, db):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_event_type(self, student_client, db):
        response = student_client.post(LIST_URL, make_event_type_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_event_type(self, student_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = student_client.put(detail_url(event_type.pk), make_event_type_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_event_type(self, student_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = student_client.delete(detail_url(event_type.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestEventTypeList:

    def test_staff_can_list_event_types(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_event_types(self, staff_client, db):
        for payload in make_event_type_payloads(3):
            EventType.objects.create(**payload)

        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, db):
        EventType.objects.create(**make_event_type_payload())

        response = staff_client.get(LIST_URL)
        assert set(response.data[0].keys()) == {"id", "name", "frequency", "partners"}

    def test_empty_list_returns_empty_array(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create ────────────────────────────────────────────────────────────────────

class TestEventTypeCreate:

    def test_staff_can_create_event_type(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_event_type_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, db):
        payload = make_event_type_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert EventType.objects.filter(name=payload["name"]).exists()

    def test_create_returns_id(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_event_type_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_correct_data(self, staff_client, db):
        payload = make_event_type_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["name"] == payload["name"]
        assert response.data["frequency"] == payload["frequency"]
        assert response.data["partners"] == payload["partners"]

    @pytest.mark.parametrize("field", ["name", "partners"])
    def test_create_missing_required_field_returns_400(self, staff_client, db, field):
        payload = make_event_type_payload()
        del payload[field]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_empty_body_returns_400(self, staff_client, db):
        response = staff_client.post(LIST_URL, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestEventTypeRetrieve:

    def test_staff_can_retrieve_event_type(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = staff_client.get(detail_url(event_type.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, db):
        payload = make_event_type_payload()
        event_type = EventType.objects.create(**payload)
        response = staff_client.get(detail_url(event_type.pk))
        assert response.data["name"] == payload["name"]
        assert response.data["frequency"] == payload["frequency"]
        assert response.data["partners"] == payload["partners"]

    def test_retrieve_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestEventTypeUpdate:

    def test_staff_can_full_update_event_type(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = staff_client.put(detail_url(event_type.pk), make_event_type_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_fields(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        new_payload = make_event_type_payload(name="Updated Name", frequency=Frequency.SINGLE, partners=0)
        staff_client.put(detail_url(event_type.pk), new_payload, format="json")

        event_type.refresh_from_db()
        assert event_type.name == "Updated Name"
        assert event_type.frequency == Frequency.SINGLE
        assert event_type.partners == 0

    def test_full_update_missing_field_returns_400(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        payload = make_event_type_payload()
        del payload["name"]
        response = staff_client.put(detail_url(event_type.pk), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestEventTypePartialUpdate:

    def test_staff_can_partial_update_event_type(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = staff_client.patch(detail_url(event_type.pk), {"name": "Patched"}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_only_provided_fields(self, staff_client, db):
        payload = make_event_type_payload(frequency=Frequency.WEEKLY, partners=2)
        event_type = EventType.objects.create(**payload)

        staff_client.patch(detail_url(event_type.pk), {"name": "Patched Name"}, format="json")

        event_type.refresh_from_db()
        assert event_type.name == "Patched Name"
        assert event_type.frequency == Frequency.WEEKLY
        assert event_type.partners == 2


# ── Delete ────────────────────────────────────────────────────────────────────

class TestEventTypeDelete:

    def test_staff_can_delete_event_type(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        response = staff_client.delete(detail_url(event_type.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, db):
        event_type = EventType.objects.create(**make_event_type_payload())
        pk = event_type.pk
        staff_client.delete(detail_url(pk))
        assert not EventType.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
