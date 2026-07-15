"""
Tests for register consolidation, driven through the public API wherever
an endpoint exists.

Consolidation (POST /api/events/register/<pk>/) treats the parent
event's bookings — kept up to date by payments and by the staff
bookings API — as the source of truth: the children events' bookings
are deleted and recreated as copies of the parent's.

Scenarios:

1) A user books with a partner and pays; an extra user is added through
   the staff bookings API; consolidation copies the parent bookings
   onto the child event with the correct data for the first user.
2) Same as 1, then the partner's contribution is marked payed: the
   register shows the payed status, the partner's child booking exists
   without any consolidation, and re-consolidating rebuilds it with the
   same information.
3) A payed user books alone; an admin adds a second user with a
   different role and no partner; a third user books alone and pays.
   The register pairs the two payed users on the same row, and the
   child event's bookings hold them as mutual partners — again without
   consolidation.
4) The staff bookings API refuses a second booking for the same user
   and the same parent event.
"""
import pytest
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Booking, Contribution, ContributionStatus
from event.models import Event, EventType, PartnerRole, Status
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"
BOOKINGS_URL = "/api/booking/bookings/"


def contribution_detail_url(pk):
    return f"/api/booking/contributions/{pk}/"


def register_url(pk):
    return f"/api/events/register/{pk}/"


def make_student(email):
    """A registered AND activated student, created without the endpoint."""
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        first_name=local.capitalize(),
        last_name="Test",
        is_active=True,
    )


def book_event(user, event, role, membership, partner=None):
    """Book the event through POST /api/booking/my-memberships/ and
    return the created contribution."""
    client = APIClient()
    client.force_authenticate(user=user)
    payload = {
        "membership_id": membership.pk,
        "event_id": event.pk,
        "role_id": role.pk,
    }
    if partner is not None:
        payload["partner_id"] = partner.pk
        payload["partner_email"] = partner.email
    response = client.post(MY_MEMBERSHIPS_URL, payload, format="json")
    assert response.status_code == http_status.HTTP_201_CREATED
    return Contribution.objects.get(user=user, events=event)


def pay(admin_client, contribution):
    """Staff flips a contribution to payed through the contributions API."""
    response = admin_client.patch(
        contribution_detail_url(contribution.pk),
        {"status": ContributionStatus.PAYED},
        format="json",
    )
    assert response.status_code == http_status.HTTP_200_OK


def add_booking(admin_client, user, event, role, partner=None, partner_role=None):
    """Staff books a user directly through the staff bookings API,
    optionally partnered — the same payload the register page sends when
    a user is added to a row that already holds a mate."""
    payload = {"user": user.pk, "event": event.pk, "role": role.pk}
    if partner is not None:
        payload["partner"] = partner.pk
        payload["partner_email"] = partner.email
    if partner_role is not None:
        payload["partner_role"] = partner_role.pk
    response = admin_client.post(BOOKINGS_URL, payload, format="json")
    return response


def row_of(rows, user):
    """The register row holding the given user, or None."""
    return next(
        (
            row for row in rows
            if any(m and m.get("id") == user.id for m in row["members"].values())
        ),
        None,
    )


@pytest.fixture
def membership(db):
    return Membership.objects.create(
        name="Plan", contribution=50, max_events=0, duration=0
    )


@pytest.fixture
def partner_event(admin_client, world_data):
    """A published weekly Leader/Follower event with one child event,
    both created through the events API.

    Returns (parent, child, leader, follower).
    """
    event_type = EventType.objects.create(
        **make_event_type_payload(frequency="weekly", partners=2)
    )
    leader = PartnerRole.objects.get_or_create(name="Leader")[0]
    follower = PartnerRole.objects.get_or_create(name="Follower")[0]
    event_type.partner_roles.set([leader, follower])

    child_res = admin_client.post(
        EVENTS_URL,
        make_event_payload(event_type_id=event_type.pk, capacity=20),
        format="json",
    )
    assert child_res.status_code == http_status.HTTP_201_CREATED

    parent_res = admin_client.post(
        EVENTS_URL,
        make_event_payload(
            event_type_id=event_type.pk,
            capacity=20,
            event_ids=[child_res.data["id"]],
        ),
        format="json",
    )
    assert parent_res.status_code == http_status.HTTP_201_CREATED

    response = admin_client.patch(
        f"{EVENTS_URL}{parent_res.data['id']}/",
        {"status": Status.PUBLISHED},
        format="json",
    )
    assert response.status_code == http_status.HTTP_200_OK

    parent = Event.objects.get(pk=parent_res.data["id"])
    child = Event.objects.get(pk=child_res.data["id"])
    return parent, child, leader, follower


