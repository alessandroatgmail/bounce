import pytest
from django.core import mail
from rest_framework.test import APIClient

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
    """Force the locmem email backend for all tests so emails land in mail.outbox."""
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    mail.outbox.clear()
