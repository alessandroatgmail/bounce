from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution, ContributionStatus
from event.models import (
    Artist, ArtistType, Event, EventType, Frequency, Genre, Level, Location,
    PartnerRole, Room, Status, Style, Type,
)
from membership.models import Membership, MembershipRule, MembershipType
from users.models import City, User

LIST_URL = "/api/events/events/"

# The optimized endpoint should serve a full page with a flat number of
# queries: 1 count + 1 main select + one query per prefetched relation,
# independent of how many events are on the page.
QUERY_BUDGET = 25


@pytest.fixture
def booker(db):
    return User.objects.create_user(
        email="booker@bounce.com",
        password="StrongPass123!",
        first_name="Bruno",
        last_name="Booker",
        is_active=True,
    )


@pytest.fixture
def shared_deps(db, world_data, roles):
    """One shared dependency graph so the page exercises every nested relation."""
    event_type = EventType.objects.create(name="Course", frequency=Frequency.WEEKLY, partners=0)
    level = Level.objects.create(name="Beginner")
    location = Location.objects.create(name="Studio", address="Via Roma 1", city=City.objects.first())
    room = Room.objects.create(name="Room A", location=location, capacity=30)
    styles = [Style.objects.create(name=f"Style {i}") for i in range(2)]
    genres = [Genre.objects.create(name=f"Genre {i}") for i in range(2)]

    artist_user = User.objects.create_user(
        email="artist@bounce.com", password="StrongPass123!",
        first_name="Anna", last_name="Artist", is_active=True,
    )
    artist = Artist.objects.create(user=artist_user, first_name="Anna", last_name="Artist")
    artist.types.set([ArtistType.objects.create(name="DJ")])
    artist.styles.set(styles[:1])
    artist.genres.set(genres[:1])

    membership = Membership.objects.create(
        name="Season Pass", type=MembershipType.SINGLE, contribution=100, duration=12,
    )
    MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=10)

    return {
        "event_type": event_type,
        "level": level,
        "room": room,
        "styles": styles,
        "genres": genres,
        "artists": [artist],
        "membership": membership,
    }


def seed_events(n, deps, viewer, booker, start_offset=0):
    """Create n published parents, each with a child event, M2Ms and bookings.

    Each parent gets a PAYED contribution from `booker` and a twin
    contribution for `viewer` pointing back at it, so the serializer's
    already_booked / booked_by / available_spot paths all have data.
    """
    parents = []
    base = timezone.now() + timedelta(days=1)
    for i in range(n):
        start = base + timedelta(days=start_offset + i)
        parent = Event.objects.create(
            name=f"Parent {start_offset + i}",
            status=Status.PUBLISHED,
            event_type=deps["event_type"],
            type=Type.MEMBERS,
            level=deps["level"],
            room=deps["room"],
            start_date=start,
            end_date=start + timedelta(hours=1),
            duration=60,
            capacity=20,
            multi_events=(i == 0),
        )
        parent.styles.set(deps["styles"])
        parent.genres.set(deps["genres"])
        parent.artists.set(deps["artists"])
        parent.memberships.set([deps["membership"]])
        parent.accepted_roles.set([])

        child = Event.objects.create(
            name=f"Child {start_offset + i}",
            status=Status.PUBLISHED,
            event_type=deps["event_type"],
            type=Type.MEMBERS,
            level=deps["level"],
            room=deps["room"],
            start_date=start + timedelta(hours=2),
            end_date=start + timedelta(hours=3),
            duration=60,
            capacity=20,
        )
        parent.events.add(child)

        booker_contribution = Contribution.objects.create(
            status=ContributionStatus.PAYED, amount=10, user=booker,
        )
        booker_contribution.events.add(parent)
        viewer_contribution = Contribution.objects.create(
            status=ContributionStatus.RECEIVED, amount=10, user=viewer,
            original_contribution=booker_contribution,
        )
        viewer_contribution.events.add(parent)

        parents.append(parent)
    return parents


def get_with_query_count(client):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(LIST_URL)
    assert response.status_code == http_status.HTTP_200_OK
    return len(ctx.captured_queries), response


class TestEventListQueryCount:

    def test_query_count_does_not_grow_with_events(
        self, student_client, student_user, booker, shared_deps
    ):
        seed_events(3, shared_deps, student_user, booker)
        student_client.get(LIST_URL)  # warm up ContentType & friends
        small_count, small_response = get_with_query_count(student_client)

        seed_events(6, shared_deps, student_user, booker, start_offset=3)
        large_count, large_response = get_with_query_count(student_client)

        assert len(large_response.data["results"]) > len(small_response.data["results"])
        assert large_count == small_count, (
            f"Query count grew from {small_count} to {large_count} when the page "
            f"went from {len(small_response.data['results'])} to "
            f"{len(large_response.data['results'])} events: the list endpoint has N+1 queries."
        )

    def test_student_list_stays_within_query_budget(
        self, student_client, student_user, booker, shared_deps
    ):
        seed_events(9, shared_deps, student_user, booker)
        student_client.get(LIST_URL)
        count, response = get_with_query_count(student_client)

        assert len(response.data["results"]) == 18  # 9 parents + 9 children
        assert count <= QUERY_BUDGET, (
            f"Full page used {count} queries (budget {QUERY_BUDGET})."
        )

    def test_staff_list_stays_within_query_budget(
        self, staff_client, staff_user, booker, shared_deps
    ):
        seed_events(9, shared_deps, staff_user, booker)
        staff_client.get(LIST_URL)
        count, response = get_with_query_count(staff_client)

        assert len(response.data["results"]) == 18
        assert count <= QUERY_BUDGET, (
            f"Full page used {count} queries (budget {QUERY_BUDGET})."
        )


