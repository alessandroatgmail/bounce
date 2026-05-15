import pytest
from django.urls import reverse
from rest_framework import status

from users.models import User, Role

TOKEN_URL = reverse("token_obtain_pair")
LOGOUT_URL = reverse("logout")
REFRESH_URL = reverse("token_refresh")


@pytest.fixture
def student(db):
    return User.objects.create_user(
        email="student@bounce.com",
        password="StrongPass123!",
        role=Role.STUDENT,
        is_active=True,
    )


def _login(client, email="student@bounce.com", password="StrongPass123!"):
    resp = client.post(TOKEN_URL, {"email": email, "password": password})
    return resp.data["access"], resp.data["refresh"]


class TestLogout:
    def test_unauthenticated_returns_401(self, client, db):
        response = client.post(LOGOUT_URL, {"refresh": "sometoken"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_without_refresh_token_returns_400(self, client, student):
        access, _ = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.post(LOGOUT_URL, {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "refresh" in response.data["detail"].lower()

    def test_logout_with_invalid_token_returns_400(self, client, student):
        access, _ = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.post(LOGOUT_URL, {"refresh": "not.a.valid.token"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_returns_204(self, client, student):
        access, refresh = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.post(LOGOUT_URL, {"refresh": refresh})
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_blacklisted_refresh_token_cannot_be_reused(self, client, student):
        access, refresh = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        client.post(LOGOUT_URL, {"refresh": refresh})

        response = client.post(REFRESH_URL, {"refresh": refresh})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_twice_with_same_token_returns_400(self, client, student):
        access, refresh = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        client.post(LOGOUT_URL, {"refresh": refresh})

        response = client.post(LOGOUT_URL, {"refresh": refresh})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
