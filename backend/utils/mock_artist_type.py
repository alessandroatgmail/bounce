"""
Factory functions for ArtistType API payloads.

Usage:
    from utils.mock_artist_type import make_artist_type_payload, make_artist_type_payloads

    payload = make_artist_type_payload()
    payload = make_artist_type_payload(name="DJ")
    payloads = make_artist_type_payloads(5)
"""

import itertools

from faker import Faker

_fake = Faker()
# Counter suffix instead of _fake.unique: the word pool is finite and gets
# exhausted when the whole test suite runs in one process.
_seq = itertools.count(1)


def make_artist_type_payload(**overrides) -> dict:
    """Return a dict with all required ArtistType fields filled with fake data."""
    payload = {
        "name": f"{_fake.word().capitalize()} {next(_seq)}",
    }
    payload.update(overrides)
    return payload


def make_artist_type_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock ArtistType payloads."""
    return [make_artist_type_payload(**overrides) for _ in range(n)]
