import uuid

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()

QRCODE_URL = "/api/auth/me/qrcode/"


@pytest.mark.django_db
class TestUserUUID:
    def test_uuid_auto_generated_on_create(self):
        user = User.objects.create_user(email="a@test.com", password="pass1234!")
        assert user.uuid is not None
        assert isinstance(user.uuid, uuid.UUID)

    def test_uuid_unique_across_users(self):
        u1 = User.objects.create_user(email="u1@test.com", password="pass1234!")
        u2 = User.objects.create_user(email="u2@test.com", password="pass1234!")
        assert u1.uuid != u2.uuid

    def test_uuid_stable_after_save(self):
        user = User.objects.create_user(email="stable@test.com", password="pass1234!")
        original = user.uuid
        user.first_name = "Updated"
        user.save(update_fields=["first_name"])
        user.refresh_from_db()
        assert user.uuid == original

    def test_profile_image_null_by_default(self):
        user = User.objects.create_user(email="noimg@test.com", password="pass1234!")
        assert not user.profile_image
