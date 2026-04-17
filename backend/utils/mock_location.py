"""
Factory functions for Location API payloads.

Usage:
    from utils.mock_location import make_location_payload, make_location_payloads

    payload = make_location_payload()
    payload = make_location_payload(name="Studio Nord")
    payloads = make_location_payloads(5)

Requires City rows in the database (use the world_data fixture in tests).
"""

import random
from faker import Faker
from users.models import City

_fake = Faker("it_IT")


def _random_city_pk() -> int:
    ids = list(City.objects.values_list("id", flat=True))
    if not ids:
        raise RuntimeError("No cities in the database. Use the world_data fixture.")
    return random.choice(ids)


def make_location_payload(**overrides) -> dict:
    """Return a dict with all required Location fields filled with fake data."""
    payload = {
        "name": _fake.company(),
        "address": _fake.street_address(),
        "city_id": _random_city_pk(),
    }
    payload.update(overrides)
    return payload


def make_location_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Location payloads."""
    return [make_location_payload(**overrides) for _ in range(n)]
