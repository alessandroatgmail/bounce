import io
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image as PILImage
from rest_framework import status as http_status

from event.models import Event, Status
from utils.mock_event import make_event_payload

LIST_URL = "/api/events/events/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def _make_image(name="test.jpg"):
    buf = io.BytesIO()
    img = PILImage.new("RGB", (10, 10), color=(255, 0, 0))
    img.save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/jpeg")


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


class TestEventImageUpload:

    def test_admin_can_upload_image(self, staff_client, world_data):
        event = create_event()
        response = staff_client.patch(
            detail_url(event.pk),
            {"image": _make_image()},
            format="multipart",
        )
        assert response.status_code == http_status.HTTP_200_OK
        event.refresh_from_db()
        assert bool(event.image) is True

    def test_student_cannot_upload_image(self, student_client, world_data):
        event = create_event(status=Status.PUBLISHED)
        response = student_client.patch(
            detail_url(event.pk),
            {"image": _make_image()},
            format="multipart",
        )
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_image_url_returned_in_response(self, staff_client, world_data):
        event = create_event()
        response = staff_client.patch(
            detail_url(event.pk),
            {"image": _make_image()},
            format="multipart",
        )
        assert response.data["image"] is not None
        assert "events/" in response.data["image"]

    def test_event_without_image_has_null_effective_image(self, staff_client, world_data):
        event = create_event()
        response = staff_client.get(detail_url(event.pk))
        assert response.data["effective_image"] is None

    def test_event_with_own_image_returns_own_effective_image(self, staff_client, world_data):
        event = create_event()
        staff_client.patch(
            detail_url(event.pk),
            {"image": _make_image()},
            format="multipart",
        )
        response = staff_client.get(detail_url(event.pk))
        assert response.data["effective_image"] is not None

    def test_child_without_image_inherits_parent_image(self, staff_client, world_data):
        parent = create_event()
        child = create_event()
        parent.events.add(child)

        # Give only the parent an image
        staff_client.patch(
            detail_url(parent.pk),
            {"image": _make_image("parent.jpg")},
            format="multipart",
        )

        response = staff_client.get(detail_url(child.pk))
        assert response.data["effective_image"] is not None

    def test_child_with_own_image_uses_own_not_parent(self, staff_client, world_data):
        parent = create_event()
        child = create_event()
        parent.events.add(child)

        staff_client.patch(
            detail_url(parent.pk),
            {"image": _make_image("parent.jpg")},
            format="multipart",
        )
        staff_client.patch(
            detail_url(child.pk),
            {"image": _make_image("child.jpg")},
            format="multipart",
        )

        child.refresh_from_db()
        parent.refresh_from_db()
        assert child.effective_image.name != parent.image.name

    def test_child_without_parent_image_returns_null_effective_image(self, staff_client, world_data):
        parent = create_event()
        child = create_event()
        parent.events.add(child)

        response = staff_client.get(detail_url(child.pk))
        assert response.data["effective_image"] is None
