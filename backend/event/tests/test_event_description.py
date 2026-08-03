import pytest
from rest_framework import status as http_status

from event.models import Event, EventDescription
from utils.mock_event import make_event_payload

LIST_URL = "/api/events/event-descriptions/"


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


def create_description(event=None, **overrides):
    event = event or create_event()
    payload = {"event": event, "language": "en", "desc": "<p>Hello</p>"}
    payload.update(overrides)
    return EventDescription.objects.create(**payload)


# ── Permissions ────────────────────────────────────────────────────────────────

class TestEventDescriptionPermissions:

    def test_unauthenticated_can_list(self, client, world_data):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK

    def test_unauthenticated_can_retrieve(self, client, world_data):
        description = create_description()
        response = client.get(detail_url(description.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_can_list(self, student_client, world_data):
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_cannot_create(self, student_client, world_data):
        event = create_event()
        response = student_client.post(
            LIST_URL, {"event_id": event.pk, "language": "en", "desc": "<p>Hi</p>"}, format="json",
        )
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, world_data):
        description = create_description()
        response = student_client.patch(detail_url(description.pk), {"desc": "<p>Hacked</p>"}, format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, world_data):
        description = create_description()
        response = student_client.delete(detail_url(description.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── Create ───────────────────────────────────────────────────────────────────

class TestEventDescriptionCreate:

    def test_staff_can_create(self, staff_client, world_data):
        event = create_event()
        response = staff_client.post(
            LIST_URL,
            {"event_id": event.pk, "language": "en", "desc": "<h1>Welcome</h1><p>Join us.</p>"},
            format="json",
        )
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert response.data["language"] == "en"
        assert response.data["desc"] == "<h1>Welcome</h1><p>Join us.</p>"
        assert response.data["event"] == event.pk

    def test_create_persists_to_db(self, staff_client, world_data):
        event = create_event()
        staff_client.post(
            LIST_URL, {"event_id": event.pk, "language": "it", "desc": "<p>Ciao</p>"}, format="json",
        )
        assert EventDescription.objects.filter(event=event, language="it").exists()

    def test_create_missing_event_id_returns_400(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, {"language": "en", "desc": "<p>Hi</p>"}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_missing_language_returns_400(self, staff_client, world_data):
        event = create_event()
        response = staff_client.post(LIST_URL, {"event_id": event.pk, "desc": "<p>Hi</p>"}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_invalid_language_returns_400(self, staff_client, world_data):
        event = create_event()
        response = staff_client.post(
            LIST_URL, {"event_id": event.pk, "language": "fr", "desc": "<p>Bonjour</p>"}, format="json",
        )
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_can_create_one_description_per_supported_language(self, staff_client, world_data):
        event = create_event()
        for language in ("en", "it"):
            response = staff_client.post(
                LIST_URL, {"event_id": event.pk, "language": language, "desc": f"<p>{language}</p>"}, format="json",
            )
            assert response.status_code == http_status.HTTP_201_CREATED, response.data
        assert EventDescription.objects.filter(event=event).count() == 2

    def test_duplicate_language_for_same_event_returns_400(self, staff_client, world_data):
        event = create_event()
        create_description(event=event, language="en")
        response = staff_client.post(
            LIST_URL, {"event_id": event.pk, "language": "en", "desc": "<p>Again</p>"}, format="json",
        )
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert EventDescription.objects.filter(event=event, language="en").count() == 1

    def test_same_language_allowed_on_different_events(self, staff_client, world_data):
        event_a = create_event()
        event_b = create_event()
        create_description(event=event_a, language="en")
        response = staff_client.post(
            LIST_URL, {"event_id": event_b.pk, "language": "en", "desc": "<p>Different event</p>"}, format="json",
        )
        assert response.status_code == http_status.HTTP_201_CREATED, response.data


# ── Update ───────────────────────────────────────────────────────────────────

class TestEventDescriptionUpdate:

    def test_staff_can_patch_desc(self, staff_client, world_data):
        description = create_description(language="en", desc="<p>Old</p>")
        response = staff_client.patch(detail_url(description.pk), {"desc": "<p>New</p>"}, format="json")
        assert response.status_code == http_status.HTTP_200_OK, response.data
        description.refresh_from_db()
        assert description.desc == "<p>New</p>"

    def test_staff_can_full_update(self, staff_client, world_data):
        description = create_description(language="en", desc="<p>Old</p>")
        event = description.event
        response = staff_client.put(
            detail_url(description.pk),
            {"event_id": event.pk, "language": "en", "desc": "<p>Replaced</p>"},
            format="json",
        )
        assert response.status_code == http_status.HTTP_200_OK, response.data
        description.refresh_from_db()
        assert description.desc == "<p>Replaced</p>"

    def test_update_to_language_already_used_on_same_event_returns_400(self, staff_client, world_data):
        event = create_event()
        create_description(event=event, language="en")
        it_description = create_description(event=event, language="it")
        response = staff_client.patch(detail_url(it_description.pk), {"language": "en"}, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        it_description.refresh_from_db()
        assert it_description.language == "it"

    def test_update_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.patch(detail_url(9999), {"desc": "<p>New</p>"}, format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Delete ───────────────────────────────────────────────────────────────────

class TestEventDescriptionDelete:

    def test_staff_can_delete(self, staff_client, world_data):
        description = create_description()
        response = staff_client.delete(detail_url(description.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, world_data):
        description = create_description()
        pk = description.pk
        staff_client.delete(detail_url(pk))
        assert not EventDescription.objects.filter(pk=pk).exists()

    def test_deleting_event_cascades_to_its_descriptions(self, staff_client, world_data):
        event = create_event()
        create_description(event=event, language="en")
        event.delete()
        assert not EventDescription.objects.filter(event_id=event.pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND
