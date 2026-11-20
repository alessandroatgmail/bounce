"""
RegistrationLog — a raw capture of every registration POST (the base
my-memberships create, book-festival, book-free-festival), written before
any validation/processing runs. A fallback to retrieve exactly what a
student submitted even if the request itself gets rejected or something
downstream (email, Celery task) goes wrong — not derived from the
Contribution it may or may not have produced.
"""
import pytest
from rest_framework import status as http_status

from booking.models import RegistrationLog

pytestmark = pytest.mark.django_db

BASE_URL = "/api/booking/my-memberships/"
BOOK_FESTIVAL_URL = BASE_URL + "book-festival/"
BOOK_FREE_FESTIVAL_URL = BASE_URL + "book-free-festival/"


class TestRegistrationLog:
    def test_logs_raw_body_on_base_create_even_when_invalid(self, student_client, student_user):
        response = student_client.post(BASE_URL, {"membership_id": 999999}, format="json")

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        log = RegistrationLog.objects.get()
        assert log.user == student_user
        assert log.endpoint == "create"
        assert log.body == {"membership_id": 999999}

    def test_logs_raw_body_on_book_festival_even_when_invalid(self, student_client, student_user):
        response = student_client.post(BOOK_FESTIVAL_URL, {"membership_id": 999999}, format="json")

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        log = RegistrationLog.objects.get()
        assert log.user == student_user
        assert log.endpoint == "book-festival"
        assert log.body == {"membership_id": 999999}

    def test_logs_raw_body_on_book_free_festival_even_when_invalid(self, student_client, student_user):
        response = student_client.post(BOOK_FREE_FESTIVAL_URL, {"membership_id": 999999}, format="json")

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        log = RegistrationLog.objects.get()
        assert log.user == student_user
        assert log.endpoint == "book-free-festival"
        assert log.body == {"membership_id": 999999}

    def test_each_request_gets_its_own_log_row(self, student_client, student_user):
        student_client.post(BASE_URL, {"membership_id": 1}, format="json")
        student_client.post(BASE_URL, {"membership_id": 2}, format="json")

        assert RegistrationLog.objects.count() == 2
