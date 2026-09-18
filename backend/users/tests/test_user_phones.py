import pytest
from rest_framework.test import APIClient

from users.models import User

USER_PHONES_URL = '/api/auth/users/phones/'


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
        email='phoney@bounce.com', password='StrongPass123!', phone='+39 333 1111111', is_active=True,
    )


@pytest.fixture
def other_user_with_phone(db):
    return User.objects.create_user(
        email='phoney2@bounce.com', password='StrongPass123!', phone='+39 333 2222222', is_active=True,
    )


@pytest.fixture
def user_without_phone(db):
    return User.objects.create_user(
        email='nophone@bounce.com', password='StrongPass123!', is_active=True,
    )


class TestUserPhones:
    def test_student_forbidden(self, student_client, user_with_phone):
        res = student_client.post(USER_PHONES_URL, {'user_ids': [user_with_phone.id]}, format='json')
        assert res.status_code == 403

    def test_returns_phones_for_requested_ids_only(
        self, admin_client, user_with_phone, other_user_with_phone,
    ):
        res = admin_client.post(USER_PHONES_URL, {'user_ids': [user_with_phone.id]}, format='json')
        assert res.status_code == 200
        assert res.data['phones'] == ['+39 333 1111111']

    def test_blank_phones_excluded(self, admin_client, user_with_phone, user_without_phone):
        res = admin_client.post(
            USER_PHONES_URL,
            {'user_ids': [user_with_phone.id, user_without_phone.id]},
            format='json',
        )
        assert res.status_code == 200
        assert res.data['phones'] == ['+39 333 1111111']

    def test_unknown_ids_ignored(self, admin_client, user_with_phone):
        res = admin_client.post(
            USER_PHONES_URL,
            {'user_ids': [user_with_phone.id, 999999]},
            format='json',
        )
        assert res.status_code == 200
        assert res.data['phones'] == ['+39 333 1111111']

    def test_missing_user_ids(self, admin_client):
        res = admin_client.post(USER_PHONES_URL, {}, format='json')
        assert res.status_code == 400

    def test_empty_user_ids(self, admin_client):
        res = admin_client.post(USER_PHONES_URL, {'user_ids': []}, format='json')
        assert res.status_code == 400

    def test_non_integer_user_id_rejected(self, admin_client):
        res = admin_client.post(USER_PHONES_URL, {'user_ids': ['abc']}, format='json')
        assert res.status_code == 400

    def test_deleted_user_excluded(self, admin_client):
        deleted = User.objects.create_user(
            email='gone@deleted.invalid', password='StrongPass123!', phone='+39 333 3333333', is_active=True,
        )
        res = admin_client.post(USER_PHONES_URL, {'user_ids': [deleted.id]}, format='json')
        assert res.status_code == 200
        assert res.data['phones'] == []
