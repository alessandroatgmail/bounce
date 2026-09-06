import pytest
from unittest.mock import patch, MagicMock
from django.core import mail
from rest_framework.test import APIClient
from users.models import User
from core.celery import app as celery_app
from utils.load_worldcities import load_worldcities


@pytest.fixture(autouse=True)
def override_test_settings(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    settings.POST_OFFICE = {
        'DEFAULT_PRIORITY': 'now',
        'CELERY_ENABLED': True,
        'BACKENDS': {'default': 'django.core.mail.backends.locmem.EmailBackend'},
    }
    celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)

    with patch('utils.tasks.send_activation_email.delay'), \
         patch('utils.tasks.send_to_kafka.delay'):
        yield

    celery_app.conf.update(task_always_eager=False, task_eager_propagates=False)
    mail.outbox.clear()


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
def student_user(db):
    return User.objects.create_user(
        email='student@bounce.com',
        password='StrongPass123!',
        is_staff=False,
        is_active=True,
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def world_data(db):
    load_worldcities(debug=True)
