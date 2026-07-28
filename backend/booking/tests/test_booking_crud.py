"""
Tests for the staff-only Booking CRUD API.

Rules:
  - Only staff users (is_staff=True) can access the endpoint.
  - Full CRUD: list, retrieve, create, update, partial update, delete.
  - List supports filtering by ?user=<id> and ?event=<id>.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution
from event.models import Event, PartnerRole
from utils.mock_event import make_event_payload

LIST_URL = "/api/booking/bookings/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event():
    payload = make_event_payload()
    start = timezone.now() + timedelta(days=1)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


def make_booking(user, event=None, **overrides):
    return Booking.objects.create(user=user, event=event or make_event(), **overrides)


def make_booking_payload(user, event, **overrides):
    return {
        "user": user.pk,
        "event": event.pk,
        **overrides,
    }


# ── Authentication ────────────────────────────────────────────────────────────

class TestBookingAuthentication:

    def test_unauthenticated_list_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, db):
        res = client.post(LIST_URL, {}, format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        assert client.get(detail_url(999)).status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Permissions ───────────────────────────────────────────────────────────────

class TestBookingPermissions:

    def test_student_cannot_list(self, student_client, db):
        assert student_client.get(LIST_URL).status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_create(self, student_client, subject_user, world_data):
        event = make_event()
        res = student_client.post(LIST_URL, make_booking_payload(subject_user, event), format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_retrieve(self, student_client, subject_user, world_data):
        booking = make_booking(subject_user)
        assert student_client.get(detail_url(booking.pk)).status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, subject_user, world_data):
        booking = make_booking(subject_user)
        res = student_client.patch(detail_url(booking.pk), {"attended": True}, format="json")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, subject_user, world_data):
        booking = make_booking(subject_user)
        assert student_client.delete(detail_url(booking.pk)).status_code == http_status.HTTP_403_FORBIDDEN


# ── CRUD ──────────────────────────────────────────────────────────────────────

class TestBookingCRUD:

    def test_admin_can_list(self, admin_client, subject_user, partner_user, world_data):
        make_booking(subject_user)
        make_booking(partner_user)
        res = admin_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 2

    def test_admin_can_retrieve(self, admin_client, subject_user, world_data):
        booking = make_booking(subject_user)
        res = admin_client.get(detail_url(booking.pk))
        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["id"] == booking.pk
        assert res.data["user"] == subject_user.pk
        assert res.data["event"] == booking.event_id

    def test_admin_can_create(self, admin_client, subject_user, world_data):
        event = make_event()
        res = admin_client.post(LIST_URL, make_booking_payload(subject_user, event), format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        booking = Booking.objects.get(pk=res.data["id"])
        assert booking.user == subject_user
        assert booking.event == event
        assert booking.attended is False
        assert booking.couple is False

    def test_admin_can_create_with_all_fields(self, admin_client, subject_user, partner_user, world_data):
        event = make_event()
        role = PartnerRole.objects.create(name="leader")
        partner_role = PartnerRole.objects.create(name="follower")
        contribution = Contribution.objects.create(amount=10, user=subject_user)
        payload = make_booking_payload(
            subject_user, event,
            role=role.pk,
            partner=partner_user.pk,
            partner_email="partner@bounce.com",
            partner_role=partner_role.pk,
            contribution=contribution.pk,
            attended=True,
            couple=True,
        )
        res = admin_client.post(LIST_URL, payload, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        booking = Booking.objects.get(pk=res.data["id"])
        assert booking.role == role
        assert booking.partner == partner_user
        assert booking.partner_email == "partner@bounce.com"
        assert booking.partner_role == partner_role
        assert booking.contribution == contribution
        assert booking.attended is True
        assert booking.couple is True

    def test_create_requires_user_and_event(self, admin_client, db):
        res = admin_client.post(LIST_URL, {}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "user" in res.data
        assert "event" in res.data

    def test_admin_can_full_update(self, admin_client, subject_user, partner_user, world_data):
        booking = make_booking(subject_user)
        new_event = make_event()
        payload = make_booking_payload(partner_user, new_event, attended=True)
        res = admin_client.put(detail_url(booking.pk), payload, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.user == partner_user
        assert booking.event == new_event
        assert booking.attended is True

    def test_admin_can_partial_update(self, admin_client, subject_user, world_data):
        booking = make_booking(subject_user)
        res = admin_client.patch(detail_url(booking.pk), {"attended": True}, format="json")
        assert res.status_code == http_status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.attended is True
        assert booking.user == subject_user  # untouched

    def test_admin_can_delete(self, admin_client, subject_user, world_data):
        booking = make_booking(subject_user)
        res = admin_client.delete(detail_url(booking.pk))
        assert res.status_code == http_status.HTTP_204_NO_CONTENT
        assert not Booking.objects.filter(pk=booking.pk).exists()

    def test_retrieve_missing_returns_404(self, admin_client, db):
        assert admin_client.get(detail_url(99999)).status_code == http_status.HTTP_404_NOT_FOUND


# ── Filtering ─────────────────────────────────────────────────────────────────

class TestBookingFilters:

    def test_filter_by_user(self, admin_client, subject_user, partner_user, world_data):
        booking = make_booking(subject_user)
        make_booking(partner_user)
        res = admin_client.get(LIST_URL, {"user": subject_user.pk})
        assert res.status_code == http_status.HTTP_200_OK
        assert [b["id"] for b in res.data] == [booking.pk]

    def test_filter_by_event(self, admin_client, subject_user, partner_user, world_data):
        event = make_event()
        booking = make_booking(subject_user, event=event)
        make_booking(partner_user)
        res = admin_client.get(LIST_URL, {"event": event.pk})
        assert res.status_code == http_status.HTTP_200_OK
        assert [b["id"] for b in res.data] == [booking.pk]
