import pytest
from rest_framework.test import APIClient
from users.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        email="staff@bounce.com",
        password="StrongPass123!",
        is_staff=True,
        is_active=True,
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email="student@bounce.com",
        password="StrongPass123!",
        is_staff=False,
        is_active=True,
    )


@pytest.fixture
def staff_client(client, staff_user):
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def student_client(client, student_user):
    client.force_authenticate(user=student_user)
    return client
