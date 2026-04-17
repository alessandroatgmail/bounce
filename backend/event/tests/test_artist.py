import pytest
from rest_framework import status

from event.models import Artist
from users.models import User
from utils.mock_artist import make_artist_payload, make_artist_payloads

LIST_URL = "/api/events/artists/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


@pytest.fixture
def active_user(db):
    return User.objects.create_user(
        email="artist_user@bounce.com",
        password="StrongPass123!",
        first_name="Marco",
        last_name="Rossi",
        is_active=True,
    )


# ── Authentication & Permissions ──────────────────────────────────────────────

class TestArtistPermissions:

    def test_unauthenticated_request_returns_401(self, client, db):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list_artists(self, student_client, db):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create_artist(self, student_client, db):
        response = student_client.post(LIST_URL, make_artist_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_artist(self, student_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(
            first_name=payload["first_name"], last_name=payload["last_name"]
        )
        response = student_client.put(detail_url(artist.pk), make_artist_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_artist(self, student_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(
            first_name=payload["first_name"], last_name=payload["last_name"]
        )
        response = student_client.delete(detail_url(artist.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── List ──────────────────────────────────────────────────────────────────────

class TestArtistList:

    def test_staff_can_list_artists(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_all_artists(self, staff_client, db):
        for payload in make_artist_payloads(3):
            Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])

        response = staff_client.get(LIST_URL)
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, db):
        payload = make_artist_payload()
        Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])

        response = staff_client.get(LIST_URL)
        expected = {"id", "full_name", "user", "first_name", "last_name", "types", "styles", "genres"}
        assert set(response.data[0].keys()) == expected

    def test_empty_list_returns_empty_array(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Create with first_name / last_name ────────────────────────────────────────

class TestArtistCreateWithNames:

    def test_staff_can_create_artist_with_names(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_artist_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, db):
        payload = make_artist_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Artist.objects.filter(first_name=payload["first_name"]).exists()

    def test_create_returns_id(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_artist_payload(), format="json")
        assert "id" in response.data

    def test_create_returns_full_name_from_names(self, staff_client, db):
        payload = make_artist_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        expected = f"{payload['first_name']} {payload['last_name']}"
        assert response.data["full_name"] == expected

    def test_create_returns_nested_types(self, staff_client, db):
        payload = make_artist_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["types"]) == len(payload["type_ids"])
        assert set(response.data["types"][0].keys()) == {"id", "name"}

    def test_create_returns_nested_styles(self, staff_client, db):
        payload = make_artist_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["styles"]) == len(payload["style_ids"])
        assert set(response.data["styles"][0].keys()) == {"id", "name"}

    def test_create_returns_nested_genres(self, staff_client, db):
        payload = make_artist_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["genres"]) == len(payload["genre_ids"])
        assert set(response.data["genres"][0].keys()) == {"id", "name"}


# ── Create with user ──────────────────────────────────────────────────────────

