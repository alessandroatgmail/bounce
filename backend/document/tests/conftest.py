import pytest
from rest_framework.test import APIClient

from users.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@bounce.com",
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
def other_user(db):
    """A second regular user, used to assert document ownership isolation."""
    return User.objects.create_user(
        email="other@bounce.com",
        password="StrongPass123!",
        is_staff=False,
        is_active=True,
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client
