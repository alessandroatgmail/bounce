import pytest
from django.urls import reverse
from rest_framework import status

from users.models import User, Role

TOKEN_URL = reverse("token_obtain_pair")
REFRESH_URL = reverse("token_refresh")
VERIFY_URL = reverse("token_verify")


@pytest.fixture
def student(db):
    return User.objects.create_user(
        email="student1@bounce.com",
        password="StrongPass123!",
        role=Role.STUDENT,
        is_active=True,
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        email="teacher1@bounce.com",
        password="StrongPass123!",
        role=Role.TEACHER,
        is_active=True,
    )


# ── Obtain token (login) ───────────────────────────────────────────────────────

class TestLogin:
    def test_login_returns_access_and_refresh_tokens(self, client, student):
        response = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "StrongPass123!"})

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data

    def test_access_token_contains_role_claim(self, client, student):
        import jwt as pyjwt
        from django.conf import settings

        response = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "StrongPass123!"})

        payload = pyjwt.decode(
            response.data["access"],
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        assert payload["role"] == Role.STUDENT

    def test_access_token_contains_email_claim(self, client, student):
        import jwt as pyjwt
        from django.conf import settings

        response = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "StrongPass123!"})

        payload = pyjwt.decode(
            response.data["access"],
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        assert payload["email"] == "student1@bounce.com"

    def test_teacher_role_in_token(self, client, teacher):
        import jwt as pyjwt
        from django.conf import settings

        response = client.post(TOKEN_URL, {"email": "teacher1@bounce.com", "password": "StrongPass123!"})

        payload = pyjwt.decode(
            response.data["access"],
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        assert payload["role"] == Role.TEACHER

    def test_login_wrong_password_returns_401(self, client, student):
        response = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "wrongpassword"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user_returns_401(self, client, db):
        response = client.post(TOKEN_URL, {"email": "nobody@bounce.com", "password": "whatever"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_email_returns_400(self, client, db):
        response = client.post(TOKEN_URL, {"password": "StrongPass123!"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_missing_password_returns_400(self, client, student):
        response = client.post(TOKEN_URL, {"email": "student1@bounce.com"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_empty_body_returns_400(self, client, db):
        response = client.post(TOKEN_URL, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_inactive_user_cannot_login(self, client, db):
        User.objects.create_user(
            email="inactive@bounce.com",
            password="StrongPass123!",
            is_active=False,
        )
        response = client.post(TOKEN_URL, {"email": "inactive@bounce.com", "password": "StrongPass123!"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── Refresh token ──────────────────────────────────────────────────────────────

class TestTokenRefresh:
    def test_refresh_returns_new_access_token(self, client, student):
        login = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "StrongPass123!"})
        refresh = login.data["refresh"]

        response = client.post(REFRESH_URL, {"refresh": refresh})

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_refresh_with_invalid_token_returns_401(self, client, db):
        response = client.post(REFRESH_URL, {"refresh": "this.is.not.valid"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_with_missing_token_returns_400(self, client, db):
        response = client.post(REFRESH_URL, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Verify token ───────────────────────────────────────────────────────────────

class TestTokenVerify:
    def test_verify_valid_access_token(self, client, student):
        login = client.post(TOKEN_URL, {"email": "student1@bounce.com", "password": "StrongPass123!"})
        access = login.data["access"]

        response = client.post(VERIFY_URL, {"token": access})

        assert response.status_code == status.HTTP_200_OK

    def test_verify_invalid_token_returns_401(self, client, db):
        response = client.post(VERIFY_URL, {"token": "garbage.token.here"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_verify_missing_token_returns_400(self, client, db):
        response = client.post(VERIFY_URL, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