class TestArtistCreateWithUser:

    def test_staff_can_create_artist_with_user(self, staff_client, active_user):
        response = staff_client.post(LIST_URL, make_artist_payload(user_pk=active_user.pk), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_returns_full_name_from_user(self, staff_client, active_user):
        response = staff_client.post(LIST_URL, make_artist_payload(user_pk=active_user.pk), format="json")
        assert response.data["full_name"] == f"{active_user.first_name} {active_user.last_name}"

    def test_create_with_user_sets_user_field(self, staff_client, active_user):
        response = staff_client.post(LIST_URL, make_artist_payload(user_pk=active_user.pk), format="json")
        assert response.data["user"] == active_user.pk


# ── Validation ────────────────────────────────────────────────────────────────

class TestArtistValidation:

    def test_create_without_user_or_names_returns_400(self, staff_client, db):
        payload = make_artist_payload()
        del payload["first_name"]
        del payload["last_name"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_only_first_name_returns_400(self, staff_client, db):
        payload = make_artist_payload()
        del payload["last_name"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_only_last_name_returns_400(self, staff_client, db):
        payload = make_artist_payload()
        del payload["first_name"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_invalid_user_pk_returns_400(self, staff_client, db):
        payload = make_artist_payload(user_pk=99999)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_empty_first_name_returns_400(self, staff_client, db):
        payload = make_artist_payload(first_name="")
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_empty_last_name_returns_400(self, staff_client, db):
        payload = make_artist_payload(last_name="")
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_blanking_first_name_returns_400(self, staff_client, db):
        artist = Artist.objects.create(first_name="Mario", last_name="Rossi")
        response = staff_client.patch(detail_url(artist.pk), {"first_name": ""}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_blanking_last_name_returns_400(self, staff_client, db):
        artist = Artist.objects.create(first_name="Mario", last_name="Rossi")
        response = staff_client.patch(detail_url(artist.pk), {"last_name": ""}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_blanking_both_names_returns_400(self, staff_client, db):
        artist = Artist.objects.create(first_name="Mario", last_name="Rossi")
        response = staff_client.patch(
            detail_url(artist.pk), {"first_name": "", "last_name": ""}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestArtistRetrieve:

    def test_staff_can_retrieve_artist(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        response = staff_client.get(detail_url(artist.pk))
        assert response.status_code == status.HTTP_200_OK

    def test_retrieve_full_name_without_user(self, staff_client, db):
        artist = Artist.objects.create(first_name="Anna", last_name="Bianchi")
        response = staff_client.get(detail_url(artist.pk))
        assert response.data["full_name"] == "Anna Bianchi"

    def test_retrieve_full_name_with_user(self, staff_client, active_user):
        artist = Artist.objects.create(user=active_user)
        response = staff_client.get(detail_url(artist.pk))
        assert response.data["full_name"] == f"{active_user.first_name} {active_user.last_name}"

    def test_retrieve_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Update (PUT) ──────────────────────────────────────────────────────────────

class TestArtistUpdate:

    def test_staff_can_full_update_artist(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        response = staff_client.put(detail_url(artist.pk), make_artist_payload(), format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_full_update_changes_names(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        new_payload = make_artist_payload(first_name="Luca", last_name="Verdi")
        staff_client.put(detail_url(artist.pk), new_payload, format="json")
        artist.refresh_from_db()
        assert artist.first_name == "Luca"
        assert artist.last_name == "Verdi"

    def test_full_update_replaces_m2m_relations(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        artist.types.set(payload["type_ids"])

        new_payload = make_artist_payload()
        staff_client.put(detail_url(artist.pk), new_payload, format="json")

        artist.refresh_from_db()
        assert list(artist.types.values_list("id", flat=True)) == new_payload["type_ids"]

    def test_full_update_without_names_or_user_returns_400(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        bad_payload = make_artist_payload()
        del bad_payload["first_name"]
        del bad_payload["last_name"]
        response = staff_client.put(detail_url(artist.pk), bad_payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Partial Update (PATCH) ────────────────────────────────────────────────────

class TestArtistPartialUpdate:

    def test_staff_can_partial_update_artist(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        response = staff_client.patch(detail_url(artist.pk), {"first_name": "Patched"}, format="json")
        print (response.data)
        assert response.status_code == status.HTTP_200_OK

    def test_partial_update_changes_only_provided_fields(self, staff_client, db):
        artist = Artist.objects.create(first_name="Original", last_name="Surname")
        staff_client.patch(detail_url(artist.pk), {"first_name": "Changed"}, format="json")
        artist.refresh_from_db()
        assert artist.first_name == "Changed"
        assert artist.last_name == "Surname"

    def test_partial_update_m2m_replaces_styles(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        new_payload = make_artist_payload()
        staff_client.patch(detail_url(artist.pk), {"style_ids": new_payload["style_ids"]}, format="json")
        artist.refresh_from_db()
        assert list(artist.styles.values_list("id", flat=True)) == new_payload["style_ids"]


# ── Delete ────────────────────────────────────────────────────────────────────

class TestArtistDelete:

    def test_staff_can_delete_artist(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        response = staff_client.delete(detail_url(artist.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, db):
        payload = make_artist_payload()
        artist = Artist.objects.create(first_name=payload["first_name"], last_name=payload["last_name"])
        pk = artist.pk
        staff_client.delete(detail_url(pk))
        assert not Artist.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == status.HTTP_404_NOT_FOUND
