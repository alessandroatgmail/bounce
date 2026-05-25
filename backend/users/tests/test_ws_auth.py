# notification/tests/test_ws_auth.py

import pytest
from channels.testing import WebsocketCommunicator
from core.asgi import application
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
# from channels.layers import get_channel_layer
# from django.test.utils import override_settings

User = get_user_model()

# TEST_CHANNEL_LAYERS = {
#     "default": {
#         "BACKEND": "channels.layers.InMemoryChannelLayer",
#     }
# }

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="ws@example.com",
        password="testpassword123",
    )

@pytest.mark.asyncio
class TestWsTicketMiddleware:

    @pytest.mark.django_db(transaction=True)
    async def test_valid_ticket_connects(self, user):
        """A valid ticket must allow the WebSocket handshake to complete."""
        # Step 1: get a real ticket via the REST endpoint
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.post("/api/auth/ws-ticket/")
        ticket = response.data["ticket"]
        print ("---- RESPONSE DATA ----")
        print (response.data)

        # Step 2: open a WS connection passing the ticket as query param
        communicator = WebsocketCommunicator(
            application,
            f"/ws/notifications/?ticket={ticket}"
        )
        connected, _ = await communicator.connect()

        assert connected, "WebSocket should have connected with a valid ticket"
        await communicator.disconnect()

    @pytest.mark.asyncio
    @pytest.mark.django_db(transaction=True)
    async def test_invalid_ticket_is_rejected(self):
        """A fake or expired ticket must cause the connection to be refused."""
        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/?ticket=00000000-0000-0000-0000-000000000000"
        )
        connected, _ = await communicator.connect()

        assert not connected, "WebSocket should have been rejected with invalid ticket"
        await communicator.disconnect()

    async def test_missing_ticket_is_rejected(self):
        """No ticket at all must also be refused."""
        communicator = WebsocketCommunicator(
            application,
            "ws/notifications/"
        )
        connected, _ = await communicator.connect()

        assert not connected, "WebSocket should have been rejected with no ticket"
        await communicator.disconnect()