"""
Factory functions for Event API payloads.

Creates all required dependencies in the DB:
  EventType, Room (→ Location → City), Style x2, Genre x2, Artist x1.

Requires City rows in the database (use the world_data fixture in tests).

Usage:
    from utils.mock_event import make_event_payload, make_event_payloads

    payload = make_event_payload()
    payload = make_event_payload(status="published", capacity=50)
    payloads = make_event_payloads(3)
"""

import random
from datetime import datetime, timedelta
from django.utils import timezone

from faker import Faker

from event.models import EventType, Type, Room, Style, Genre, Artist, Level, Status
from utils.mock_event_type import make_event_type_payload
from utils.mock_room import make_room_payload
from utils.mock_style import make_style_payload
from utils.mock_genre import make_genre_payload
from utils.mock_level import make_level_payload

_fake = Faker("it_IT")
_TYPES = [t.value for t in Type]


def _create_dependencies():
    event_type = EventType.objects.create(**make_event_type_payload())
    level = Level.objects.create(**make_level_payload())
    room = Room.objects.create(**make_room_payload())
    styles = [Style.objects.create(**make_style_payload()) for _ in range(2)]
    genres = [Genre.objects.create(**make_genre_payload()) for _ in range(2)]
    artist = Artist.objects.create(
        first_name=_fake.first_name(),
        last_name=_fake.last_name(),
    )
    return event_type, level, room, styles, genres, artist


def make_event_payload(**overrides) -> dict:
    """Return a dict with all required Event fields. Creates all dependencies in the DB."""
    event_type, level, room, styles, genres, artist = _create_dependencies()

    start = timezone.now() + timedelta(days=random.randint(1, 30))
    duration_minutes = random.randint(30, 240)
    end = start + timedelta(minutes=duration_minutes)

    payload = {
        "name": _fake.sentence(nb_words=3).rstrip("."),
        "status": Status.DRAFT,
        "event_type_id": event_type.pk,
        "type": random.choice(_TYPES),
        "level_id": level.pk,
        "room_id": room.pk,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "duration": duration_minutes,
        "capacity": random.randint(10, 100),
        "style_ids": [s.pk for s in styles],
        "genre_ids": [g.pk for g in genres],
        "artist_ids": [artist.pk],
        "event_ids": [],
    }
    payload.update(overrides)
    return payload


def make_event_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Event payloads."""
    return [make_event_payload(**overrides) for _ in range(n)]
