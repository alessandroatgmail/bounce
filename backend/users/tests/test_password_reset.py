import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from unittest.mock import patch

User = get_user_model()

REQUEST_URL = reverse("password-reset")
CONFIRM_URL = reverse("password-reset-confirm")


@pytest.fixture
def active_user(db):
    return User.objects.create_user(
        email="reset@example.com",
        password="OldPassword1!",
        first_name="Jane",
        is_active=True,
    )


def _uid_and_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return uid, token


class TestPasswordResetRequest:
    def test_known_active_email_sends_task(self, client, active_user):
        with patch("users.views.send_password_reset_email.delay") as mock_task:
            response = client.post(REQUEST_URL, {"email": active_user.email}, format="json")
        assert response.status_code == 200
        mock_task.assert_called_once_with(active_user.id)

    def test_unknown_email_still_200(self, client, db):
        with patch("users.views.send_password_reset_email.delay") as mock_task:
            response = client.post(REQUEST_URL, {"email": "nobody@example.com"}, format="json")
        assert response.status_code == 200
        mock_task.assert_not_called()

    def test_inactive_user_does_not_send(self, client, active_user):
        active_user.is_active = False
        active_user.save(update_fields=["is_active"])
        with patch("users.views.send_password_reset_email.delay") as mock_task:
            response = client.post(REQUEST_URL, {"email": active_user.email}, format="json")
        assert response.status_code == 200
        mock_task.assert_not_called()

    def test_invalid_email_format_returns_400(self, client, db):
        response = client.post(REQUEST_URL, {"email": "not-an-email"}, format="json")
        assert response.status_code == 400

    def test_response_body_is_generic(self, client, active_user):
        with patch("users.views.send_password_reset_email.delay"):
            response = client.post(REQUEST_URL, {"email": active_user.email}, format="json")
        assert "detail" in response.data


class TestPasswordResetConfirm:
    def test_valid_token_resets_password(self, client, active_user):
        uid, token = _uid_and_token(active_user)
        response = client.post(
            CONFIRM_URL,
            {"uid": uid, "token": token, "new_password": "NewPassword1!", "new_password2": "NewPassword1!"},
            format="json",
        )
        assert response.status_code == 200
        active_user.refresh_from_db()
        assert active_user.check_password("NewPassword1!")

    def test_can_login_with_new_password(self, client, active_user):
        uid, token = _uid_and_token(active_user)
        client.post(
            CONFIRM_URL,
            {"uid": uid, "token": token, "new_password": "NewPassword1!", "new_password2": "NewPassword1!"},
            format="json",
        )
        login_response = client.post(
            reverse("token_obtain_pair"),
            {"email": active_user.email, "password": "NewPassword1!"},
            format="json",
        )
        assert login_response.status_code == 200
        assert "access" in login_response.data

    def test_invalid_uid_returns_400(self, client, active_user):
        _, token = _uid_and_token(active_user)
        response = client.post(
            CONFIRM_URL,
            {"uid": "baduid", "token": token, "new_password": "NewPassword1!", "new_password2": "NewPassword1!"},
            format="json",
        )
        assert response.status_code == 400

    def test_invalid_token_returns_400(self, client, active_user):
        uid, _ = _uid_and_token(active_user)
        response = client.post(
            CONFIRM_URL,
            {"uid": uid, "token": "bad-token", "new_password": "NewPassword1!", "new_password2": "NewPassword1!"},
            format="json",
        )
        assert response.status_code == 400

    def test_mismatched_passwords_returns_400(self, client, active_user):
        uid, token = _uid_and_token(active_user)
        response = client.post(
            CONFIRM_URL,
            {"uid": uid, "token": token, "new_password": "NewPassword1!", "new_password2": "DifferentPass1!"},
            format="json",
        )
        assert response.status_code == 400

    def test_weak_password_returns_400(self, client, active_user):
        uid, token = _uid_and_token(active_user)
        response = client.post(
            CONFIRM_URL,
            {"uid": uid, "token": token, "new_password": "password", "new_password2": "password"},
            format="json",
        )
        assert response.status_code == 400

    def test_token_can_only_be_used_once(self, client, active_user):
        uid, token = _uid_and_token(active_user)
        payload = {"uid": uid, "token": token, "new_password": "NewPassword1!", "new_password2": "NewPassword1!"}
        client.post(CONFIRM_URL, payload, format="json")
        second = client.post(CONFIRM_URL, payload, format="json")
        assert second.status_code == 400

    def test_missing_fields_returns_400(self, client, db):
        response = client.post(CONFIRM_URL, {"uid": "x"}, format="json")
        assert response.status_code == 400
