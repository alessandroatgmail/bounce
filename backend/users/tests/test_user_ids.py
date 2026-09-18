import pytest
from rest_framework.test import APIClient

from users.models import User

USER_IDS_URL = '/api/auth/users/ids/'


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


class TestUserIds:
    def test_student_forbidden(self, student_client):
        res = student_client.get(USER_IDS_URL)
        assert res.status_code == 403

    def test_returns_all_matching_ids_unpaginated(self, admin_client, admin_user, student_user):
        # 25 extra users - more than the 20-per-page limit used by the main list endpoint.
        extra_ids = [
            User.objects.create_user(
                email=f'bulk{i}@bounce.com', password='StrongPass123!', is_active=True,
            ).id
            for i in range(25)
        ]
        res = admin_client.get(USER_IDS_URL)
        assert res.status_code == 200
        assert res.data['count'] == len(extra_ids) + 2  # + admin_user + student_user
        returned_ids = set(res.data['ids'])
        assert set(extra_ids) <= returned_ids
        assert admin_user.id in returned_ids
        assert student_user.id in returned_ids

    def test_name_filter_narrows_ids(self, admin_client):
        match = User.objects.create_user(
            email='findme@bounce.com', password='StrongPass123!', first_name='Zebra', is_active=True,
        )
        other = User.objects.create_user(
            email='other@bounce.com', password='StrongPass123!', first_name='Antelope', is_active=True,
        )
        res = admin_client.get(USER_IDS_URL, {'name': 'Zebra'})
        assert res.status_code == 200
        assert res.data['ids'] == [match.id]
        assert other.id not in res.data['ids']

    def test_excludes_deleted_users(self, admin_client):
        deleted = User.objects.create_user(
            email='someone@deleted.invalid', password='StrongPass123!', is_active=True,
        )
        res = admin_client.get(USER_IDS_URL)
        assert deleted.id not in res.data['ids']
