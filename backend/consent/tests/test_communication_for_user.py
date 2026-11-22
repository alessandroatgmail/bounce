"""
User-facing filter endpoint: given an extra_item, an event, and/or a plan,
return every Communication whose targets match ANY of them (OR), not just
one that matches all. A student booking a room tied to Communication A and
holding a membership tied to Communication B should see both in one call.
"""
import pytest
from rest_framework import status

from booking.models import ExtraItem
from consent.models import Communication
from event.models import Event
from membership.models import Membership
from utils.mock_event import make_event_payload

URL = "/api/consent/communications/for-user/"


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
def other_event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    return Event.objects.create(**payload)


@pytest.fixture
def plan(db):
    return Membership.objects.create(name="Full Pass")


@pytest.fixture
def other_plan(db):
    return Membership.objects.create(name="Half Pass")


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


class TestCommunicationForUserPermissions:
    def test_unauthenticated_request_returns_401(self, client):
        response = client.get(URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_can_access(self, student_client):
        response = student_client.get(URL)
        assert response.status_code == status.HTTP_200_OK


class TestCommunicationForUserFilter:
    def test_no_filters_returns_empty_list(self, student_client):
        make_communication()
        response = student_client.get(URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_filter_by_event(self, student_client, event, other_event):
        matching = make_communication(events=[event])
        make_communication(events=[other_event])
        response = student_client.get(URL, {"event": event.pk})
        assert response.status_code == status.HTTP_200_OK
        assert [c["id"] for c in response.data] == [matching.pk]

    def test_filter_by_plan(self, student_client, plan, other_plan):
        matching = make_communication(plans=[plan])
        make_communication(plans=[other_plan])
        response = student_client.get(URL, {"plan": plan.pk})
        assert response.status_code == status.HTTP_200_OK
        assert [c["id"] for c in response.data] == [matching.pk]

    def test_filter_by_extra_item(self, student_client, extra_item, other_extra_item):
        matching = make_communication(extra_items=[extra_item])
        make_communication(extra_items=[other_extra_item])
        response = student_client.get(URL, {"extra_item": extra_item.pk})
        assert response.status_code == status.HTTP_200_OK
        assert [c["id"] for c in response.data] == [matching.pk]

    def test_filters_combine_as_or(self, student_client, event, plan, other_event):
        from_event = make_communication(events=[event])
        from_plan = make_communication(plans=[plan])
        make_communication(events=[other_event])
        response = student_client.get(URL, {"event": event.pk, "plan": plan.pk})
        assert response.status_code == status.HTTP_200_OK
        assert {c["id"] for c in response.data} == {from_event.pk, from_plan.pk}

    def test_matching_communication_is_not_duplicated(self, student_client, event, plan):
        matching = make_communication(events=[event], plans=[plan])
        response = student_client.get(URL, {"event": event.pk, "plan": plan.pk})
        assert response.status_code == status.HTTP_200_OK
        assert [c["id"] for c in response.data] == [matching.pk]

    def test_unknown_extra_item_id_is_ignored(self, student_client, event):
        matching = make_communication(events=[event])
        response = student_client.get(URL, {"extra_item": 999999, "event": event.pk})
        assert response.status_code == status.HTTP_200_OK
        assert [c["id"] for c in response.data] == [matching.pk]
