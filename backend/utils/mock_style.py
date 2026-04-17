"""
Factory functions for Style API payloads.

Usage:
    from utils.mock_style import make_style_payload, make_style_payloads

    payload = make_style_payload()
    payload = make_style_payload(name="Salsa")
    payloads = make_style_payloads(5)
"""

from faker import Faker

_fake = Faker()


def make_style_payload(**overrides) -> dict:
    """Return a dict with all required Style fields filled with fake data."""
    payload = {
        "name": _fake.unique.word().capitalize(),
    }
    payload.update(overrides)
    return payload


def make_style_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Style payloads."""
    return [make_style_payload(**overrides) for _ in range(n)]
