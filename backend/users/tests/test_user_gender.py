import pytest

from users.models import Gender, User


class TestUserGender:
    def test_defaults_to_none(self, db):
        user = User.objects.create_user(email='nogender@bounce.com', password='StrongPass123!')
        assert user.gender is None

    @pytest.mark.parametrize('value', [Gender.MALE, Gender.FEMALE, Gender.OTHER])
    def test_can_set_each_choice(self, db, value):
        user = User.objects.create_user(email=f'{value}@bounce.com', password='StrongPass123!', gender=value)
        user.refresh_from_db()
        assert user.gender == value

    def test_can_set_prefer_not_to_say(self, db):
        """Distinct from leaving gender unset (None) — this is an explicit
        answer, needed to tell "declined to answer" apart from "never asked"
        for an outreach email campaign."""
        user = User.objects.create_user(
            email='declined@bounce.com', password='StrongPass123!', gender=Gender.PREFER_NOT_TO_SAY,
        )
        user.refresh_from_db()
        assert user.gender == Gender.PREFER_NOT_TO_SAY
        assert user.gender is not None
