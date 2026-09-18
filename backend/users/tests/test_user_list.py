import pytest
from rest_framework.test import APIClient

from users.models import User

USERS_URL = '/api/auth/users/'


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@bounce.com',
        password='StrongPass123!',
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='student@bounce.com',
        password='StrongPass123!',
        is_staff=False,
        is_active=True,
    )


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def user_with_phone(db):
    return User.objects.create_user(
        email='phoney@bounce.com',
        password='StrongPass123!',
        first_name='Phon',
        last_name='Zzz',
        phone='+39 333 1234567',
        is_active=True,
    )


class TestUserListPhone:
    def test_student_forbidden(self, student_client):
        res = student_client.get(USERS_URL)
        assert res.status_code == 403

    def test_phone_included_in_response(self, admin_client, user_with_phone):
        res = admin_client.get(USERS_URL)
        assert res.status_code == 200
        entry = next(u for u in res.data['results'] if u['id'] == user_with_phone.id)
        assert entry['phone'] == '+39 333 1234567'

    def test_blank_phone_included_as_empty_string(self, admin_client, admin_user):
        res = admin_client.get(USERS_URL)
        assert res.status_code == 200
        entry = next(u for u in res.data['results'] if u['id'] == admin_user.id)
        assert entry['phone'] == ''