class TestConsolidateRegister:

    def test_consolidation_copies_parent_bookings_onto_the_child(
        self, admin_client, membership, partner_event
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        carla = make_student("carla@test.com")

        # Anna books as Leader with Bruno as partner and pays.
        pay(admin_client, book_event(anna, parent, leader, membership, partner=bruno))

        # Staff adds Carla directly through the bookings API.
        response = add_booking(admin_client, carla, parent, follower)
        assert response.status_code == http_status.HTTP_201_CREATED

        # Consolidate: the child holds a copy of each parent booking.
        response = admin_client.post(register_url(parent.pk), {}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

        child_bookings = Booking.objects.filter(event=child)
        assert child_bookings.count() == 2

        anna_child = child_bookings.get(user=anna)
        assert anna_child.role == leader
        assert anna_child.partner == bruno
        assert anna_child.partner_email == bruno.email
        assert anna_child.couple is True

        carla_child = child_bookings.get(user=carla)
        assert carla_child.role == follower
        assert carla_child.partner is None

    def test_partner_payment_updates_register_and_books_child_without_consolidation(
        self, admin_client, membership, partner_event
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        carla = make_student("carla@test.com")

        # Same starting point as scenario 1.
        pay(admin_client, book_event(anna, parent, leader, membership, partner=bruno))
        response = add_booking(admin_client, carla, parent, follower)
        assert response.status_code == http_status.HTTP_201_CREATED
        response = admin_client.post(register_url(parent.pk), {}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

        # Staff marks Bruno's contribution as payed.
        bruno_contribution = Contribution.objects.get(user=bruno, events=parent)
        pay(admin_client, bruno_contribution)

        # The register now shows Bruno payed, on Anna's row.
        response = admin_client.get(register_url(parent.pk))
        assert response.status_code == http_status.HTTP_200_OK
        anna_row = row_of(response.json()["rows"], anna)
        assert anna_row is not None
        bruno_cell = anna_row["members"]["Follower"]
        assert bruno_cell["id"] == bruno.id
        assert bruno_cell["status"] == ContributionStatus.PAYED

        # Paying booked Bruno on the child event too — no consolidation ran.
        bruno_child = Booking.objects.get(event=child, user=bruno)
        assert bruno_child.role == follower
        assert bruno_child.partner == anna
        assert bruno_child.couple is True

        # Re-consolidating recreates the child booking with the same data.
        response = admin_client.post(register_url(parent.pk), {}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

        new_bruno_child = Booking.objects.get(event=child, user=bruno)
        assert new_bruno_child.pk != bruno_child.pk
        assert new_bruno_child.role == follower
        assert new_bruno_child.partner == anna
        assert new_bruno_child.partner_email == anna.email
        assert new_bruno_child.couple is True

    def test_payed_users_are_paired_on_register_and_child_bookings(
        self, admin_client, membership, partner_event
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        carla = make_student("carla@test.com")

        # Anna books alone as Leader and pays.
        pay(admin_client, book_event(anna, parent, leader, membership))

        # Staff adds Bruno as Follower, no partner, through the bookings API.
        response = add_booking(admin_client, bruno, parent, follower)
        assert response.status_code == http_status.HTTP_201_CREATED

        # Carla books alone as Follower and pays.
        pay(admin_client, book_event(carla, parent, follower, membership))

        # The register pairs the two payed users (Anna + Carla) on the
        # same row; Bruno sits on his own row.
        response = admin_client.get(register_url(parent.pk))
        assert response.status_code == http_status.HTTP_200_OK
        rows = response.json()["rows"]
        assert len(rows) == 2

        anna_row = row_of(rows, anna)
        assert anna_row is not None
        assert anna_row["members"]["Leader"]["id"] == anna.id
        assert anna_row["members"]["Follower"]["id"] == carla.id

        bruno_row = row_of(rows, bruno)
        assert bruno_row is not None
        assert bruno_row["members"]["Follower"]["id"] == bruno.id
        assert bruno_row["members"]["Leader"] is None

        # The child event's bookings hold Anna and Carla as mutual
        # partners — created by the payments, without consolidation.
        anna_child = Booking.objects.get(event=child, user=anna)
        carla_child = Booking.objects.get(event=child, user=carla)
        assert anna_child.partner == carla
        assert carla_child.partner == anna
        assert not Booking.objects.filter(event=child, user=bruno).exists()

    def test_second_booking_for_same_user_and_event_is_rejected(
        self, admin_client, partner_event
    ):
        parent, _, leader, follower = partner_event
        anna = make_student("anna@test.com")

        response = add_booking(admin_client, anna, parent, leader)
        assert response.status_code == http_status.HTTP_201_CREATED

        response = add_booking(admin_client, anna, parent, follower)
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Booking.objects.filter(user=anna, event=parent).count() == 1
