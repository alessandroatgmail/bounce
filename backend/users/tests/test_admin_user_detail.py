"""
GET/PUT /api/auth/users/<id>/ — admin-only retrieval and editing of another
user's full profile (the same shape/rules self-service /me/ uses), for
admin-facing "view/edit profile" cards such as the one on the ACSI extra
items panel.
"""
import pytest
from rest_framework.test import APIClient

from users.models import User


def detail_url(user_id):
    return f'/api/auth/users/{user_id}/'


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@bounce.com', password='StrongPass123!',
        is_staff=True, is_superuser=True, is_active=True,
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email='student@bounce.com', password='StrongPass123!',
        is_staff=False, is_active=True,
    )


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def full_student(db):
    return User.objects.create_user(
        email='mario@bounce.com', password='StrongPass123!',
        first_name='Mario', last_name='Rossi', phone='+39 041 000000',
        ci='RSSMRA90H15L736Z', address='Via Roma 1', postal_code='30100',
        acsi=True, acsi_number='ACSI123', acsi_starting_date='2026-01-01',
        acsi_expiration_date='2027-01-01', is_active=True,
    )


class TestAdminUserDetail:
    def test_student_forbidden(self, student_client, full_student):
        res = student_client.get(detail_url(full_student.id))
        assert res.status_code == 403

    def test_returns_full_profile(self, admin_client, full_student):
        res = admin_client.get(detail_url(full_student.id))
        assert res.status_code == 200
        assert res.data['first_name'] == 'Mario'
        assert res.data['last_name'] == 'Rossi'
        assert res.data['phone'] == '+39 041 000000'
        assert res.data['ci'] == 'RSSMRA90H15L736Z'
        assert res.data['address'] == 'Via Roma 1'
        assert res.data['acsi_number'] == 'ACSI123'
        assert res.data['acsi_expiration_date'] == '2027-01-01'

    def test_user_not_found(self, admin_client):
        res = admin_client.get(detail_url(999999))
        assert res.status_code == 404


class TestAdminUserDetailUpdate:
    def test_student_forbidden(self, student_client, full_student):
        res = student_client.put(detail_url(full_student.id), {'first_name': 'Hacked'}, format='json')
        assert res.status_code == 403

    def test_admin_can_update_profile(self, admin_client, full_student):
        res = admin_client.put(
            detail_url(full_student.id),
            {'first_name': 'Luigi', 'phone': '+39 041 111111'},
            format='json',
        )
        assert res.status_code == 200
        assert res.data['first_name'] == 'Luigi'
        assert res.data['phone'] == '+39 041 111111'
        full_student.refresh_from_db()
        assert full_student.first_name == 'Luigi'
        assert full_student.phone == '+39 041 111111'
        # Unrelated fields are untouched by the partial update.
        assert full_student.last_name == 'Rossi'

    def test_acsi_expiration_recomputed_on_starting_date_update(self, admin_client, full_student):
        res = admin_client.put(
            detail_url(full_student.id),
            {'acsi': True, 'acsi_number': 'ACSI999', 'acsi_starting_date': '2026-03-01'},
            format='json',
        )
        assert res.status_code == 200
        assert res.data['acsi_expiration_date'] == '2027-03-01'

    def test_acsi_true_without_number_rejected(self, admin_client, full_student):
        res = admin_client.put(
            detail_url(full_student.id),
            {'acsi': True, 'acsi_number': '', 'acsi_starting_date': ''},
            format='json',
        )
        assert res.status_code == 400

    def test_privacy_consent_false_deactivates_user(self, admin_client, full_student):
        res = admin_client.put(
            detail_url(full_student.id),
            {'privacy_consent': False},
            format='json',
        )
        assert res.status_code == 200
        assert res.data['is_active'] is False
        full_student.refresh_from_db()
        assert full_student.is_active is False

    def test_user_not_found(self, admin_client):
        res = admin_client.put(detail_url(999999), {'first_name': 'Ghost'}, format='json')
        assert res.status_code == 404
