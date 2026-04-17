"""
Factory functions for EventType API payloads.

Usage:
    from utils.mock_event_type import make_event_type_payload, make_event_type_payloads

    payload = make_event_type_payload()
    payload = make_event_type_payload(name="Workshop", frequency="weekly", partners=2)
    payloads = make_event_type_payloads(5)
"""

from faker import Faker

_fake = Faker()

_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "yearly", "one-off"]


def make_event_type_payload(**overrides) -> dict:
    """Return a dict with all required EventType fields filled with fake data."""
    payload = {
        "name": _fake.unique.word().capitalize(),
        "frequency": _fake.random_element(_FREQUENCIES),
        "partners": _fake.random_int(min=0, max=4),
    }
    payload.update(overrides)
    return payload


def make_event_type_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock EventType payloads."""
    return [make_event_type_payload(**overrides) for _ in range(n)]
