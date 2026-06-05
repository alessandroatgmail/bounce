import pytest
from rest_framework import status as http_status
from membership.models import Discount

LIST_URL = "/api/membership/discounts/"

# def create_discount(**overrides):
#     payload = create_discount_payload(**overrides)
#     return Discount.objects.create(
#        **payload
#     )


def create_discount_payload(**overrides):
    payload = {
        "name": "couple",
        "name_ext": "Couple booking",
        "description": "Couple booking",
        "rate": 20
    }
    payload.update(overrides)
    return payload

def detail_url(pk):
    return f"{LIST_URL}{pk}/"

class TestDiscountAuthentication:

    def test_unauthenticated_list_returns_401(self, client):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        discount = Discount.objects.first()
        response = client.get(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client):
        response = client.post(LIST_URL, create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_update_returns_401(self, client, db):
        discount = Discount.objects.first()
        response = client.put(detail_url(discount.pk), create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_delete_returns_401(self, client, db):
        discount = Discount.objects.first()
        response = client.delete(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


class TestDiscountStudent:

    def test_unauthenticated_list_returns_200(self, student_client):
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 3

    def test_unauthenticated_retrieve_returns_401(self, student_client, db):
        discount = Discount.objects.first()
        response = student_client.get(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_unauthenticated_create_returns_403(self, student_client):
        response = student_client.post(LIST_URL, create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_unauthenticated_update_returns_401(self, student_client, db):
        discount = Discount.objects.first()
        response = student_client.put(detail_url(discount.pk), create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_unauthenticated_delete_returns_401(self, student_client, db):
        discount = Discount.objects.first()
        response = student_client.delete(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


class TestDiscountStaff:

    def test_unauthenticated_list_returns_200(self, staff_client):
        response = staff_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 3

    def test_unauthenticated_retrieve_returns_200(self, staff_client, db):
        discount = Discount.objects.first()
        response = staff_client.get(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_unauthenticated_create_returns_201(self, staff_client):
        response = staff_client.post(LIST_URL, create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_unauthenticated_update_returns_204(self, staff_client, db):
        discount = Discount.objects.first()
        response = staff_client.put(detail_url(discount.pk), create_discount_payload(), format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_unauthenticated_delete_returns_204(self, staff_client, db):
        discount = Discount.objects.first()
        response = staff_client.delete(detail_url(discount.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT
