import pytest
from django.core import mail
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

from core.celery import app as celery_app
from utils.load_worldcities import load_worldcities


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def world_data(db):
    """Seed countries, regions and cities from the first 10 rows of worldcities.csv."""
    load_worldcities(debug=True)


@pytest.fixture(autouse=True)
def use_locmem_email_backend(settings):
    """
    Force the locmem email backend and eager Celery execution for all tests.

    settings.CELERY_TASK_ALWAYS_EAGER alone is not enough — Celery reads its
    config from Django settings once at startup via config_from_object(), so
    runtime changes to Django settings are ignored. We must also update the
    live Celery app config directly.
    """
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True

    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )

    # Mock Kafka producer so tests don't need a real Kafka broker
    with patch("users.tasks.get_producer") as mock_producer:
        mock_producer.return_value = MagicMock()
        yield

    celery_app.conf.update(
        task_always_eager=False,
        task_eager_propagates=False,
    )
    mail.outbox.clear()
