# users/tests/test_ws_ticket.py

import pytest
import redis
from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from django.test.utils import override_settings

User = get_user_model()


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

@pytest.fixture
def redis_client():
    """
    Returns a redis client pointed at db=1 (same db used by the view).
    After each test, flushes db=1 so tickets don't leak between tests.
    """
    client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield client
    client.flushdb()  # cleanup after the test


class TestWsTicketEndpoint:

    def test_returns_ticket(self, authenticated_client):
        """A valid request must return HTTP 200 and a non-empty ticket string."""
        url = reverse("ws-ticket")
        response = authenticated_client.post(url)

        assert response.status_code == 200
        assert "ticket" in response.data
        assert isinstance(response.data["ticket"], str)
        assert len(response.data["ticket"]) > 0

    def test_ticket_stored_in_redis(self, authenticated_client, redis_client, user):
        """The ticket must be stored in Redis with the correct user id as value."""
        url = reverse("ws-ticket")
        response = authenticated_client.post(url)

        ticket = response.data["ticket"]
        redis_key = f"ws_ticket:{ticket}"

        stored_user_id = redis_client.get(redis_key)

        assert stored_user_id is not None, "Ticket not found in Redis"
        assert stored_user_id == str(user.id)

    def test_ticket_ttl_is_short(self, authenticated_client, redis_client):
        """The ticket TTL must be between 1 and 15 seconds."""
        url = reverse("ws-ticket")
        response = authenticated_client.post(url)

        ticket = response.data["ticket"]
        redis_key = f"ws_ticket:{ticket}"

        ttl = redis_client.ttl(redis_key)

        # ttl returns -1 if no expiry, -2 if key doesn't exist
        assert 1 <= ttl <= 15, f"Unexpected TTL: {ttl}"

    def test_unauthenticated_request_is_rejected(self):
        """Without a valid token the endpoint must return 401."""
        client = APIClient()  # no authentication
        url = reverse("ws-ticket")
        response = client.post(url)

        assert response.status_code == 401