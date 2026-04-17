"""
Factory functions for Room API payloads.

A Location instance is created as a dependency so that location_id is always
a valid FK. Requires City rows in the database (use the world_data fixture).

Usage:
    from utils.mock_room import make_room_payload, make_room_payloads

    payload = make_room_payload()
    payload = make_room_payload(name="Hall A", capacity=50)
    payloads = make_room_payloads(3)
"""

from faker import Faker
from event.models import Location
from utils.mock_location import make_location_payload

_fake = Faker("it_IT")


def _create_location() -> Location:
    return Location.objects.create(**make_location_payload())


def make_room_payload(**overrides) -> dict:
    """Return a dict with all required Room fields. Creates a Location in the DB."""
    payload = {
        "name": _fake.word().capitalize(),
        "capacity": _fake.random_int(min=5, max=200),
        "location_id": _create_location().pk,
    }
    payload.update(overrides)
    return payload


def make_room_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Room payloads, each with its own Location."""
    return [make_room_payload(**overrides) for _ in range(n)]
