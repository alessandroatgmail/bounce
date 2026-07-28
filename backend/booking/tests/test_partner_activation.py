"""
When a user books a partner event naming the partner only by email (the
partner has no account yet), no contribution can be created for the
partner at booking time. It must be created automatically when the
partner registers and activates their account:

- on activation, a contribution is created for the new user mirroring
  the booker's one: same events and membership, the booker as partner,
  the opposite role, linked as original_contribution;
- its status copies the booker's contribution status, except payed,
  which maps to accepted (the new partner still has to pay);
- a cancelled booker contribution creates nothing.

Flow through the API: booking via /api/booking/my-memberships/, partner
signup via /api/auth/register/, activation via the emailed link
/api/auth/activate/<uidb64>/<token>/.
"""
import pytest
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Contribution, ContributionStatus
from event.models import Event, EventType, PartnerRole, Status
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload
from utils.mock_user import make_user_payload

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"
REGISTER_URL = "/api/auth/register/"

PARTNER_EMAIL = "partner@test.com"


def activation_url(user):
    """The link the activation email carries."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"/api/auth/activate/{uid}/{token}/"


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


def set_status(admin_client, contribution, status):
    """Staff changes a contribution status through the contributions API."""
    response = admin_client.patch(
        f"/api/booking/contributions/{contribution.pk}/",
        {"status": status},
        format="json",
    )
    assert response.status_code == http_status.HTTP_200_OK
    contribution.refresh_from_db()


def book_with_email_partner(user, event, role, membership):
    """Book the event naming the partner only by email and return the
    booker's contribution."""
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        MY_MEMBERSHIPS_URL,
        {
            "membership_id": membership.pk,
            "event_id": event.pk,
            "role_id": role.pk,
            "partner_email": PARTNER_EMAIL,
        },
        format="json",
    )
    assert response.status_code == http_status.HTTP_201_CREATED
    return Contribution.objects.get(user=user, events=event)


def register_and_activate_partner(client):
    """Sign the partner up through the API and activate them through
    the activation link. Returns the activated user."""
    response = client.post(
        REGISTER_URL, make_user_payload(email=PARTNER_EMAIL), format="json"
    )
    assert response.status_code == http_status.HTTP_201_CREATED

    partner = User.objects.get(email=PARTNER_EMAIL)
    assert partner.is_active is False

    response = client.get(activation_url(partner))
    assert response.status_code == http_status.HTTP_200_OK

    partner.refresh_from_db()
    assert partner.is_active is True
    return partner


class TestPartnerActivationCreatesContribution:

    @pytest.mark.parametrize(
        "booker_status, expected_status",
        [
            (ContributionStatus.RECEIVED, ContributionStatus.RECEIVED),
            (ContributionStatus.ACCEPTED, ContributionStatus.ACCEPTED),
            (ContributionStatus.WAITING, ContributionStatus.WAITING),
            (ContributionStatus.CONFIRMED, ContributionStatus.CONFIRMED),
            # The booker already payed: the partner still has to, so the
            # mirrored contribution starts as accepted.
            (ContributionStatus.PAYED, ContributionStatus.ACCEPTED),
        ],
    )
    def test_activation_creates_mirrored_contribution(
        self, client, admin_client, membership, partner_event,
        booker_status, expected_status
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")

        anna_contribution = book_with_email_partner(anna, parent, leader, membership)
        set_status(admin_client, anna_contribution, booker_status)

        partner = register_and_activate_partner(client)

        contribution = Contribution.objects.get(user=partner)
        assert contribution.partner == anna
        assert contribution.status == expected_status
        assert contribution.role == follower
        assert contribution.original_contribution == anna_contribution
        assert set(contribution.events.all()) == set(anna_contribution.events.all())

    def test_cancelled_contribution_creates_nothing(
        self, client, admin_client, membership, partner_event
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")

        anna_contribution = book_with_email_partner(anna, parent, leader, membership)
        set_status(admin_client, anna_contribution, ContributionStatus.CANCELLED)

        partner = register_and_activate_partner(client)

        assert not Contribution.objects.filter(user=partner).exists()


class TestActivationBookedEventsEmail:
    """When activation mirrors contributions, the new user gets an email
    telling them events are already booked, pointing to their section."""

    def test_email_lists_booked_events_and_links_the_student_section(
        self, client, membership, partner_event
    ):
        parent, child, leader, follower = partner_event
        anna = make_student("anna@test.com")
        book_with_email_partner(anna, parent, leader, membership)

        response = client.post(
            REGISTER_URL, make_user_payload(email=PARTNER_EMAIL), format="json"
        )
        assert response.status_code == http_status.HTTP_201_CREATED
        partner = User.objects.get(email=PARTNER_EMAIL)

        mail.outbox.clear()
        response = client.get(activation_url(partner))
        assert response.status_code == http_status.HTTP_200_OK

        messages = [m for m in mail.outbox if partner.email in m.to]
        assert len(messages) == 1
        body = messages[0].body
        assert parent.name in body
        assert f"{settings.FRONTEND_URL}/student" in body

    def test_no_email_when_no_contribution_is_mirrored(self, client, world_data):
        response = client.post(
            REGISTER_URL, make_user_payload(email=PARTNER_EMAIL), format="json"
        )
        assert response.status_code == http_status.HTTP_201_CREATED
        partner = User.objects.get(email=PARTNER_EMAIL)

        mail.outbox.clear()
        response = client.get(activation_url(partner))
        assert response.status_code == http_status.HTTP_200_OK

        assert [m for m in mail.outbox if partner.email in m.to] == []
