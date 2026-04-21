"""
Tests for the FestivalDay API.

FestivalDay links a calendar date to a parent Event whose event_type is
named 'Festival'. The list response nests all FestivalRooms for that day.
"""

import pytest
from datetime import date, timedelta
from rest_framework import status as http_status

from event.models import EventType, Event, Status
from festival.models import FestivalDay, FesivalRoom
from utils.mock_festival import (
    make_festival_event,
    make_festival_event_type,
    make_festival_day,
    make_festival_room,
)
from utils.mock_event import make_event_payload
from utils.mock_room import make_room_payload
from event.models import Room

LIST_URL = '/api/festival/festival-days/'


def detail_url(pk):
    return f'{LIST_URL}{pk}/'


def make_payload(event: Event | None = None, **overrides):
    if event is None:
        event = make_festival_event()
    data = {
        'event_id': event.pk,
        'date': str(date.today() + timedelta(days=1)),
    }
    data.update(overrides)
    return data


# ── Authentication ────────────────────────────────────────────────────────────

class TestFestivalDayAuthentication:

    def test_unauthenticated_list_returns_401(self, client, world_data):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, world_data):
        day = make_festival_day()
        response = client.get(detail_url(day.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, world_data):
        response = client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Student permissions ───────────────────────────────────────────────────────

class TestFestivalDayStudentPermissions:

    def test_student_can_list(self, student_client, world_data):
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_can_retrieve(self, student_client, world_data):
        day = make_festival_day()
        response = student_client.get(detail_url(day.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_cannot_create(self, student_client, world_data):
        response = student_client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, world_data):
        day = make_festival_day()
        response = student_client.put(detail_url(day.pk), make_payload(), format='json')
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, world_data):
        day = make_festival_day()
        response = student_client.delete(detail_url(day.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── Staff CRUD ────────────────────────────────────────────────────────────────

class TestFestivalDayCRUD:

    def test_staff_can_create(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_create_returns_date_and_event(self, staff_client, world_data):
        event = make_festival_event()
        d = date.today() + timedelta(days=3)
        response = staff_client.post(LIST_URL, {'event_id': event.pk, 'date': str(d)}, format='json')
        assert response.data['date'] == str(d)
        assert response.data['event']['id'] == event.pk

    def test_create_persists_to_db(self, staff_client, world_data):
        staff_client.post(LIST_URL, make_payload(), format='json')
        assert FestivalDay.objects.count() == 1

    def test_staff_can_list(self, staff_client, world_data):
        make_festival_day()
        make_festival_day()
        response = staff_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 2

    def test_staff_can_retrieve(self, staff_client, world_data):
        day = make_festival_day()
        response = staff_client.get(detail_url(day.pk))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data['id'] == day.pk

    def test_staff_can_update(self, staff_client, world_data):
        day = make_festival_day()
        new_date = str(date.today() + timedelta(days=10))
        payload = {'event_id': day.event.pk, 'date': new_date}
        response = staff_client.put(detail_url(day.pk), payload, format='json')
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data['date'] == new_date

    def test_staff_can_delete(self, staff_client, world_data):
        day = make_festival_day()
        response = staff_client.delete(detail_url(day.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT
        assert FestivalDay.objects.count() == 0


# ── Validation ────────────────────────────────────────────────────────────────

class TestFestivalDayValidation:

    def test_event_must_be_festival_type(self, staff_client, world_data):
        """event_id queryset is filtered to Festival event type only."""
        from event.models import EventType
        from utils.mock_event_type import make_event_type_payload
        non_festival_et = EventType.objects.create(**make_event_type_payload(name='Workshop'))
        payload = make_event_payload(event_type_id=non_festival_et.pk)
        from event.models import Event as Ev
        event = Ev.objects.create(
            name=payload['name'], status=payload['status'],
            event_type_id=non_festival_et.pk, type=payload['type'],
            room_id=payload['room_id'], start_date=payload['start_date'],
            end_date=payload['end_date'], duration=payload['duration'],
            capacity=payload['capacity'],
        )
        response = staff_client.post(LIST_URL, {'event_id': event.pk, 'date': str(date.today() + timedelta(days=1))}, format='json')
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_date_is_required(self, staff_client, world_data):
        event = make_festival_event()
        response = staff_client.post(LIST_URL, {'event_id': event.pk}, format='json')
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_event_id_is_required(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, {'date': str(date.today())}, format='json')
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Nested rooms in response ──────────────────────────────────────────────────

class TestFestivalDayNestedRooms:

    def test_rooms_field_is_empty_list_by_default(self, staff_client, world_data):
        day = make_festival_day()
        response = staff_client.get(detail_url(day.pk))
        assert response.data['rooms'] == []

    def test_rooms_field_contains_assigned_rooms(self, staff_client, world_data):
        day = make_festival_day()
        make_festival_room(festival_day=day)
        make_festival_room(festival_day=day)
        response = staff_client.get(detail_url(day.pk))
        assert len(response.data['rooms']) == 2

    def test_room_entry_includes_room_detail(self, staff_client, world_data):
        day = make_festival_day()
        fr = make_festival_room(festival_day=day)
        response = staff_client.get(detail_url(day.pk))
        room_data = response.data['rooms'][0]
        assert room_data['room']['id'] == fr.room.pk
        assert 'name' in room_data['room']
