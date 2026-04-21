"""
Tests for the FestivalRoom API.

FestivalRoom assigns a Room to a FestivalDay, building the columns of the
festival grid.
"""

import pytest
from rest_framework import status as http_status

from event.models import Room
from festival.models import FesivalRoom
from utils.mock_festival import make_festival_day, make_festival_room
from utils.mock_room import make_room_payload

LIST_URL = '/api/festival/festival-rooms/'


def detail_url(pk):
    return f'{LIST_URL}{pk}/'


def make_payload(festival_day=None, room=None):
    if festival_day is None:
        festival_day = make_festival_day()
    if room is None:
        room = Room.objects.create(**make_room_payload())
    return {'festival_day': festival_day.pk, 'room_id': room.pk}


# ── Authentication ────────────────────────────────────────────────────────────

class TestFestivalRoomAuthentication:

    def test_unauthenticated_list_returns_401(self, client, world_data):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, world_data):
        fr = make_festival_room()
        response = client.get(detail_url(fr.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, world_data):
        response = client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Student permissions ───────────────────────────────────────────────────────

class TestFestivalRoomStudentPermissions:

    def test_student_can_list(self, student_client, world_data):
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_can_retrieve(self, student_client, world_data):
        fr = make_festival_room()
        response = student_client.get(detail_url(fr.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_cannot_create(self, student_client, world_data):
        response = student_client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update(self, student_client, world_data):
        fr = make_festival_room()
        response = student_client.put(detail_url(fr.pk), make_payload(), format='json')
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, world_data):
        fr = make_festival_room()
        response = student_client.delete(detail_url(fr.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── Staff CRUD ────────────────────────────────────────────────────────────────

class TestFestivalRoomCRUD:

    def test_staff_can_create(self, staff_client, world_data):
        response = staff_client.post(LIST_URL, make_payload(), format='json')
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, world_data):
        staff_client.post(LIST_URL, make_payload(), format='json')
        assert FesivalRoom.objects.count() == 1

    def test_create_returns_room_detail(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        day = make_festival_day()
        response = staff_client.post(LIST_URL, {'festival_day': day.pk, 'room_id': room.pk}, format='json')
        assert response.data['room']['id'] == room.pk
        assert response.data['festival_day'] == day.pk

    def test_staff_can_list(self, staff_client, world_data):
        make_festival_room()
        make_festival_room()
        response = staff_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 2

    def test_staff_can_retrieve(self, staff_client, world_data):
        fr = make_festival_room()
        response = staff_client.get(detail_url(fr.pk))
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data['id'] == fr.pk

    def test_staff_can_update(self, staff_client, world_data):
        fr = make_festival_room()
        new_room = Room.objects.create(**make_room_payload())
        payload = {'festival_day': fr.festival_day.pk, 'room_id': new_room.pk}
        response = staff_client.put(detail_url(fr.pk), payload, format='json')
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data['room']['id'] == new_room.pk

    def test_staff_can_delete(self, staff_client, world_data):
        fr = make_festival_room()
        response = staff_client.delete(detail_url(fr.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT
        assert FesivalRoom.objects.count() == 0


# ── Validation ────────────────────────────────────────────────────────────────

class TestFestivalRoomValidation:

    def test_festival_day_is_required(self, staff_client, world_data):
        room = Room.objects.create(**make_room_payload())
        response = staff_client.post(LIST_URL, {'room_id': room.pk}, format='json')
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_room_id_is_required(self, staff_client, world_data):
        day = make_festival_day()
        response = staff_client.post(LIST_URL, {'festival_day': day.pk}, format='json')
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_multiple_rooms_can_be_added_to_same_day(self, staff_client, world_data):
        day = make_festival_day()
        room_a = Room.objects.create(**make_room_payload())
        room_b = Room.objects.create(**make_room_payload())
        staff_client.post(LIST_URL, {'festival_day': day.pk, 'room_id': room_a.pk}, format='json')
        response = staff_client.post(LIST_URL, {'festival_day': day.pk, 'room_id': room_b.pk}, format='json')
        assert response.status_code == http_status.HTTP_201_CREATED
        assert FesivalRoom.objects.count() == 2

    def test_same_room_can_appear_on_different_days(self, staff_client, world_data):
        event = __import__('utils.mock_festival', fromlist=['make_festival_event']).make_festival_event()
        from datetime import date, timedelta
        day_a = make_festival_day(event=event, date=date.today() + timedelta(days=1))
        day_b = make_festival_day(event=event, date=date.today() + timedelta(days=2))
        room = Room.objects.create(**make_room_payload())
        staff_client.post(LIST_URL, {'festival_day': day_a.pk, 'room_id': room.pk}, format='json')
        response = staff_client.post(LIST_URL, {'festival_day': day_b.pk, 'room_id': room.pk}, format='json')
        assert response.status_code == http_status.HTTP_201_CREATED
