"""
Admin CRUD for Communication — the definition of a consent/notice a student
must see and agree to (e.g. "I understand I might lose this room if my
roommate doesn't confirm"). One row can be reused across several targets at
once (events/extra_items/plans), so e.g. 8 accommodation ExtraItems split
across two festivals only need 2 Communication rows, not 8 — this is the
main thing these tests check for.
"""
import pytest
from rest_framework import status

from booking.models import ExtraItem
from consent.models import Communication
from event.models import Event
from membership.models import Membership
from utils.mock_event import make_event_payload

LIST_URL = "/api/consent/communications/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


@pytest.fixture
def extra_item(db):
    return ExtraItem.objects.create(
        name="Double Room A", name_it="Camera Doppia A", name_en="Double Room A", value=120,
    )


@pytest.fixture
def other_extra_item(db):
    return ExtraItem.objects.create(
        name="Double Room B", name_it="Camera Doppia B", name_en="Double Room B", value=130,
    )


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    return Event.objects.create(**payload)


@pytest.fixture
def plan(db):
    return Membership.objects.create(name="Full Pass")


def make_payload(**overrides):
    payload = {
        "title": "Shared room disclaimer",
        "title_it": "Disclaimer camera condivisa",
        "title_en": "Shared room disclaimer",
        "desc": "I agree I am making a reservation for other persons too.",
        "desc_it": "Dichiaro di prenotare anche per altre persone.",
        "desc_en": "I agree I am making a reservation for other persons too.",
        "recurrent": False,
    }
    payload.update(overrides)
    return payload


def make_communication(**overrides):
    extra_items = overrides.pop("extra_items", [])
    events = overrides.pop("events", [])
    plans = overrides.pop("plans", [])
    defaults = dict(
        title="Shared room disclaimer", title_it="Disclaimer camera condivisa", title_en="Shared room disclaimer",
        desc="I agree ...", desc_it="Dichiaro ...", desc_en="I agree ...",
    )
    defaults.update(overrides)
    communication = Communication.objects.create(**defaults)
    communication.extra_items.set(extra_items)
    communication.events.set(events)
    communication.plans.set(plans)
    return communication


# ── Permissions ──────────────────────────────────────────────────────────────

class TestCommunicationPermissions:
    def test_unauthenticated_request_returns_401(self, client):
        response = client.get(LIST_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_list(self, student_client):
        response = student_client.get(LIST_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_create(self, student_client):
        response = student_client.post(LIST_URL, make_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client):
        communication = make_communication()
        response = student_client.patch(
            detail_url(communication.pk), {"title": "x"}, format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client):
        communication = make_communication()
        response = student_client.delete(detail_url(communication.pk))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Create ───────────────────────────────────────────────────────────────────

class TestCommunicationCreate:
    def test_admin_can_create_with_no_targets(self, admin_client):
        response = admin_client.post(LIST_URL, make_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        communication = Communication.objects.get(pk=response.data["id"])
        assert communication.title == "Shared room disclaimer"
        assert communication.recurrent is False
        assert communication.events.count() == 0
        assert communication.extra_items.count() == 0
        assert communication.plans.count() == 0

    def test_admin_can_create_targeting_several_extra_items_at_once(
        self, admin_client, extra_item, other_extra_item,
    ):
        """The actual feature being tested: one Communication reused across
        several ExtraItems in a single request, instead of one row per item."""
        response = admin_client.post(
            LIST_URL,
            make_payload(extra_item_ids=[extra_item.pk, other_extra_item.pk], recurrent=True),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        communication = Communication.objects.get(pk=response.data["id"])
        assert set(communication.extra_items.values_list("pk", flat=True)) == {extra_item.pk, other_extra_item.pk}
        assert communication.recurrent is True

    def test_admin_can_create_targeting_event_and_plan(self, admin_client, event, plan):
        response = admin_client.post(
            LIST_URL,
            make_payload(event_ids=[event.pk], plan_ids=[plan.pk]),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        communication = Communication.objects.get(pk=response.data["id"])
        assert list(communication.events.values_list("pk", flat=True)) == [event.pk]
        assert list(communication.plans.values_list("pk", flat=True)) == [plan.pk]

    def test_create_missing_title_returns_400(self, admin_client):
        payload = make_payload()
        del payload["title"]
        response = admin_client.post(LIST_URL, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── List / Retrieve ──────────────────────────────────────────────────────────

class TestCommunicationListRetrieve:
    def test_admin_can_list(self, admin_client):
        make_communication()
        response = admin_client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_retrieve_includes_nested_targets(self, admin_client, extra_item, other_extra_item, event, plan):
        communication = make_communication(extra_items=[extra_item, other_extra_item], events=[event], plans=[plan])
        response = admin_client.get(detail_url(communication.pk))
        assert response.status_code == status.HTTP_200_OK
        assert {item["id"] for item in response.data["extra_items"]} == {extra_item.pk, other_extra_item.pk}
        assert [item["id"] for item in response.data["events"]] == [event.pk]
        assert [item["id"] for item in response.data["plans"]] == [plan.pk]


# ── Update ───────────────────────────────────────────────────────────────────

class TestCommunicationUpdate:
    def test_admin_can_patch_targets(self, admin_client, extra_item, other_extra_item):
        communication = make_communication(extra_items=[extra_item])
        response = admin_client.patch(
            detail_url(communication.pk),
            {"extra_item_ids": [other_extra_item.pk]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        communication.refresh_from_db()
        assert list(communication.extra_items.values_list("pk", flat=True)) == [other_extra_item.pk]

    def test_admin_can_patch_recurrent(self, admin_client):
        communication = make_communication()
        response = admin_client.patch(
            detail_url(communication.pk), {"recurrent": True}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        communication.refresh_from_db()
        assert communication.recurrent is True


# ── Delete ───────────────────────────────────────────────────────────────────

class TestCommunicationDelete:
    def test_admin_can_delete(self, admin_client):
        communication = make_communication()
        response = admin_client.delete(detail_url(communication.pk))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Communication.objects.filter(pk=communication.pk).exists()
