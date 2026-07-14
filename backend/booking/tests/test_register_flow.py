"""
End-to-end register flow for a weekly partner event, driven through the
public API wherever an endpoint exists:

1.  Staff creates a weekly partner (Leader/Follower) event via
    POST /api/events/events/ and publishes it via PATCH.
2.  Two students are created and activated directly (no endpoint).
3.  One student books the event through POST /api/booking/my-memberships/
    naming the other student as partner → two contributions, one each.
4.  Staff flips the booker's contribution to payed via
    PATCH /api/booking/contributions/<pk>/ → a Booking record appears
    for the payer only.
5.  GET /api/events/register/<event_pk>/ shows the couple on ONE row.
6.  Re-consolidating that very grid (consolidate_register) must change
    nothing: the register still has one row and the Booking model still
    holds only the payer's record.
"""
import pytest
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Booking, Contribution, ContributionStatus
from booking.register import consolidate_register
from event.models import Event, EventType, PartnerRole, Status
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"


def event_detail_url(pk):
    return f"{EVENTS_URL}{pk}/"


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


class TestWeeklyPartnerEventRegisterFlow:

    def test_full_flow_from_creation_to_consolidation(self, admin_client, world_data):
        # ── 1. Staff creates a weekly partner event through the API ──────────
        event_type = EventType.objects.create(
            **make_event_type_payload(frequency="weekly", partners=2)
        )
        leader = PartnerRole.objects.get_or_create(name="Leader")[0]
        follower = PartnerRole.objects.get_or_create(name="Follower")[0]
        event_type.partner_roles.set([leader, follower])

        response = admin_client.post(
            EVENTS_URL,
            make_event_payload(event_type_id=event_type.pk, capacity=20),
            format="json",
        )
        assert response.status_code == http_status.HTTP_201_CREATED
        event_id = response.data["id"]

        # ── and publishes it, still through the API ──────────────────────────
        response = admin_client.patch(
            event_detail_url(event_id), {"status": Status.PUBLISHED}, format="json"
        )
        assert response.status_code == http_status.HTTP_200_OK
        assert Event.objects.get(pk=event_id).status == Status.PUBLISHED

        # ── 2. Two activated students, created without the endpoint ──────────
        anna, bruno = make_student("anna@test.com"), make_student("bruno@test.com")

        # ── 3. Anna books the event as Leader with Bruno as partner ──────────
        membership = Membership.objects.create(
            name="Plan", contribution=50, max_events=0, duration=0
        )
        anna_client = APIClient()
        anna_client.force_authenticate(user=anna)
        response = anna_client.post(
            MY_MEMBERSHIPS_URL,
            {
                "membership_id": membership.pk,
                "event_id": event_id,
                "role_id": leader.id,
                "partner_id": bruno.id,
                "partner_email": bruno.email,
            },
            format="json",
        )
        assert response.status_code == http_status.HTTP_201_CREATED

        # Two contributions were created, one per student, linked as a couple.
        assert Contribution.objects.count() == 2
        anna_contribution = Contribution.objects.get(user=anna)
        bruno_contribution = Contribution.objects.get(user=bruno)
        assert bruno_contribution.original_contribution == anna_contribution
        assert bruno_contribution.partner == anna

        # ── 4. Staff marks Anna's contribution as payed through the API ──────
        response = admin_client.patch(
            contribution_detail_url(anna_contribution.pk),
            {"status": ContributionStatus.PAYED},
            format="json",
        )
        assert response.status_code == http_status.HTTP_200_OK
        anna_contribution.refresh_from_db()
        assert anna_contribution.status == ContributionStatus.PAYED

        # Paying created the Booking record — for the payer only.
        booking = Booking.objects.get(event_id=event_id)
        assert booking.user == anna
        assert booking.partner == bruno
        assert booking.partner_email == bruno.email

        # ── 5. The register shows the couple on a single row ─────────────────
        response = admin_client.get(register_url(event_id))
        assert response.status_code == http_status.HTTP_200_OK
        grid = response.json()
        assert len(grid["rows"]) == 1

        # ── 6. Consolidating the very grid the API returned changes nothing ──
        event = Event.objects.get(pk=event_id)
        consolidate_register(event, grid["rows"])

        response = admin_client.get(register_url(event_id))
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.json()["rows"]) == 1

        # The Booking model still holds only the first student's record.
        assert Booking.objects.filter(event_id=event_id).count() == 1
        assert Booking.objects.filter(event_id=event_id, user=anna).exists()
        assert not Booking.objects.filter(user=bruno).exists()
