"""
User-facing API to record that a student has seen/agreed to a Communication
("I agree I am making a reservation for other persons too.") — the Consent
model. Any authenticated user can save their own consent; the user is always
taken from the request, never from the payload.

Duplicate prevention is enforced in validation, not a DB constraint (a plain
unique_together on (communication, user, contribution) wouldn't catch
duplicates when contribution is NULL, since Postgres treats distinct NULLs
as non-equal) — except for a `recurrent` Communication, which must be
re-confirmable every time (e.g. once per booking), so duplicates are allowed
there on purpose.
"""
from datetime import timedelta

import pytest
from rest_framework import status

from booking.models import Contribution
from consent.models import Communication, Consent

URL = "/api/consent/consents/"


@pytest.fixture
def communication(db):
    return Communication.objects.create(
        title="Shared room disclaimer", title_it="Disclaimer camera condivisa", title_en="Shared room disclaimer",
        desc="I agree ...", desc_it="Dichiaro ...", desc_en="I agree ...",
    )


@pytest.fixture
def recurrent_communication(db):
    return Communication.objects.create(
        title="Per-booking disclaimer", title_it="Disclaimer per prenotazione", title_en="Per-booking disclaimer",
        desc="I agree ...", desc_it="Dichiaro ...", desc_en="I agree ...",
        recurrent=True,
    )


@pytest.fixture
def contribution(student_user, db):
    return Contribution.objects.create(user=student_user, amount=0)


@pytest.fixture
def other_contribution(student_user, db):
    return Contribution.objects.create(user=student_user, amount=0)


class TestConsentCreatePermissions:
    def test_unauthenticated_request_returns_401(self, client, communication):
        response = client.post(URL, {"communication_id": communication.pk}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestConsentCreate:
    def test_authenticated_can_create_without_contribution(self, student_client, student_user, communication):
        response = student_client.post(URL, {"communication_id": communication.pk}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        consent = Consent.objects.get(pk=response.data["id"])
        assert consent.user == student_user
        assert consent.communication == communication
        assert consent.contribution is None
        assert abs((consent.expiration_date - consent.date) - timedelta(days=365)) <= timedelta(days=1)

    def test_authenticated_can_create_with_contribution(
        self, student_client, student_user, communication, contribution,
    ):
        response = student_client.post(
            URL, {"communication_id": communication.pk, "contribution_id": contribution.pk}, format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        consent = Consent.objects.get(pk=response.data["id"])
        assert consent.contribution == contribution

    def test_cannot_set_user_from_payload(self, student_client, student_user, admin_user, communication):
        response = student_client.post(
            URL, {"communication_id": communication.pk, "user": admin_user.pk}, format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        consent = Consent.objects.get(pk=response.data["id"])
        assert consent.user == student_user

    def test_missing_communication_id_returns_400(self, student_client):
        response = student_client.post(URL, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_duplicate_without_contribution_returns_400(self, student_client, communication):
        student_client.post(URL, {"communication_id": communication.pk}, format="json")
        response = student_client.post(URL, {"communication_id": communication.pk}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_duplicate_with_same_contribution_returns_400(self, student_client, communication, contribution):
        student_client.post(
            URL, {"communication_id": communication.pk, "contribution_id": contribution.pk}, format="json",
        )
        response = student_client.post(
            URL, {"communication_id": communication.pk, "contribution_id": contribution.pk}, format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_same_communication_with_different_contribution_is_allowed(
        self, student_client, communication, contribution, other_contribution,
    ):
        student_client.post(
            URL, {"communication_id": communication.pk, "contribution_id": contribution.pk}, format="json",
        )
        response = student_client.post(
            URL, {"communication_id": communication.pk, "contribution_id": other_contribution.pk}, format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_recurrent_communication_allows_repeat_consent(self, student_client, recurrent_communication):
        first = student_client.post(URL, {"communication_id": recurrent_communication.pk}, format="json")
        second = student_client.post(URL, {"communication_id": recurrent_communication.pk}, format="json")
        assert first.status_code == status.HTTP_201_CREATED
        assert second.status_code == status.HTTP_201_CREATED
        assert Consent.objects.filter(communication=recurrent_communication).count() == 2
