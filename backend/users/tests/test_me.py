import io
import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status

from users.models import Country, City, User, Role

ME_URL = reverse("me")


def make_png_upload(name="avatar.png"):
    """Return a SimpleUploadedFile containing a valid 1×1 red PNG."""
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), color=(255, 0, 0)).save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")
QRCODE_URL = reverse("me-qrcode")
TOKEN_URL = reverse("token_obtain_pair")


@pytest.fixture
def country(db):
    return Country.objects.create(name="Italy", iso="ITA")


@pytest.fixture
def city(db, country):
    return City.objects.create(name="Venice", country=country)


@pytest.fixture
def full_student(db, country, city):
    return User.objects.create_user(
        email="mario@bounce.com",
        password="StrongPass123!",
        first_name="Mario",
        last_name="Rossi",
        phone="+39 041 000000",
        role=Role.STUDENT,
        date_of_birth="1990-06-15",
        place_of_birth=city,
        ci="RSSMRA90H15L736Z",
        address="Via Roma 1",
        city=city,
        postal_code="30100",
        country=country,
        acsi=True,
        acsi_number=12345,
        acsi_expiration_date="2027-12-31",
        privacy_consent=True,
        marketing_consent=False,
        is_active=True,
    )


def _get_token(client, email, password):
    resp = client.post(TOKEN_URL, {"email": email, "password": password})
    return resp.data["access"]


class TestMeEndpoint:
    def test_unauthenticated_returns_401(self, client):
        response = client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_returns_200(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = client.get(ME_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_returns_correct_scalar_fields(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert data["email"] == "mario@bounce.com"
        assert data["first_name"] == "Mario"
        assert data["last_name"] == "Rossi"
        assert data["phone"] == "+39 041 000000"
        assert data["role"] == Role.STUDENT
        assert data["date_of_birth"] == "1990-06-15"
        assert data["ci"] == "RSSMRA90H15L736Z"
        assert data["address"] == "Via Roma 1"
        assert data["postal_code"] == "30100"
        assert data["acsi"] is True
        assert data["acsi_number"] == 12345
        assert data["acsi_expiration_date"] == "2027-12-31"
        assert data["privacy_consent"] is True
        assert data["marketing_consent"] is False
        assert data["is_active"] is True

    def test_returns_nested_city_and_country(self, client, full_student, city, country):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert data["city"]["id"] == city.pk
        assert data["city"]["name"] == "Venice"
        assert data["place_of_birth"]["id"] == city.pk
        assert data["country"]["id"] == country.pk
        assert data["country"]["name"] == "Italy"

    def test_password_not_in_response(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert "password" not in data

    def test_id_and_date_joined_present(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert data["id"] == full_student.pk
        assert "date_joined" in data

    def test_uuid_present_and_valid(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert "uuid" in data
        parsed = uuid.UUID(str(data["uuid"]))
        assert parsed == full_student.uuid

    def test_profile_image_null_when_not_set(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = client.get(ME_URL).data

        assert data["profile_image"] is None


class TestMePatchProfileImage:
    def test_upload_profile_image(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.patch(ME_URL, {"profile_image": make_png_upload()}, format="multipart")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["profile_image"] is not None
        assert "avatar" in response.data["profile_image"]

    def test_unauthenticated_patch_returns_401(self, client):
        response = client.patch(ME_URL, {"profile_image": make_png_upload()}, format="multipart")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_me_returns_image_url_after_upload(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        client.patch(ME_URL, {"profile_image": make_png_upload()}, format="multipart")

        data = client.get(ME_URL).data
        assert data["profile_image"] is not None


class TestMePutProfile:
    def test_unauthenticated_returns_401(self, client):
        response = client.put(ME_URL, {}, content_type="application/json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_personal_info(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(
            ME_URL,
            {"first_name": "Luigi", "last_name": "Verdi", "phone": "+39 02 999999", "ci": "VRDLGU85A01H501X"},
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data["first_name"] == "Luigi"
        assert data["last_name"] == "Verdi"
        assert data["phone"] == "+39 02 999999"
        assert data["ci"] == "VRDLGU85A01H501X"

    def test_update_address(self, client, full_student, city, country):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(
            ME_URL,
            {"address": "Via Milano 10", "postal_code": "20100", "city": city.pk, "country": country.pk},
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data["address"] == "Via Milano 10"
        assert data["postal_code"] == "20100"
        assert data["city"]["id"] == city.pk
        assert data["country"]["id"] == country.pk

    def test_update_acsi(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(
            ME_URL,
            {"acsi": True, "acsi_number": 99999, "acsi_expiration_date": "2028-06-30"},
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["acsi"] is True
        assert response.data["acsi_number"] == 99999
        assert response.data["acsi_expiration_date"] == "2028-06-30"

    def test_acsi_true_without_number_returns_400(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Clear existing ACSI data first, then try to set acsi=True with no number
        full_student.acsi_number = None
        full_student.acsi_expiration_date = None
        full_student.save()

        response = client.put(
            ME_URL,
            {"acsi": True, "acsi_expiration_date": "2028-06-30"},
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "acsi_number" in response.data

    def test_acsi_true_without_expiry_returns_400(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        full_student.acsi_number = None
        full_student.acsi_expiration_date = None
        full_student.save()

        response = client.put(
            ME_URL,
            {"acsi": True, "acsi_number": 12345},
            content_type="application/json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "acsi_expiration_date" in response.data

    def test_update_marketing_consent(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(ME_URL, {"marketing_consent": True}, content_type="application/json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["marketing_consent"] is True

    def test_privacy_consent_false_deactivates_user(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(ME_URL, {"privacy_consent": False}, content_type="application/json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["privacy_consent"] is False
        assert response.data["is_active"] is False

        full_student.refresh_from_db()
        assert full_student.is_active is False

    def test_deactivated_user_cannot_access_me(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        client.put(ME_URL, {"privacy_consent": False}, content_type="application/json")

        # Token was obtained before deactivation; subsequent requests should be rejected
        response = client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_partial_update_preserves_unrelated_fields(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = client.put(ME_URL, {"phone": "+39 02 111111"}, content_type="application/json")

        assert response.status_code == status.HTTP_200_OK
        # Fields not in payload stay untouched
        assert response.data["first_name"] == "Mario"
        assert response.data["ci"] == "RSSMRA90H15L736Z"
        assert response.data["acsi"] is True


class TestQRCodeEndpoint:
    def test_unauthenticated_returns_401(self, client):
        response = client.get(QRCODE_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_png_content_type(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = client.get(QRCODE_URL)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"

    def test_response_is_valid_png(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = client.get(QRCODE_URL)

        # PNG magic bytes
        assert response.content[:8] == b'\x89PNG\r\n\x1a\n'

    def test_response_is_non_empty(self, client, full_student):
        token = _get_token(client, "mario@bounce.com", "StrongPass123!")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = client.get(QRCODE_URL)

        assert len(response.content) > 0
