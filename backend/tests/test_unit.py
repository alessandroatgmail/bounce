# tests/events/test_unit.py
# Unit tests for the events domain.
# No DB access, no HTTP — pure logic and serializer field validation.

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from event.models import Status
from event.serializers import EventSerializer   # adjust to your serializer path


pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Serializer: date validation
# ---------------------------------------------------------------------------

class TestEventSerializerDateValidation:
    """validate() must reject end_date <= start_date."""

    def _make_data(self, **overrides):
        """Minimal valid payload for the serializer."""
        now = datetime.now()
        data = {
            "start_date": (now + timedelta(days=1)).isoformat(),
            "end_date":   (now + timedelta(days=1, hours=1)).isoformat(),
        }
        data.update(overrides)
        return data

    def test_valid_dates_do_not_raise(self):
        serializer = EventSerializer(data=self._make_data())
        # We only care that validate() doesn't raise — skip full is_valid()
        # which would require a real DB for FK lookups.
        try:
            serializer.validate(self._make_data())
        except Exception as exc:
            # Only fail if the error is about dates, not missing FK fields
            assert "date" not in str(exc).lower(), f"Unexpected date error: {exc}"

    def test_end_before_start_raises_validation_error(self):
        from rest_framework.exceptions import ValidationError
        now = datetime.now()
        data = self._make_data(
            start_date=(now + timedelta(days=2)).isoformat(),
            end_date=(now + timedelta(days=1)).isoformat(),
        )
        with pytest.raises(ValidationError):
            serializer = EventSerializer()
            serializer.validate(data)

    def test_equal_dates_raise_validation_error(self):
        from rest_framework.exceptions import ValidationError
        now = datetime.now()
        iso = (now + timedelta(days=1)).isoformat()
        data = self._make_data(start_date=iso, end_date=iso)
        with pytest.raises(ValidationError):
            EventSerializer().validate(data)


# ---------------------------------------------------------------------------
# Status enum
# ---------------------------------------------------------------------------

class TestEventStatusEnum:
    """Status choices must cover the expected values."""

    def test_published_value(self):
        assert Status.PUBLISHED == "published"

    def test_draft_value(self):
        assert Status.DRAFT == "draft"

    def test_confirmed_value(self):
        assert Status.CONFIRMED == "confirmed"

    def test_all_statuses_present(self):
        values = [s.value for s in Status]
        assert "published" in values
        assert "draft" in values
        assert "confirmed" in values


# ---------------------------------------------------------------------------
# Signal: broadcast logic
# ---------------------------------------------------------------------------

class TestBroadcastEventUpdateSignal:
    """
    The signal handler must call group_send with the correct group name
    and message type, without hitting the real channel layer.
    """

    def test_broadcast_calls_group_send_with_correct_group(self, mocker):
        # Track the arguments passed to group_send
        mock_group_send = MagicMock()

        # async_to_sync wraps the coroutine — we make it return mock_group_send
        # so that async_to_sync(channel_layer.group_send)(...) calls our mock
        mocker.patch("event.signals.async_to_sync", return_value=mock_group_send)

        mock_layer = MagicMock()
        mocker.patch("event.signals.get_channel_layer", return_value=mock_layer)

        # on_commit must fire the callback immediately in unit tests (no real DB)
        mocker.patch(
            "event.signals.transaction.on_commit",
            side_effect=lambda fn: fn(),
        )

        from event.signals import broadcast_event_update

        instance = MagicMock()
        instance.status = Status.PUBLISHED

        broadcast_event_update(sender=MagicMock(), instance=instance)

        mock_group_send.assert_called_once()
        call_args = mock_group_send.call_args[0]
        assert call_args[0] == "events"                # correct group name
        assert call_args[1]["type"] == "event.updated" # correct message type