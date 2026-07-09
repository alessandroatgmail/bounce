"""
Factory functions for Style API payloads.

Usage:
    from utils.mock_style import make_style_payload, make_style_payloads

    payload = make_style_payload()
    payload = make_style_payload(name="Salsa")
    payloads = make_style_payloads(5)
"""

import itertools

from faker import Faker

_fake = Faker()
# Counter suffix instead of _fake.unique: the word pool is finite and gets
# exhausted when the whole test suite runs in one process.
_seq = itertools.count(1)


def make_style_payload(**overrides) -> dict:
    """Return a dict with all required Style fields filled with fake data."""
    payload = {
        "name": f"{_fake.word().capitalize()} {next(_seq)}",
    }
    payload.update(overrides)
    return payload


def make_style_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Style payloads."""
    return [make_style_payload(**overrides) for _ in range(n)]
