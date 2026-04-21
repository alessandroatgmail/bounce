"""
Factory helpers for Festival API tests.

Creates all required dependencies:
  EventType(name='Festival'), Event, Room, FestivalDay, FesivalRoom.

Requires City rows in the database (use the world_data fixture).
"""

from datetime import date, timedelta

from event.models import EventType, Event, Room, Status, Type
from festival.models import FestivalDay, FesivalRoom
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload
from utils.mock_room import make_room_payload


def make_festival_event_type() -> EventType:
    """Return (or create) the singleton Festival event type."""
    et, _ = EventType.objects.get_or_create(
        name='Festival',
        defaults=make_event_type_payload(name='Festival', frequency='single'),
    )
    return et


def make_festival_event(**overrides) -> Event:
    """Create an Event whose event_type is named 'Festival'."""
    et = make_festival_event_type()
    payload = make_event_payload(event_type_id=et.pk, **overrides)
    event = Event.objects.create(
        name=payload['name'],
        status=payload.get('status', Status.DRAFT),
        event_type=et,
        type=payload.get('type', Type.MEMBERS),
        level_id=payload.get('level_id'),
        room_id=payload['room_id'],
        start_date=payload['start_date'],
        end_date=payload['end_date'],
        duration=payload['duration'],
        capacity=payload['capacity'],
    )
    return event


def make_festival_day(event: Event | None = None, **overrides) -> FestivalDay:
    if event is None:
        event = make_festival_event()
    data = {
        'date': date.today() + timedelta(days=1),
        'event': event,
    }
    data.update(overrides)
    return FestivalDay.objects.create(**data)


def make_festival_room(festival_day: FestivalDay | None = None, room: Room | None = None) -> FesivalRoom:
    if festival_day is None:
        festival_day = make_festival_day()
    if room is None:
        room = Room.objects.create(**make_room_payload())
    return FesivalRoom.objects.create(festival_day=festival_day, room=room)
