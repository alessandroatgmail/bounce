from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Contribution, ContributionStatus
from event.models import (
    Artist, Event, EventType, Frequency, Level, Location, Room, Status, Style,
    Type,
)
from users.models import City, User

ADMIN_LIST_URL = "/api/events/admin/"

# 1 count + 1 main select + 1 artists prefetch: the admin list is flat,
# so the budget is much tighter than the full events endpoint.
QUERY_BUDGET = 6


@pytest.fixture
def deps(db, world_data):
    event_type = EventType.objects.create(name="Course", frequency=Frequency.WEEKLY, partners=0)
    level = Level.objects.create(name="Beginner")
    location = Location.objects.create(name="Studio", address="Via Roma 1", city=City.objects.first())
    room = Room.objects.create(name="Room A", location=location, capacity=30)
    artist_user = User.objects.create_user(
        email="artist@bounce.com", password="StrongPass123!",
        first_name="Anna", last_name="Artist", is_active=True,
    )
    artist = Artist.objects.create(user=artist_user)
    return {"event_type": event_type, "level": level, "room": room, "artist": artist}


def make_event(deps, i=0, status=Status.PUBLISHED):
    start = timezone.now() + timedelta(days=1 + i)
    event = Event.objects.create(
        name=f"Event {i}",
        status=status,
        event_type=deps["event_type"],
        type=Type.MEMBERS,
        level=deps["level"],
        room=deps["room"],
        start_date=start,
        end_date=start + timedelta(hours=1),
        duration=60,
        capacity=20,
    )
    event.artists.set([deps["artist"]])
    return event


class TestEventAdminListPermissions:

    def test_anonymous_cannot_access(self, client, deps):
        response = client.get(ADMIN_LIST_URL)
        assert response.status_code in (
            http_status.HTTP_401_UNAUTHORIZED, http_status.HTTP_403_FORBIDDEN,
        )

    def test_student_cannot_access(self, student_client, deps):
        response = student_client.get(ADMIN_LIST_URL)
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_staff_can_access(self, staff_client, deps):
        response = staff_client.get(ADMIN_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK


class TestEventAdminListPayload:

    def test_payload_fields(self, staff_client, deps, student_user):
        event = make_event(deps)
        contribution = Contribution.objects.create(
            status=ContributionStatus.PAYED, amount=10, user=student_user,
        )
        contribution.events.add(event)

        response = staff_client.get(ADMIN_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        item = response.data["results"][0]

        assert item["id"] == event.pk
        assert item["name"] == "Event 0"
        assert item["status"] == Status.PUBLISHED
        assert item["event_type_name"] == "Course"
        assert item["start_date"] is not None
        assert item["room"] == "Room A Studio"
        assert item["artists"] == ["Anna Artist"]
        assert item["capacity"] == 20
        assert item["available_spot"] == 19  # capacity 20, one PAYED contribution

    def test_only_payed_contributions_reduce_available_spot(
        self, staff_client, deps, student_user
    ):
        event = make_event(deps)
        pending = Contribution.objects.create(
            status=ContributionStatus.RECEIVED, amount=10, user=student_user,
        )
        pending.events.add(event)

        response = staff_client.get(ADMIN_LIST_URL)
        item = response.data["results"][0]
        assert item["available_spot"] == 20

    def test_staff_sees_drafts(self, staff_client, deps):
        make_event(deps, status=Status.DRAFT)
        response = staff_client.get(ADMIN_LIST_URL)
        assert len(response.data["results"]) == 1

    def test_ordered_by_start_date(self, staff_client, deps):
        later = make_event(deps, i=5)
        earlier = make_event(deps, i=1)
        response = staff_client.get(ADMIN_LIST_URL)
        ids = [item["id"] for item in response.data["results"]]
        assert ids == [earlier.pk, later.pk]

    def test_name_filter(self, staff_client, deps):
        make_event(deps, i=0)
        make_event(deps, i=1)
        response = staff_client.get(ADMIN_LIST_URL, {"name": "Event 1"})
        assert [item["name"] for item in response.data["results"]] == ["Event 1"]


class TestEventAdminListQueryCount:

    def test_query_count_does_not_grow_with_events(self, staff_client, deps):
        for i in range(3):
            make_event(deps, i=i)
        staff_client.get(ADMIN_LIST_URL)  # warm up ContentType & friends

        with CaptureQueriesContext(connection) as small:
            response = staff_client.get(ADMIN_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK

        for i in range(3, 9):
            make_event(deps, i=i)
        with CaptureQueriesContext(connection) as large:
            response = staff_client.get(ADMIN_LIST_URL)
        assert len(response.data["results"]) == 9

        assert len(large.captured_queries) == len(small.captured_queries), (
            f"Query count grew from {len(small.captured_queries)} to "
            f"{len(large.captured_queries)}: the admin list endpoint has N+1 queries."
        )
        assert len(large.captured_queries) <= QUERY_BUDGET, (
            f"Full page used {len(large.captured_queries)} queries (budget {QUERY_BUDGET})."
        )
