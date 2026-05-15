import pytest
from django.urls import reverse
from rest_framework import status

from users.models import Country, City, User, Role

ME_URL = reverse("me")
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
