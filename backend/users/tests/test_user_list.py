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


class TestUserListNameFilterMatchesEmail:
    """The `name` query param is also used to search by email, e.g. from the
    admin's partner picker (name, last name or email)."""

    def test_matches_email(self, admin_client, db):
        match = User.objects.create_user(
            email='findme@bounce.com', password='StrongPass123!', is_active=True,
        )
        other = User.objects.create_user(
            email='other@bounce.com', password='StrongPass123!', is_active=True,
        )
        res = admin_client.get(USERS_URL, {'name': 'findme'})
        assert res.status_code == 200
        ids = [u['id'] for u in res.data['results']]
        assert ids == [match.id]
        assert other.id not in ids

    def test_still_matches_first_or_last_name(self, admin_client, db):
        match = User.objects.create_user(
            email='zebra-owner@bounce.com', password='StrongPass123!', first_name='Zebra', is_active=True,
        )
        res = admin_client.get(USERS_URL, {'name': 'Zebra'})
        assert res.status_code == 200
        ids = [u['id'] for u in res.data['results']]
        assert ids == [match.id]
