"""
End-to-end scenario for the children_levels availability colors, driven
entirely through the real APIs (booking API for students, admin API for
event setup and any manual contribution status changes).

Fixture: one multi_events, non-free festival with 4 children all at a
single "Beginner" level, capacity 10, extras 2, warning_threshold 3, two
partner roles (Leader, Follower).
"""
import pytest
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Contribution, ContributionStatus
from users.models import User, City

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
EVENT_TYPES_URL = "/api/events/event-types/"
PARTNER_ROLES_URL = "/api/events/partner-roles/"
LEVELS_URL = "/api/events/levels/"
LOCATIONS_URL = "/api/events/locations/"
ROOMS_URL = "/api/events/rooms/"
MEMBERSHIPS_URL = "/api/membership/memberships/"
BOOK_FESTIVAL_URL = "/api/booking/my-memberships/book-festival/"
CONTRIBUTIONS_URL = "/api/booking/contributions/"


def post(client, url, payload):
    response = client.post(url, payload, format="json")
    assert response.status_code == http_status.HTTP_201_CREATED, response.data
    return response.data


def make_student(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email, password="StrongPass123!",
        first_name=local.capitalize(), last_name="Test", is_active=True,
    )


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def contribution_of(user):
    return Contribution.objects.get(user=user)


def book(student, festival, role_id=None, partner=None):
    payload = {
        "membership_id": festival["membership_id"],
        "event_id": festival["festival_id"],
        "level_id": festival["level_id"],
    }
    if role_id:
        payload["role_id"] = role_id
    if partner:
        payload["partner_id"] = partner.id
        payload["partner_email"] = partner.email
    return client_for(student).post(BOOK_FESTIVAL_URL, payload, format="json")


def cancel(student, contribution_id):
    return client_for(student).delete(f"/api/booking/my-memberships/{contribution_id}/")


def level_colors(admin_client, festival):
    response = admin_client.get(f"{EVENTS_URL}{festival['festival_id']}/")
    assert response.status_code == http_status.HTTP_200_OK, response.data
    entries = response.data["children_levels"]
    assert len(entries) == 1
    return entries[0]["colors"]


@pytest.fixture
def mini_festival(admin_client, world_data):
    """4 children, all level 'Beginner', capacity 10, extras 2,
    warning_threshold 3, roles Leader/Follower. Built through the admin
    API, then published (cascades status to children)."""
    leader = post(admin_client, PARTNER_ROLES_URL, {"name": "Leader"})
    follower = post(admin_client, PARTNER_ROLES_URL, {"name": "Follower"})
    role_ids = [leader["id"], follower["id"]]

    festival_type = post(admin_client, EVENT_TYPES_URL, {
        "name": "Mini Festival Type", "frequency": "single",
        "partners": 2, "role_ids": role_ids,
    })
    class_type = post(admin_client, EVENT_TYPES_URL, {
        "name": "Mini Class Type", "frequency": "single",
        "partners": 2, "role_ids": role_ids,
    })

    level = post(admin_client, LEVELS_URL, {"name": "Beginner"})

    city = City.objects.first()
    location = post(admin_client, LOCATIONS_URL, {
        "name": "Mini Venue", "address": "Via Test 1", "city_id": city.pk,
    })
    room = post(admin_client, ROOMS_URL, {
        "name": "Room", "capacity": 30, "location_id": location["id"],
    })["id"]

    membership = post(admin_client, MEMBERSHIPS_URL, {
        "name": "Pass", "type": "single", "contribution": 100,
        "max_events": 0, "duration": 0,
    })["id"]

    child_ids = []
    for i in range(4):
        day = f"2026-12-{10 + i:02d}"
        child = post(admin_client, EVENTS_URL, {
            "name": f"Beginner class {i}",
            "status": "draft",
            "event_type_id": class_type["id"],
            "type": "members",
            "level_id": level["id"],
            "room_id": room,
            "start_date": f"{day}T10:00:00",
            "end_date": f"{day}T11:15:00",
            "duration": 75,
            "capacity": 10,
            "extras": 2,
            "warning_threshold": 3,
            "accepted_role_ids": role_ids,
        })
        child_ids.append(child["id"])

    festival = post(admin_client, EVENTS_URL, {
        "name": "Mini Festival",
        "status": "draft",
        "event_type_id": festival_type["id"],
        "type": "members",
        "room_id": room,
        "start_date": "2026-12-10T00:00:00",
        "end_date": "2026-12-14T00:00:00",
        "duration": 5760,
        "capacity": 100,
        "multi_events": True,
        "event_ids": child_ids,
        "membership_ids": [membership],
        "accepted_role_ids": role_ids,
    })
    response = admin_client.patch(
        f"{EVENTS_URL}{festival['id']}/", {"status": "published"}, format="json",
    )
    assert response.status_code == http_status.HTTP_200_OK, response.data

    return {
        "festival_id": festival["id"],
        "membership_id": membership,
        "level_id": level["id"],
        "roles": {"Leader": leader["id"], "Follower": follower["id"]},
    }


