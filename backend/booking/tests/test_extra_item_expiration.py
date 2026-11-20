from datetime import datetime, timezone

import pytest
from django.db import IntegrityError

from booking.models import ExtraItem


def make_extra_item(**overrides):
    defaults = dict(name="Test", name_it="Test", name_en="Test", value=10)
    defaults.update(overrides)
    return ExtraItem.objects.create(**defaults)


class TestExtraItemExpirationDate:
    def test_defaults_to_2027_12_31(self, db):
        item = make_extra_item()
        assert item.expiration_date == datetime(2027, 12, 31, tzinfo=timezone.utc)

    def test_can_be_set_explicitly(self, db):
        item = make_extra_item(expiration_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
        assert item.expiration_date == datetime(2026, 6, 1, tzinfo=timezone.utc)

    def test_cannot_be_null(self, db):
        with pytest.raises(IntegrityError):
            make_extra_item(expiration_date=None)
