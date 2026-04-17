"""
Factory functions for Genre API payloads.

Usage:
    from utils.mock_genre import make_genre_payload, make_genre_payloads

    payload = make_genre_payload()
    payload = make_genre_payload(name="Latin")
    payloads = make_genre_payloads(5)
"""

from faker import Faker

_fake = Faker()


def make_genre_payload(**overrides) -> dict:
    """Return a dict with all required Genre fields filled with fake data."""
    payload = {
        "name": _fake.unique.word().capitalize(),
    }
    payload.update(overrides)
    return payload


def make_genre_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Genre payloads."""
    return [make_genre_payload(**overrides) for _ in range(n)]
