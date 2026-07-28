"""
Factory functions for Genre API payloads.

Usage:
    from utils.mock_genre import make_genre_payload, make_genre_payloads

    payload = make_genre_payload()
    payload = make_genre_payload(name="Latin")
    payloads = make_genre_payloads(5)
"""

import itertools

from faker import Faker

_fake = Faker()
# Counter suffix instead of _fake.unique: the word pool is finite and gets
# exhausted when the whole test suite runs in one process.
_seq = itertools.count(1)


def make_genre_payload(**overrides) -> dict:
    """Return a dict with all required Genre fields filled with fake data."""
    payload = {
        "name": f"{_fake.word().capitalize()} {next(_seq)}",
    }
    payload.update(overrides)
    return payload


def make_genre_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Genre payloads."""
    return [make_genre_payload(**overrides) for _ in range(n)]
