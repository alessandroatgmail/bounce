"""
Factory functions for EventType API payloads.

Usage:
    from utils.mock_event_type import make_event_type_payload, make_event_type_payloads

    payload = make_event_type_payload()
    payload = make_event_type_payload(name="Workshop", frequency="weekly", partners=2)
    payloads = make_event_type_payloads(5)
"""

import itertools

from faker import Faker
from event.models import Frequency, PartnerRole

_fake = Faker()
# Counter suffix instead of _fake.unique: the word pool is finite and gets
# exhausted when the whole test suite runs in one process.
_seq = itertools.count(1)

_FREQUENCIES = [f.value for f in Frequency]


def make_event_type_payload(**overrides) -> dict:
    """Return a dict with all required EventType fields filled with fake data."""
    payload = {
        "name": f"{_fake.word().capitalize()} {next(_seq)}",
        "frequency": _fake.random_element(_FREQUENCIES),
        "partners": 0,
    }
    payload.update(overrides)
    return payload

def make_event_type_partner_payload(**overrides) -> dict:
    """Return a dict with all required EventType fields filled with fake data."""
    payload = {
        "name": f"{_fake.word().capitalize()} {next(_seq)}",
        "frequency": _fake.random_element(_FREQUENCIES),
        "partners": 2,
    }
    payload.update(overrides)
    return payload


def make_event_type_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock EventType payloads."""
    return [make_event_type_payload(**overrides) for _ in range(n)]
