"""
Waiting-list behaviour driven by Event.extras.

A partner event (Leader/Follower) accepts unmatched registrations of one
role only while the imbalance stays within Event.extras: with extras=3,
the first 3 solo leaders are accepted and the 4th lands on the waiting
list.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Contribution, ContributionStatus
from event.models import Event, EventType, PartnerRole
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"
OVERVIEW_URL = "/api/booking/contributions-overview/"


def make_student(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        first_name=local.capitalize(),
        last_name="Test",
        is_active=True,
    )


@pytest.fixture
def partner_event_with_extras(world_data):
    """A published partner event (Leader/Follower) with extras=3."""
    event_type = EventType.objects.create(**make_event_type_payload(partners=2))
    leader = PartnerRole.objects.get_or_create(name="Leader")[0]
    follower = PartnerRole.objects.get_or_create(name="Follower")[0]
    event_type.partner_roles.set([leader, follower])

    payload = make_event_payload(event_type_id=event_type.pk)
    start = timezone.now() + timedelta(days=7)
    event = Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=20,
        extras=3,
    )
    event.accepted_roles.set([leader, follower])
    return event, leader


@pytest.fixture
def solo_event_capacity_2(world_data):
    """An event without partner roles (partners=1) and capacity=2."""
    event_type = EventType.objects.create(**make_event_type_payload(partners=1))

    payload = make_event_payload(event_type_id=event_type.pk)
    start = timezone.now() + timedelta(days=7)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=2,
    )


def book(student, event, membership, role=None):
    client = APIClient()
    client.force_authenticate(user=student)
    payload = {"membership_id": membership.pk, "event_id": event.pk}
    if role is not None:
        payload["role_id"] = role.pk
    return client.post(MY_MEMBERSHIPS_URL, payload, format="json")


class TestWaitingListExtras:

    def test_extras_3_accepts_3_solo_leaders_and_queues_the_4th(self, partner_event_with_extras):
        event, leader = partner_event_with_extras
        membership = Membership.objects.create(name="Plan", contribution=50, max_events=0, duration=0)

        students = [make_student(f"leader{i}@test.com") for i in range(4)]
        for student in students:
            res = book(student, event, membership, leader)
            assert res.status_code == http_status.HTTP_201_CREATED

        statuses = [Contribution.objects.get(user=s).status for s in students]
        assert statuses[:3] == [ContributionStatus.ACCEPTED] * 3
        assert statuses[3] == ContributionStatus.WAITING

    def test_overview_endpoint_splits_accepted_and_waiting(self, partner_event_with_extras, admin_client):
        event, leader = partner_event_with_extras
        membership = Membership.objects.create(name="Plan", contribution=50, max_events=0, duration=0)

        students = [make_student(f"leader{i}@test.com") for i in range(4)]
        for student in students:
            assert book(student, event, membership, leader).status_code == http_status.HTTP_201_CREATED

        accepted = admin_client.get(OVERVIEW_URL, {"event": event.pk, "status": ContributionStatus.ACCEPTED})
        waiting = admin_client.get(OVERVIEW_URL, {"event": event.pk, "status": ContributionStatus.WAITING})
        assert {row["user"]["email"] for row in accepted.data} == {s.email for s in students[:3]}
        assert [row["user"]["email"] for row in waiting.data] == [students[3].email]


class TestWaitingListExtrasWithPayed:

    def test_payed_contribution_counts_toward_extras(self, partner_event_with_extras, admin_client):
        """
        extras=3 admits 3 unmatched leaders in total, whatever their status:
        1 payed + 2 accepted fill the quota, the 4th leader goes to WAITING.
        """
        event, leader = partner_event_with_extras
        membership = Membership.objects.create(name="Plan", contribution=50, max_events=0, duration=0)
        students = [make_student(f"leader{i}@test.com") for i in range(4)]

        # First leader registers and gets marked as payed by the staff.
        res = book(students[0], event, membership, leader)
        assert res.status_code == http_status.HTTP_201_CREATED
        first = Contribution.objects.get(user=students[0])
        assert first.status == ContributionStatus.ACCEPTED
        res = admin_client.patch(
            f"/api/booking/contributions/{first.pk}/",
            {"status": ContributionStatus.PAYED},
            format="json",
        )
        assert res.status_code == http_status.HTTP_200_OK

        # The other three leaders register afterwards.
        for student in students[1:]:
            assert book(student, event, membership, leader).status_code == http_status.HTTP_201_CREATED

        statuses = [Contribution.objects.get(user=s).status for s in students]
        assert statuses == [
            ContributionStatus.PAYED,
            ContributionStatus.ACCEPTED,
            ContributionStatus.ACCEPTED,
            ContributionStatus.WAITING,
        ]


class TestWaitingListCapacity:

    def test_capacity_2_accepts_2_and_queues_the_3rd(self, solo_event_capacity_2):
        event = solo_event_capacity_2
        membership = Membership.objects.create(name="Plan", contribution=50, max_events=0, duration=0)

        students = [make_student(f"solo{i}@test.com") for i in range(3)]
        for student in students:
            res = book(student, event, membership)
            assert res.status_code == http_status.HTTP_201_CREATED

        statuses = [Contribution.objects.get(user=s).status for s in students]
        assert statuses[:2] == [ContributionStatus.ACCEPTED] * 2
        assert statuses[2] == ContributionStatus.WAITING
