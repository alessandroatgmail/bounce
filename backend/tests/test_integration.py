# tests/events/test_integration.py
# Integration tests for the events domain.
# Tests the full stack: HTTP API + WebSocket consumer + DB signal.

import json
import pytest
from rest_framework import status as http_status
from channels.testing import WebsocketCommunicator
from core.asgi import application

from event.models import Event, Status
from utils.mock_event import make_event_payload
from asgiref.sync import sync_to_async

LIST_URL = "/api/events/events/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def create_event(**overrides):
    payload = make_event_payload(**overrides)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=payload["start_date"],
        end_date=payload["end_date"],
        duration=payload["duration"],
        capacity=payload["capacity"],
    )


# ---------------------------------------------------------------------------
# API: visibility rules
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestEventVisibilityIntegration:
    """Published/draft visibility rules enforced end-to-end through the API."""

    def test_published_event_visible_to_student(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data["id"] == event.pk

    def test_draft_event_hidden_from_student(self, student_client, world_data):
        event = create_event(status=Status.DRAFT)
        response = student_client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_published_to_draft_hides_from_student(self, staff_client, student_client, world_data):
        """Publishing then un-publishing an event makes it disappear for students."""

        from users.models import User
        print(f"\nstaff_client user: {staff_client.handler._force_user}")
        print(f"\nstudent_client user: {student_client.handler._force_user}")

        event = create_event(status=Status.PUBLISHED)

        # Confirm student can see it while published
        assert event is not None
        print (event.pk)
        assert student_client.get(detail_url(event.pk)).status_code == http_status.HTTP_200_OK

        # Staff sets it back to draft
        result = staff_client.patch(detail_url(event.pk), {"status": Status.DRAFT}, format="json")
        assert result.status_code == http_status.HTTP_200_OK

        event.refresh_from_db()
        assert event.status == Status.DRAFT

        # Student can no longer retrieve it
        assert student_client.get(detail_url(event.pk)).status_code == http_status.HTTP_404_NOT_FOUND

    def test_list_count_matches_published_only(self, student_client, world_data):
        create_event(status=Status.DRAFT)
        create_event(status=Status.CONFIRMED)
        create_event(status=Status.PUBLISHED)
        create_event(status=Status.PUBLISHED)

        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data['count'] == 2


# ---------------------------------------------------------------------------
# API: create → retrieve round-trip
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestEventCRUDIntegration:
    """Full create → retrieve → update → delete cycle via HTTP."""

    def test_create_and_retrieve_round_trip(self, staff_client, world_data):
        payload = make_event_payload(status=Status.PUBLISHED)
        create_response = staff_client.post(LIST_URL, payload, format="json")
        assert create_response.status_code == http_status.HTTP_201_CREATED

        pk = create_response.data["id"]
        retrieve_response = staff_client.get(detail_url(pk))
        assert retrieve_response.status_code == http_status.HTTP_200_OK
        assert retrieve_response.data["name"] == payload["name"]

    def test_update_and_verify_in_db(self, staff_client, world_data):
        event = create_event()
        staff_client.patch(detail_url(event.pk), {"capacity": 99}, format="json")
        event.refresh_from_db()
        assert event.capacity == 99

    def test_delete_removes_from_list(self, staff_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        staff_client.delete(detail_url(event.pk))
        response = staff_client.get(LIST_URL)
        ids = [e["id"] for e in response.data['results']]
        assert event.pk not in ids


# ---------------------------------------------------------------------------
# WebSocket: consumer connection and message delivery
# ---------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.websocket
class TestEventsWebSocketIntegration:
    """
    Tests the full signal → channel layer → WebSocket consumer pipeline.
    Uses channels.testing.WebsocketCommunicator (from the events_ws fixture).
    """

    @pytest.mark.django_db(transaction=True)  # transaction=True needed for on_commit
    async def test_ws_connects_successfully(self, events_ws):
        """A client can open a connection to ws/events/."""
        # The fixture already asserts connected=True; reaching here means it worked
        assert events_ws is not None

    @pytest.mark.django_db(transaction=True)
    async def test_ws_receives_payload_on_event_save(
            self,
            events_ws,
            aworld_data):
        """
        Saving an Event triggers the signal which broadcasts the full payload
        to all connected WebSocket clients.
        """
        payload = await sync_to_async(make_event_payload)(status=Status.PUBLISHED)

        event = await Event.objects.acreate(
            name=payload["name"],
            status=payload["status"],
            event_type_id=payload["event_type_id"],
            type=payload["type"],
            level_id=payload["level_id"],
            room_id=payload["room_id"],
            start_date=payload["start_date"],
            end_date=payload["end_date"],
            duration=payload["duration"],
            capacity=payload["capacity"],
        )

        message = await events_ws.receive_json_from(timeout=3)

        assert message["type"] == "event_updated"
        assert message["event"]["id"] == event.pk
        assert message["event"]["name"] == event.name
        assert message["event"]["status"] == Status.PUBLISHED

    # @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_ws_receives_updated_status_on_patch(
            self,
            transactional_db,
            events_ws,
            aworld_data,
            ):

        """
        Patching an event status to draft sends the updated payload via WS.
        events_ws already pulls in transactional_db, so on_commit fires.
        """

        payload = await sync_to_async(make_event_payload)(status=Status.PUBLISHED)

        event = await Event.objects.acreate(
            name=payload["name"],
            status=Status.PUBLISHED,
            event_type_id=payload["event_type_id"],
            type=payload["type"],
            level_id=payload["level_id"],
            room_id=payload["room_id"],
            start_date=payload["start_date"],
            end_date=payload["end_date"],
            duration=payload["duration"],
            capacity=payload["capacity"],
        )

        # Consume the creation broadcast first
        await events_ws.receive_json_from(timeout=3)

        event.status = Status.DRAFT
        await event.asave()

        message = await events_ws.receive_json_from(timeout=3)
        assert message["type"] == "event_updated"
        assert message["event"]["status"] == Status.DRAFT