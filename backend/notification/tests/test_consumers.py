"""
Tests for the EventNotificationConsumer WebSocket consumer.

Covers two key scenarios:
  1. Connected admin  — receives real-time notifications pushed via group_send.
  2. Offline admin   — pending (unread) notifications are flushed to the client
                       the moment they connect.

Test setup uses process_event() (from conftest) — the same notification-creation
logic the Kafka consumer runs — so the state mirrors real production behaviour.
"""
import pytest
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.urls import path

from notification.consumers import EventNotificationConsumer
from .conftest import process_event


# ── helpers ────────────────────────────────────────────────────────────────────

class _ForcedAuthMiddleware:
    """Inject a Django user into the ASGI scope without a real auth stack."""

    def __init__(self, app, user):
        self.app = app
        self.user = user

    async def __call__(self, scope, receive, send):
        scope["user"] = self.user
        await self.app(scope, receive, send)


def _ws_app(user):
    return _ForcedAuthMiddleware(
        URLRouter([path("ws/notifications/", EventNotificationConsumer.as_asgi())]),
        user,
    )


SAMPLE_EVENT = {"type": "user_registered", "email": "newuser@test.com", "id": 99}


# ── on-connect flush of pending notifications ──────────────────────────────────

class TestOnConnectNotifications:
    """Admin receives their unread notifications immediately upon connecting."""

    @pytest.mark.django_db(transaction=True)
    async def test_empty_list_when_no_pending_notifications(self, admin_user, in_memory_channel_layer):
        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected

        data = await communicator.receive_json_from()
        assert data == []

        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    async def test_unread_notifications_sent_on_connect(self, admin_user, in_memory_channel_layer):
        await process_event(SAMPLE_EVENT)

        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected

        data = await communicator.receive_json_from()
        assert len(data) == 1
        assert data[0]["event_type"] == "user_registered"
        assert data[0]["recipient"] == admin_user.email

        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    async def test_only_own_notifications_sent_on_connect(
        self, admin_user, second_admin, in_memory_channel_layer
    ):
        """Each admin only sees their own unread notifications on connect."""
        await process_event(SAMPLE_EVENT)  # creates one notification per admin

        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected

        data = await communicator.receive_json_from()
        assert len(data) == 1
        assert data[0]["recipient"] == admin_user.email

        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    async def test_multiple_pending_notifications_all_delivered_on_connect(
        self, admin_user, in_memory_channel_layer
    ):
        """All accumulated unread notifications are delivered in one batch."""
        for i in range(3):
            await process_event({"type": "user_registered", "email": f"u{i}@test.com", "id": i})

        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected

        data = await communicator.receive_json_from()
        assert len(data) == 3

        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    async def test_offline_admin_receives_notifications_saved_while_disconnected(
        self, admin_user, in_memory_channel_layer
    ):
        """
        Simulates an admin being offline when new users register.
        The Kafka consumer saves the notifications to the DB. When the admin
        later connects, they receive all accumulated unread notifications.
        """
        await process_event({"type": "user_registered", "email": "latecomer@test.com", "id": 1})

        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected

        data = await communicator.receive_json_from()
        assert len(data) == 1
        assert data[0]["recipient"] == admin_user.email
        assert data[0]["payload"]["email"] == "latecomer@test.com"

        await communicator.disconnect()


# ── real-time notifications for connected admins ───────────────────────────────

class TestRealtimeNotifications:
    """Admin connected via WebSocket receives broadcast notifications instantly."""

    @pytest.mark.django_db(transaction=True)
    async def test_connected_admin_receives_realtime_notification(
        self, admin_user, in_memory_channel_layer
    ):
        communicator = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert connected
        await communicator.receive_json_from()  # drain initial flush

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            "admin_dashboard",
            {"type": "notification.new", "payload": SAMPLE_EVENT},
        )

        data = await communicator.receive_json_from()
        assert data == SAMPLE_EVENT

        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    async def test_two_connected_admins_both_receive_realtime_notification(
        self, admin_user, second_admin, in_memory_channel_layer
    ):
        comm1 = WebsocketCommunicator(_ws_app(admin_user), "/ws/notifications/")
        comm2 = WebsocketCommunicator(_ws_app(second_admin), "/ws/notifications/")

        connected1, _ = await comm1.connect()
        connected2, _ = await comm2.connect()
        assert connected1 and connected2

        await comm1.receive_json_from()  # drain initial flushes
        await comm2.receive_json_from()

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            "admin_dashboard",
            {"type": "notification.new", "payload": SAMPLE_EVENT},
        )

        assert await comm1.receive_json_from() == SAMPLE_EVENT
        assert await comm2.receive_json_from() == SAMPLE_EVENT

        await comm1.disconnect()
        await comm2.disconnect()
