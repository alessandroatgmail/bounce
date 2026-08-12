import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from users.models import User
from utils.load_worldcities import load_worldcities


@pytest.fixture(autouse=True)
def mock_email_tasks():
    with patch("utils.tasks.send_activation_email.delay"), \
         patch("utils.tasks.send_to_kafka.delay"):
        yield


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
def other_user(db):
    return User.objects.create_user(
        email="other@bounce.com",
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


@pytest.fixture
def world_data(db):
    load_worldcities(debug=True)