class TestEventListPayloadRegression:
    """Pin the serializer output that the query optimization must not change."""

    def test_list_payload_fields(self, student_client, student_user, booker, shared_deps):
        parent = seed_events(1, shared_deps, student_user, booker)[0]

        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        data = {item["id"]: item for item in response.data["results"]}
        item = data[parent.pk]

        assert item["already_booked"] is True
        assert item["booked_by"] == "Bruno Booker"
        assert item["available_spot"] == 19  # capacity 20, one PAYED contribution
        assert item["children_levels"] == [
            {
                "id": shared_deps["level"].pk,
                "name": shared_deps["level"].name,
                "colors": {"default": "green"},
            }
        ]
        assert [m["id"] for m in item["memberships"]] == [shared_deps["membership"].pk]
        assert item["memberships"][0]["rules"], "membership rules should be serialized"
        assert item["room"]["location"]["city"]["name"] == deps_city_name(shared_deps)
        assert item["artists"][0]["full_name"] == "Anna Artist"
        assert item["event_type"]["name"] == "Course"
        assert {s["id"] for s in item["styles"]} == {s.pk for s in shared_deps["styles"]}

        child_id = parent.events.first().pk
        assert item["events"] == [child_id]
        child_item = data[child_id]
        assert child_item["already_booked"] is False
        assert child_item["available_spot"] == 20


def deps_city_name(deps):
    return deps["room"].location.city.name


# ── children-availability (per-child colors for a free-choice festival) ──────

CHILDREN_AVAILABILITY_QUERY_BUDGET = 10


def availability_url(festival_id):
    return f"{LIST_URL}{festival_id}/children-availability/"


def get_availability_with_query_count(client, festival_id):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(availability_url(festival_id))
    assert response.status_code == http_status.HTTP_200_OK
    return len(ctx.captured_queries), response


def seed_free_festival(n_children, bookings_per_child=2):
    """A free-choice festival with n_children, each with its own
    accepted Leader/Follower bookings (role lives on Booking, not
    Contribution) — enough to exercise the per-child role-count query."""
    event_type = EventType.objects.create(name="Free Fest Type", frequency=Frequency.SINGLE, partners=2)
    leader = PartnerRole.objects.create(name="Leader")
    follower = PartnerRole.objects.create(name="Follower")
    event_type.partner_roles.set([leader, follower])

    room = Room.objects.create(
        name="QC Room",
        location=Location.objects.create(name="QC Loc", address="Via Test 1", city=City.objects.first()),
        capacity=100,
    )
    now = timezone.now()
    festival = Event.objects.create(
        name="Query Count Festival", status=Status.PUBLISHED, event_type=event_type,
        type=Type.MEMBERS, room=room,
        start_date=now - timedelta(days=1), end_date=now + timedelta(days=10),
        duration=60, capacity=100, multi_events=True, free=True,
    )

    children = []
    for i in range(n_children):
        child = Event.objects.create(
            name=f"Child {i}", status=Status.PUBLISHED, event_type=event_type,
            type=Type.MEMBERS, room=festival.room,
            start_date=now + timedelta(hours=i + 1), end_date=now + timedelta(hours=i + 2),
            duration=60, capacity=20, extras=2, warning_threshold=3,
        )
        child.accepted_roles.set([leader, follower])
        for j in range(bookings_per_child):
            student = User.objects.create_user(
                email=f"fest{festival.pk}-child{i}-booker{j}@test.com",
                password="StrongPass123!", is_active=True,
            )
            contribution = Contribution.objects.create(
                status=ContributionStatus.ACCEPTED, amount=10, user=student,
            )
            Booking.objects.create(
                user=student, event=child, contribution=contribution,
                role=leader if j % 2 == 0 else follower,
            )
        children.append(child)

    festival.events.set(children)
    return festival, children


class TestChildrenAvailabilityQueryCount:

    def test_query_count_does_not_grow_with_children(self, staff_client, world_data):
        small_festival, _ = seed_free_festival(2)
        staff_client.get(availability_url(small_festival.id))  # warm up
        small_count, small_response = get_availability_with_query_count(staff_client, small_festival.id)

        large_festival, large_children = seed_free_festival(8)
        large_count, large_response = get_availability_with_query_count(staff_client, large_festival.id)

        assert len(large_response.data) == 8
        assert len(small_response.data) == 2
        assert large_count == small_count, (
            f"Query count grew from {small_count} to {large_count} when the festival "
            f"went from 2 to {len(large_children)} children: the endpoint has N+1 queries."
        )

    def test_stays_within_query_budget(self, staff_client, world_data):
        festival, children = seed_free_festival(8)
        staff_client.get(availability_url(festival.id))
        count, response = get_availability_with_query_count(staff_client, festival.id)

        assert len(response.data) == 8
        assert count <= CHILDREN_AVAILABILITY_QUERY_BUDGET, (
            f"children-availability used {count} queries "
            f"(budget {CHILDREN_AVAILABILITY_QUERY_BUDGET})."
        )
