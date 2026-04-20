import pytest
from rest_framework import status

from event.models import Level
from utils.mock_level import make_level_payload, make_level_payloads

LIST_URL = "/api/events/levels/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestLevelPermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_levels(self, student_client, db):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_level(self, student_client, db):
        response = student_client.post(LIST_URL, make_level_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_level(self, student_client, db):
        level = Level.objects.create(**make_level_payload())
        response = student_client.put(detail_url(level.pk), make_level_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_level(self, student_client, db):
        level = Level.objects.create(**make_level_payload())
        response = student_client.delete(detail_url(level.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestLevelList:

    def test_staff_can_list_levels(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_levels(self, staff_client, db):
        for payload in make_level_payloads(3):
            Level.objects.create(**payload)
        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, db):
        Level.objects.create(**make_level_payload())
        response = staff_client.get(LIST_URL)
        assert set(response.data[0].keys()) == {"id", "name"}

    def test_empty_list_returns_empty_array(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create ────────────────────────────────────────────────────────────────────

class TestLevelCreate:

    def test_staff_can_create_level(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_level_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, db):
        payload = make_level_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Level.objects.filter(name=payload["name"]).exists()

    def test_create_returns_id(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_level_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_correct_data(self, staff_client, db):
        payload = make_level_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["name"] == payload["name"]

    def test_create_missing_name_returns_400(self, staff_client, db):
        response = staff_client.post(LIST_URL, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestLevelRetrieve:

    def test_staff_can_retrieve_level(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        response = staff_client.get(detail_url(level.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, db):
        payload = make_level_payload()
        level = Level.objects.create(**payload)
        response = staff_client.get(detail_url(level.pk))
        assert response.data["name"] == payload["name"]

    def test_retrieve_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestLevelUpdate:

    def test_staff_can_full_update_level(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        response = staff_client.put(detail_url(level.pk), make_level_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_name(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        staff_client.put(detail_url(level.pk), {"name": "Advanced"}, format="json")
        level.refresh_from_db()
        assert level.name == "Advanced"

    def test_full_update_missing_name_returns_400(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        response = staff_client.put(detail_url(level.pk), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestLevelPartialUpdate:

    def test_staff_can_partial_update_level(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        response = staff_client.patch(detail_url(level.pk), {"name": "Patched"}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_name(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        staff_client.patch(detail_url(level.pk), {"name": "Patched"}, format="json")
        level.refresh_from_db()
        assert level.name == "Patched"


# ── Delete ────────────────────────────────────────────────────────────────────

class TestLevelDelete:

    def test_staff_can_delete_level(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        response = staff_client.delete(detail_url(level.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, db):
        level = Level.objects.create(**make_level_payload())
        pk = level.pk
        staff_client.delete(detail_url(pk))
        assert not Level.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
