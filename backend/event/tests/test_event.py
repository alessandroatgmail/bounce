import pytest
from rest_framework import status as http_status

from event.models import Event, Status
from utils.mock_event import make_event_payload, make_event_payloads

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


# ── Authentication ────────────────────────────────────────────────────────────

class TestEventAuthentication:

    def test_unauthenticated_list_returns_401(self, client, world_data):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, world_data):
        response = client.post(LIST_URL, make_event_payload(), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Student permissions ───────────────────────────────────────────────────────

class TestEventStudentPermissions:

    def test_student_cannot_create_event(self, student_client, world_data):
        response = student_client.post(LIST_URL, make_event_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_event(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.put(detail_url(event.pk), make_event_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_partial_update_event(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.patch(detail_url(event.pk), {"name": "hacked"}, format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_event(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.delete(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── Student visibility ────────────────────────────────────────────────────────

class TestEventStudentVisibility:

    def test_student_can_list_published_events(self, student_client, world_data):
        create_event(status=Status.PUBLISHED)
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 1

    def test_student_cannot_see_draft_events_in_list(self, student_client, world_data):
        create_event(status=Status.DRAFT)
        response = student_client.get(LIST_URL)
        assert response.data == []

    def test_student_cannot_see_confirmed_events_in_list(self, student_client, world_data):
        create_event(status=Status.CONFIRMED)
        response = student_client.get(LIST_URL)
        assert response.data == []

    def test_student_list_returns_only_published_among_mixed(self, student_client, world_data):
        create_event(status=Status.DRAFT)
        create_event(status=Status.CONFIRMED)
        create_event(status=Status.PUBLISHED)
        create_event(status=Status.PUBLISHED)

        response = student_client.get(LIST_URL)
        assert len(response.data) == 2

    def test_student_can_retrieve_published_event(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_cannot_retrieve_draft_event(self, student_client, world_data):
        event = create_event(status=Status.DRAFT)
        response = student_client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_student_cannot_retrieve_confirmed_event(self, student_client, world_data):
        event = create_event(status=Status.CONFIRMED)
        response = student_client.get(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Staff list ────────────────────────────────────────────────────────────────

class TestEventStaffList:

    def test_staff_can_list_all_events(self, staff_client, world_data):
        create_event(status=Status.DRAFT)
        create_event(status=Status.CONFIRMED)
        create_event(status=Status.PUBLISHED)

        response = staff_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 3

    def test_list_returns_correct_fields(self, staff_client, world_data):
        create_event()
        response = staff_client.get(LIST_URL)
        expected = {
            "id", "name", "status",
            "event_type", "type", "level",
            "start_date", "end_date", "duration",
            "room", "capacity",
            "styles", "genres", "artists", "events",
        }
        assert set(response.data[0].keys()) == expected

    def test_empty_list_returns_empty_array(self, staff_client, world_data):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Staff create ──────────────────────────────────────────────────────────────

class TestEventCreate:

    def test_staff_can_create_event(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_event_payload(), format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, world_data):
        payload = make_event_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Event.objects.filter(name=payload["name"]).exists()

    def test_create_default_status_is_draft(self, staff_client, world_data):
        payload = make_event_payload()
        del payload["status"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["status"] == Status.DRAFT

    def test_create_returns_nested_event_type(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_event_payload(), format="json")
        assert set(response.data["event_type"].keys()) == {"id", "name", "frequency", "partners"}

    def test_create_returns_type_as_string(self, staff_client, world_data):
        payload = make_event_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["type"] == payload["type"]

    def test_create_returns_nested_level(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_event_payload(), format="json")
        assert set(response.data["level"].keys()) == {"id", "name"}

    def test_create_returns_nested_room_with_location(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_event_payload(), format="json")
        room = response.data["room"]
        assert set(room.keys()) == {"id", "name", "capacity", "location"}
        assert set(room["location"].keys()) == {"id", "name", "address", "city"}
        assert set(room["location"]["city"].keys()) == {"id", "name", "country"}

    def test_create_returns_nested_styles(self, staff_client, world_data):
        payload = make_event_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["styles"]) == len(payload["style_ids"])

    def test_create_returns_nested_genres(self, staff_client, world_data):
        payload = make_event_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["genres"]) == len(payload["genre_ids"])

    def test_create_returns_nested_artists(self, staff_client, world_data):
        payload = make_event_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["artists"]) == len(payload["artist_ids"])
        assert "full_name" in response.data["artists"][0]

    @pytest.mark.parametrize("field", ["name", "event_type_id", "room_id",
                                        "start_date", "end_date", "duration", "capacity"])
    def test_create_missing_required_field_returns_400(self, staff_client, world_data, field):
        payload = make_event_payload()
        del payload[field]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_end_before_start_returns_400(self, staff_client, world_data):
        payload = make_event_payload()
        payload["start_date"], payload["end_date"] = payload["end_date"], payload["start_date"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Staff retrieve ────────────────────────────────────────────────────────────

class TestEventRetrieve:

    def test_staff_can_retrieve_any_status(self, staff_client, world_data):
        for s in (Status.DRAFT, Status.CONFIRMED, Status.PUBLISHED):
            event = create_event(status=s)
            response = staff_client.get(detail_url(event.pk))
            assert response.status_code == http_status.HTTP_200_OK

    def test_retrieve_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Staff update ──────────────────────────────────────────────────────────────

class TestEventUpdate:

    def test_staff_can_full_update_event(self, staff_client, world_data):
        event = create_event()
        response = staff_client.put(detail_url(event.pk), make_event_payload(), format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_full_update_changes_fields(self, staff_client, world_data):
        event = create_event()
        new_payload = make_event_payload(name="Updated Event", capacity=999)
        staff_client.put(detail_url(event.pk), new_payload, format="json")
        event.refresh_from_db()
        assert event.name == "Updated Event"
        assert event.capacity == 999

    def test_staff_can_publish_event(self, staff_client, world_data):
        event = create_event(status=Status.DRAFT)
        payload = make_event_payload(status=Status.PUBLISHED)
        staff_client.put(detail_url(event.pk), payload, format="json")
        event.refresh_from_db()
        assert event.status == Status.PUBLISHED

    def test_put_end_before_start_returns_400(self, staff_client, world_data):
        event = create_event()
        payload = make_event_payload()
        payload["start_date"], payload["end_date"] = payload["end_date"], payload["start_date"]
        response = staff_client.put(detail_url(event.pk), payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Staff partial update ──────────────────────────────────────────────────────

class TestEventPartialUpdate:

    def test_staff_can_patch_event(self, staff_client, world_data):
        event = create_event()
        response = staff_client.patch(detail_url(event.pk), {"name": "Patched"}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_patch_changes_only_provided_fields(self, staff_client, world_data):
        event = create_event(capacity=50)
        staff_client.patch(detail_url(event.pk), {"name": "Patched Name"}, format="json")
        event.refresh_from_db()
        assert event.name == "Patched Name"
        assert event.capacity == 50

    def test_patch_status_to_published(self, staff_client, world_data):
        event = create_event(status=Status.DRAFT)
        staff_client.patch(detail_url(event.pk), {"status": Status.PUBLISHED}, format="json")
        event.refresh_from_db()
        assert event.status == Status.PUBLISHED


# ── Staff delete ──────────────────────────────────────────────────────────────

class TestEventDelete:

    def test_staff_can_delete_event(self, staff_client, world_data):
        event = create_event()
        response = staff_client.delete(detail_url(event.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, world_data):
        event = create_event()
        pk = event.pk
        staff_client.delete(detail_url(pk))
        assert not Event.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, world_data):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND
