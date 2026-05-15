import pytest
import redis
from django.core import mail
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

from core.celery import app as celery_app
from utils.load_worldcities import load_worldcities

TEST_REDIS_URL = "redis://redis:6379/2"  # db=2 — test only, never used by the app


@pytest.fixture(autouse=True)
def override_test_settings(settings):
    """
    Centralizes all settings overrides for the test suite.
    Using a single fixture avoids ordering issues when multiple
    fixtures modify the same pytest-django 'settings' object.
    """
    settings.TESTING = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )

    with patch("users.tasks.get_producer") as mock_producer:
        mock_producer.return_value = MagicMock()
        yield

    celery_app.conf.update(
        task_always_eager=False,
        task_eager_propagates=False,
    )
    mail.outbox.clear()


@pytest.fixture
def redis_client():
    """
    Real Redis client on db=2 — isolated from app data.
    Flushes before and after each test to avoid state leakage.
    """
    client = redis.Redis.from_url(TEST_REDIS_URL, decode_responses=True)
    client.flushdb()
    yield client
    client.flushdb()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def world_data(db):
    """Seed countries, regions and cities from the first 10 rows of worldcities.csv."""
    load_worldcities(debug=True)