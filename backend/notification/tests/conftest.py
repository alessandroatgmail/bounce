import pytest
from asgiref.sync import sync_to_async
from unittest.mock import patch, MagicMock

from notification.constants import EventType
from notification.models import Notification
from users.models import User


@pytest.fixture(autouse=True)
def mock_kafka_producer():
    """Prevent real Kafka connections in all notification tests."""
    with patch("users.tasks.get_producer") as mock_get:
        mock_get.return_value = MagicMock()
        yield


def process_event_sync(event_data: dict) -> None:
    """
    Replicates the notification-creation step from consume_user_events().
    Use this in sync tests (test_kafka_consumer.py).
    """
    admins = list(User.objects.filter(is_active=True, is_staff=True))
    Notification.objects.bulk_create([
        Notification(
            event_type=EventType.USER_REGISTERED,
            payload=event_data,
            recipient=admin,
        )
        for admin in admins
    ])


# thread_sensitive=False runs in a real thread-pool worker (no running event loop
# there), avoiding SynchronousOnlyOperation when called from pytest-asyncio's
# main-thread event loop.
process_event = sync_to_async(process_event_sync, thread_sensitive=False)


@pytest.fixture(autouse=True)
async def close_thread_db_connections():
    """
    Close database connections held open in asgiref worker threads after each
    async test. Without this, thread-pool and dedicated-sync-thread connections
    accumulate and prevent pytest from dropping the test database at teardown.

    This fixture is async, so pytest-asyncio only attaches it to async tests;
    sync tests are unaffected.
    """
    yield
    from django.db import connections
    # Close the connection in the dedicated thread used by database_sync_to_async
    # (thread_sensitive=True).
    await sync_to_async(connections.close_all, thread_sensitive=True)()
    # Close a connection in the thread-pool used by sync_to_async
    # (thread_sensitive=False).
    await sync_to_async(connections.close_all, thread_sensitive=False)()


@pytest.fixture
def in_memory_channel_layer(settings):
    """
    Replace the Redis channel layer with an in-memory one.
    Clears the ChannelLayerManager cache before and after each test so that
    the overridden settings take effect immediately.
    """
    settings.CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
    import channels.layers as _layers_module
    _layers_module.channel_layers.backends.clear()
    yield
    _layers_module.channel_layers.backends.clear()


@pytest.fixture
def admin_user(db):
    from users.models import User
    return User.objects.create_user(
        email="admin@bounce.test",
        password="AdminPass123!",
        is_staff=True,
        is_active=True,
    )


@pytest.fixture
def second_admin(db):
    from users.models import User
    return User.objects.create_user(
        email="admin2@bounce.test",
        password="AdminPass123!",
        is_staff=True,
        is_active=True,
    )


@pytest.fixture
def regular_user(db):
    from users.models import User
    return User.objects.create_user(
        email="user@bounce.test",
        password="UserPass123!",
        is_staff=False,
        is_active=True,
    )
