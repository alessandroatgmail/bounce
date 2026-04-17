"""
Factory functions for ArtistType API payloads.

Usage:
    from utils.mock_artist_type import make_artist_type_payload, make_artist_type_payloads

    payload = make_artist_type_payload()
    payload = make_artist_type_payload(name="DJ")
    payloads = make_artist_type_payloads(5)
"""

from faker import Faker

_fake = Faker()


def make_artist_type_payload(**overrides) -> dict:
    """Return a dict with all required ArtistType fields filled with fake data."""
    payload = {
        "name": _fake.unique.word().capitalize(),
    }
    payload.update(overrides)
    return payload


def make_artist_type_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock ArtistType payloads."""
    return [make_artist_type_payload(**overrides) for _ in range(n)]
