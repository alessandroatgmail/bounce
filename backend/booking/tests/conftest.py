import pytest
from rest_framework.test import APIClient
from users.models import User
from utils.load_worldcities import load_worldcities


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
def subject_user(db):
    """A regular user who is the subject of contributions."""
    return User.objects.create_user(
        email="subject@bounce.com",
        password="StrongPass123!",
        is_staff=False,
        is_active=True,
    )

@pytest.fixture
def partner_user(db):
    """A regular user who is the subject of contributions."""
    return User.objects.create_user(
        email="subject@bounce.com",
        password="StrongPass123!",
        is_staff=False,
        is_active=True,
    )


@pytest.fixture
def admin_client(client, admin_user):
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(client, student_user):
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def world_data(db):
    load_worldcities(debug=True)
