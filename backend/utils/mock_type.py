"""
Factory functions for Type API payloads.

Usage:
    from utils.mock_type import make_type_payload, make_type_payloads

    payload = make_type_payload()
    payload = make_type_payload(name="Solo")
    payloads = make_type_payloads(5)
"""

from faker import Faker

_fake = Faker()


def make_type_payload(**overrides) -> dict:
    """Return a dict with all required Type fields filled with fake data."""
    payload = {
        "name": _fake.unique.word().capitalize(),
    }
    payload.update(overrides)
    return payload


def make_type_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Type payloads."""
    return [make_type_payload(**overrides) for _ in range(n)]