class TestAvailabilityColorsScenario:

    def test_fresh_level_is_green_for_both_roles(self, mini_festival, admin_client):
        colors = level_colors(admin_client, mini_festival)
        assert colors == {"Leader": "green", "Follower": "green"}

    def test_three_leaders_then_a_follower(self, mini_festival, admin_client):
        leader_id = mini_festival["roles"]["Leader"]
        follower_id = mini_festival["roles"]["Follower"]

        # ── 1st leader: accepted, still green ──────────────────────────
        student1 = make_student("student1@test.com")
        response = book(student1, mini_festival, role_id=leader_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution1 = contribution_of(student1)
        assert contribution1.status == ContributionStatus.ACCEPTED
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "green"

        # ── 2nd leader: accepted, but now orange (extras=2 boundary) ───
        student2 = make_student("student2@test.com")
        response = book(student2, mini_festival, role_id=leader_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution2 = contribution_of(student2)
        assert contribution2.status == ContributionStatus.ACCEPTED
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "orange"

        # ── 3rd leader: beyond extras, waiting list ─────────────────────
        student3 = make_student("student3@test.com")
        response = book(student3, mini_festival, role_id=leader_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution3 = contribution_of(student3)
        assert contribution3.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "orange"

        # ── 1st follower: accepted (minority role) ──────────────────────
        student4 = make_student("student4@test.com")
        response = book(student4, mini_festival, role_id=follower_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution4 = contribution_of(student4)
        assert contribution4.status == ContributionStatus.ACCEPTED

        # Open question: does the follower joining automatically promote
        # the earlier waiting leader (contribution3) to accepted? Nothing
        # in booking/service.py re-checks existing WAITING contributions
        # when a new one is booked — only a cancellation does, via
        # notify_next_waiting. Record what actually happens.
        # it should, do we have a regression?
        contribution3.refresh_from_db()
        print(f"contribution3 (waiting leader) status after follower joins: {contribution3.status}")
        colors = level_colors(admin_client, mini_festival)
        print(f"colors after follower joins: {colors}")
        assert contribution3.status == ContributionStatus.ACCEPTED

        # ── 4th leader: beyond extras, waiting list ─────────────────────
        student5 = make_student("student5@test.com")
        response = book(student5, mini_festival, role_id=leader_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution5 = contribution_of(student5)
        assert contribution5.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "orange"

        # ── 5th leader, 2nd follower: Both Accepted (now should be 6 accepted 1 waiting list)─────────────────────
        student6 = make_student("student6@test.com")
        student7 = make_student("student7@test.com")
        response = book(student6, mini_festival, role_id=leader_id, partner=student7)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution6 = contribution_of(student6)
        contribution7 = contribution_of(student7)
        assert contribution6.status == ContributionStatus.ACCEPTED
        assert contribution7.status == ContributionStatus.ACCEPTED
        contribution5.refresh_from_db()
        assert contribution5.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "orange"

        # ── 6th leader, 3nd follower: Both Accepted (now should be 8 accepted 1 waiting list) ─────────────────────
        # we start showing warning for follower as well
        student8 = make_student("student8@test.com")
        student9 = make_student("student9@test.com")
        response = book(student8, mini_festival, role_id=leader_id, partner=student9)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution8 = contribution_of(student8)
        contribution9 = contribution_of(student9)
        assert contribution8.status == ContributionStatus.ACCEPTED
        assert contribution9.status == ContributionStatus.ACCEPTED
        contribution5.refresh_from_db()
        assert contribution5.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "orange"
        assert colors["Follower"] == "yellow"

        # ── 7th leader, 4th follower: Both Accepted (now should be 11 accepted 1 waiting list) ─────────────────────
        # we start showing warning for follower as well
        student10 = make_student("student10@test.com")
        student11 = make_student("student11@test.com")
        response = book(student10, mini_festival, role_id=leader_id, partner=student11)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution10 = contribution_of(student10)
        contribution11 = contribution_of(student11)
        assert contribution10.status == ContributionStatus.ACCEPTED
        assert contribution11.status == ContributionStatus.ACCEPTED
        contribution5.refresh_from_db()
        assert contribution5.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "red"
        assert colors["Follower"] == "red"

        # ── 5th follower: now goes in waiting list as full book now we have 11 accepted 2 waiting list─────────────────────

        student12 = make_student("student12@test.com")
        response = book(student12, mini_festival, role_id=follower_id)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution12 = contribution_of(student12)
        assert contribution12.status == ContributionStatus.WAITING
        contribution5.refresh_from_db()
        assert contribution5.status == ContributionStatus.WAITING
        colors = level_colors(admin_client, mini_festival)
        assert colors["Leader"] == "red"
        assert colors["Follower"] == "red"

        # ── 1st follower: student 4 cancel booking student 12 5th follower in waiting list should be accepted ──────────────────────
        response = cancel(student4, contribution4.id)
        assert response.status_code == http_status.HTTP_204_NO_CONTENT, response.data
        contribution4.refresh_from_db()
        assert contribution4.status == ContributionStatus.CANCELLED

        contribution12.refresh_from_db()
        assert contribution12.status == ContributionStatus.ACCEPTED
        # assert contribution4.status == ContributionStatus.ACCEPTED
