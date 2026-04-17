import pytest
from rest_framework import status

from event.models import ArtistType
from utils.mock_artist_type import make_artist_type_payload, make_artist_type_payloads

LIST_URL = "/api/events/artist-types/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestArtistTypePermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_artist_types(self, student_client, db):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_artist_type(self, student_client, db):
        response = student_client.post(LIST_URL, make_artist_type_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_artist_type(self, student_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = student_client.put(detail_url(artist_type.pk), make_artist_type_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_artist_type(self, student_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = student_client.delete(detail_url(artist_type.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestArtistTypeList:

    def test_staff_can_list_artist_types(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_artist_types(self, staff_client, db):
        for payload in make_artist_type_payloads(3):
            ArtistType.objects.create(**payload)

        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, db):
        ArtistType.objects.create(**make_artist_type_payload())

        response = staff_client.get(LIST_URL)
        assert set(response.data[0].keys()) == {"id", "name"}

    def test_empty_list_returns_empty_array(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create ────────────────────────────────────────────────────────────────────

class TestArtistTypeCreate:

    def test_staff_can_create_artist_type(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_artist_type_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, db):
        payload = make_artist_type_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert ArtistType.objects.filter(name=payload["name"]).exists()

    def test_create_returns_id(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_artist_type_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_correct_data(self, staff_client, db):
        payload = make_artist_type_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["name"] == payload["name"]

    def test_create_missing_name_returns_400(self, staff_client, db):
        response = staff_client.post(LIST_URL, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestArtistTypeRetrieve:

    def test_staff_can_retrieve_artist_type(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = staff_client.get(detail_url(artist_type.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, db):
        payload = make_artist_type_payload()
        artist_type = ArtistType.objects.create(**payload)
        response = staff_client.get(detail_url(artist_type.pk))
        assert response.data["name"] == payload["name"]

    def test_retrieve_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestArtistTypeUpdate:

    def test_staff_can_full_update_artist_type(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = staff_client.put(detail_url(artist_type.pk), make_artist_type_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_name(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        staff_client.put(detail_url(artist_type.pk), {"name": "Updated"}, format="json")
        artist_type.refresh_from_db()
        assert artist_type.name == "Updated"

    def test_full_update_missing_name_returns_400(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = staff_client.put(detail_url(artist_type.pk), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestArtistTypePartialUpdate:

    def test_staff_can_partial_update_artist_type(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = staff_client.patch(detail_url(artist_type.pk), {"name": "Patched"}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_name(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        staff_client.patch(detail_url(artist_type.pk), {"name": "Patched Name"}, format="json")
        artist_type.refresh_from_db()
        assert artist_type.name == "Patched Name"


# ── Delete ────────────────────────────────────────────────────────────────────

class TestArtistTypeDelete:

    def test_staff_can_delete_artist_type(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        response = staff_client.delete(detail_url(artist_type.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, db):
        artist_type = ArtistType.objects.create(**make_artist_type_payload())
        pk = artist_type.pk
        staff_client.delete(detail_url(pk))
        assert not ArtistType.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
