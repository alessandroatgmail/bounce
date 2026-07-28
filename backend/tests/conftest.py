# tests/conftest.py
# Global fixtures shared across all test modules in tests/.
# Mirrors the existing app-level conftest so both test suites can coexist.

import pytest
from asgiref.sync import sync_to_async
from unittest.mock import patch

from rest_framework.test import APIClient
from channels.testing import WebsocketCommunicator

from users.models import User
from utils.load_worldcities import load_worldcities
from core.asgi import application
from utils.mock_event import make_event_payload
# adjust to your ASGI app path

from users.models import Role


# ---------------------------------------------------------------------------
# HTTP clients
# ---------------------------------------------------------------------------

# @pytest.fixture
# def client():
#     return APIClient()


@pytest.fixture(autouse=True)
def mock_email_tasks():
    """Prevent real emails from being dispatched to Celery during tests."""
    with patch("utils.tasks.send_activation_email.delay"), \
         patch("utils.tasks.send_email.delay"), \
         patch("utils.tasks.send_to_kafka.delay"):
        yield


@pytest.fixture
def world_data(db):
    """Seed a small slice of world cities (debug=True loads ~10 rows)."""
    load_worldcities(debug=True)


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        email="staff@bounce.com",
        password="StrongPass123!",
        is_staff=True,
        is_active=True,
        role=Role.ADMIN,
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email="student@bounce.com",
        password="StrongPass123!",
        is_staff=False,
        is_active=True,
        role=Role.STUDENT,
    )


@pytest.fixture
def staff_client(client, staff_user):
    client = APIClient()
    client.force_authenticate(user=staff_user)
    print (f"user staff? {staff_user.is_staff} actvie? {staff_user.is_active} role? {staff_user.role}")
    return client


@pytest.fixture
def student_client(client, student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


# ---------------------------------------------------------------------------
# Async fixtures — for use in async (Channels) tests
# ---------------------------------------------------------------------------

@pytest.fixture
async def aworld_data(transactional_db):
    """
    Async-compatible version of world_data.
    transactional_db is a pytest-django fixture that grants DB access
    with real commits — required for transaction.on_commit() to fire.
    We wrap the sync call in sync_to_async so it runs in a thread pool,
    avoiding the SynchronousOnlyOperation error.
    """
    await sync_to_async(load_worldcities)(debug=True)

@pytest.fixture
async def events_ws():
    """Open a WebSocket connection to ws/events/ and close it after the test."""
    communicator = WebsocketCommunicator(application, "/ws/events/")
    connected, _ = await communicator.connect()
    assert connected, "WebSocket failed to connect"
    yield communicator
    await communicator.disconnect()

@pytest.fixture
def create_world():
    from utils.mock_Event import make_event_payload
    EVENT_URL = "/api/events/events/"
    sc = staff_client()
    response = sc.post(EVENT_URL, make_event_payload(), format="json")

