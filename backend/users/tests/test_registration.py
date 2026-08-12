import pytest
from rest_framework import status
from unittest.mock import patch, call, MagicMock

from notification.models import Notification
from notification.tests.conftest import process_event_sync
from users.models import User
from utils.mock_user import make_user_payload

REGISTER_URL = "/api/auth/register/"


class TestRegistration:

    # ── Success ───────────────────────────────────────────────────────────────

    def test_register_returns_201(self, client, world_data):
        user_payload = make_user_payload()
        response = client.post(REGISTER_URL, user_payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED

    def test_registered_user_is_inactive(self, client, world_data):
        payload = make_user_payload()
        client.post(REGISTER_URL, payload, format="json")

        user = User.objects.get(email=payload["email"])
        assert user.is_active is False

    def test_response_does_not_contain_password(self, client, world_data):
        response = client.post(REGISTER_URL, make_user_payload(), format="json")

        assert "password" not in response.data

    def test_registered_user_has_student_role_by_default(self, client, world_data):
        payload = make_user_payload()
        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email=payload["email"])

        assert user.role == "student"

    # ── Duplicate ─────────────────────────────────────────────────────────────

    def test_register_duplicate_email_returns_400(self, client, world_data):
        payload = make_user_payload()
        client.post(REGISTER_URL, payload, format="json")

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # ── Required fields ───────────────────────────────────────────────────────

    @pytest.mark.parametrize("field", [
        "email",
        "password",
        "first_name",
        "last_name",
        "phone",
        "date_of_birth",
        "place_of_birth",
        "ci",
        "address",
        "city",
        "postal_code",
        "country",
        "privacy_consent",
    ])
    def test_register_missing_required_field_returns_400(self, client, world_data, field):
        payload = make_user_payload()
        del payload[field]

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_privacy_consent_false_returns_400(self, client, world_data):
        payload = make_user_payload(privacy_consent=False)

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # ── ACSI validation ───────────────────────────────────────────────────────

    def test_acsi_true_with_number_and_date_returns_201(self, client, world_data):
        payload = make_user_payload(
            acsi=True,
            acsi_number=12345,
            acsi_starting_date="2025-12-31",
        )

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_acsi_true_sets_expiration_one_year_after_starting_date(self, client, world_data):
        payload = make_user_payload(
            acsi=True,
            acsi_number=12345,
            acsi_starting_date="2025-12-31",
        )

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email=payload["email"])
        assert user.acsi_expiration_date.isoformat() == "2026-12-31"

    def test_acsi_true_missing_number_returns_400(self, client, world_data):
        payload = make_user_payload(
            acsi=True,
            acsi_number=None,
            acsi_starting_date="2025-12-31",
        )

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "acsi_number" in response.data

    def test_acsi_true_missing_date_returns_400(self, client, world_data):
        payload = make_user_payload(
            acsi=True,
            acsi_number=12345,
            acsi_starting_date=None,
        )

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "acsi_starting_date" in response.data

    def test_acsi_false_without_number_and_date_returns_201(self, client, world_data):
        payload = make_user_payload(
            acsi=False,
            acsi_number=None,
            acsi_starting_date=None,
        )

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    # ── Password validation ───────────────────────────────────────────────────

    def test_register_missing_password2_returns_400(self, client, world_data):
        payload = make_user_payload()
        del payload["password2"]

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_passwords_mismatch_returns_400(self, client, world_data):
        payload = make_user_payload(password2="different_password_99!")

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password2" in response.data

    def test_register_weak_password_returns_400(self, client, world_data):
        payload = make_user_payload(password="password", password2="password")

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_register_numeric_only_password_returns_400(self, client, world_data):
        payload = make_user_payload(password="12345678", password2="12345678")

        response = client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    # ── Email ─────────────────────────────────────────────────────────────────

    def test_register_sends_one_email(self, client, world_data):
        from django.core import mail

        client.post(REGISTER_URL, make_user_payload(), format="json")

        assert len(mail.outbox) == 1

    def test_register_email_sent_to_registered_address(self, client, world_data):
        from django.core import mail

        payload = make_user_payload()
        client.post(REGISTER_URL, payload, format="json")

        assert mail.outbox[0].to == [payload["email"]]

    def test_register_email_subject(self, client, world_data):
        from django.core import mail

        client.post(REGISTER_URL, make_user_payload(), format="json")
        print (mail.outbox[0].subject)
        assert "Bounce" in mail.outbox[0].subject

    def test_failed_registration_sends_no_email(self, client, world_data):
        from django.core import mail

        payload = make_user_payload()
        del payload["first_name"]
        client.post(REGISTER_URL, payload, format="json")

        assert len(mail.outbox) == 0