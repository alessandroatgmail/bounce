import pytest
import redis
from django.core import mail
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from post_office.models import EmailTemplate

from core.celery import app as celery_app
from utils.load_worldcities import load_worldcities

User = get_user_model()

TEST_REDIS_URL = "redis://redis:6379/2"  # db=2 — test only, never used by the app


@pytest.fixture(autouse=True)
def ensure_email_templates(db):
    """
    Recreates required email templates after transactional tests
    that truncate the database.
    """
    base, _ = EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Activate your Bounce account',
            'content': 'Hi {{ first_name }}, click here: {{ activation_link }}',
            'html_content': '<p>Hi {{ first_name }}, click here: {{ activation_link }}</p>',
        }
    )
    EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Attiva il tuo account Bounce',
            'content': 'Ciao {{ first_name }}, clicca qui: {{ activation_link }}',
            'html_content': '<p>Ciao {{ first_name }}, clicca qui: {{ activation_link }}</p>',
        }
    )
    EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Activate your Bounce account',
            'content': 'Hi {{ first_name }}, click here: {{ activation_link }}',
            'html_content': '<p>Hi {{ first_name }}, click here: {{ activation_link }}</p>',
        }
    )

    reset_base, _ = EmailTemplate.objects.get_or_create(
        name='password_reset_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Reset your Bounce password',
            'content': 'Hi {{ first_name }}, reset link: {{ reset_link }}',
            'html_content': '<p>Hi {{ first_name }}, <a href="{{ reset_link }}">reset your password</a></p>',
        }
    )
    for lang in ('it', 'en'):
        EmailTemplate.objects.get_or_create(
            name='password_reset_email',
            language=lang,
            default_template=reset_base,
            defaults={
                'subject': 'Reset your Bounce password',
                'content': 'Hi {{ first_name }}, reset link: {{ reset_link }}',
                'html_content': '<p>Hi {{ first_name }}, <a href="{{ reset_link }}">reset your password</a></p>',
            }
        )

@pytest.fixture(autouse=True)
def override_test_settings(settings):
    """
    Centralizes all settings overrides for the test suite.
    Using a single fixture avoids ordering issues when multiple
    fixtures modify the same pytest-django 'settings' object.
    """
    settings.TESTING = True
    settings.REDIS_TEST_URL = "redis://redis:6379/2"
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

    with patch("utils.tasks.get_producer") as mock_producer:
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

# This fixture is shared across tests in this file.
# It creates a real user in the test DB and returns it.
@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="test@example.com",
        password="testpassword123",
    )

@pytest.fixture
def authenticated_client(user):
    """
    Returns an APIClient already authenticated as 'user'.
    force_authenticate bypasses JWT so we don't need to call /token/ here —
    we're testing the ws-ticket endpoint, not the login flow.
    """
    client = APIClient()
    client.force_authenticate(user=user)
    return client