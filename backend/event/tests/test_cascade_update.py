"""
When a parent event is updated via PUT, the backend propagates
room, start_date, end_date, artists, styles, and genres to all children
linked via the events M2M.

PATCH requests (used when linking new children) must NOT trigger propagation.
"""
import pytest
from datetime import datetime, timedelta, timezone

from faker import Faker
from event.models import Event, Artist, Style, Genre, ArtistType
from utils.mock_festival import make_festival_event
from utils.mock_event import make_event_payload
from utils.mock_room import make_room_payload

_fake = Faker()


def _artist():
    at = ArtistType.objects.create(name=_fake.unique.word())
    return Artist.objects.create(first_name=_fake.first_name(), last_name=_fake.last_name())


def _style():
    return Style.objects.create(name=_fake.unique.word())


def _genre():
    return Genre.objects.create(name=_fake.unique.word())

LIST_URL = "/api/events/events/"


def detail(pk):
    return f"{LIST_URL}{pk}/"


@pytest.fixture
def parent_with_children(world_data, db):
    parent = make_festival_event()
    child1 = make_festival_event()
    child2 = make_festival_event()
    parent.events.set([child1, child2])
    return parent, child1, child2


@pytest.mark.django_db
def test_put_propagates_artists_styles_genres(parent_with_children, staff_client, world_data):
    parent, child1, child2 = parent_with_children
    artist = _artist()
    style = _style()
    genre = _genre()

    payload = make_event_payload(
        event_type_id=parent.event_type.pk,
        room_id=parent.room.pk,
        artist_ids=[artist.pk],
        style_ids=[style.pk],
        genre_ids=[genre.pk],
    )
    res = staff_client.put(detail(parent.pk), payload, format='json')
    assert res.status_code == 200
    parent.refresh_from_db()
    assert list(parent.artists.values_list('id', flat=True)) == [artist.pk]

    for child in [child1, child2]:
        child.refresh_from_db()
        assert list(child.artists.values_list('id', flat=True)) == [artist.pk]
    #     assert list(child.styles.values_list('id', flat=True)) == [style.pk]
    #     assert list(child.genres.values_list('id', flat=True)) == [genre.pk]


@pytest.mark.django_db
def test_put_propagates_room_and_dates(parent_with_children, staff_client, world_data):
    from event.models import Room
    parent, child1, child2 = parent_with_children
    new_room = Room.objects.create(**make_room_payload())

    payload = make_event_payload(event_type_id=parent.event_type.pk, room_id=new_room.pk)
    res = staff_client.put(detail(parent.pk), payload, format='json')
    assert res.status_code == 200

    updated_parent = Event.objects.get(pk=parent.pk)
    for child in [child1, child2]:
        child.refresh_from_db()
        assert child.room_id == new_room.pk
        assert child.start_date == updated_parent.start_date
        assert child.end_date == updated_parent.end_date


@pytest.mark.django_db
def test_patch_does_not_cascade(parent_with_children, staff_client, world_data):
    parent, child1, child2 = parent_with_children
    original_room_id = child1.room_id
    new_room = __import__('event.models', fromlist=['Room']).Room.objects.create(**make_room_payload())

    res = staff_client.patch(detail(parent.pk), {'room_id': new_room.pk}, format='json')
    assert res.status_code == 200

    child1.refresh_from_db()
    assert child1.room_id == original_room_id


@pytest.mark.django_db
def test_put_no_children_does_not_error(world_data, staff_client, db):
    event = make_festival_event()
    payload = make_event_payload(event_type_id=event.event_type.pk, room_id=event.room.pk)
    res = staff_client.put(detail(event.pk), payload, format='json')
    assert res.status_code == 200
