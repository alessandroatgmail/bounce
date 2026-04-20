"""
Factory functions for Level API payloads.

Also provides seed_levels() to populate the standard set of levels.

Usage:
    from utils.mock_level import make_level_payload, make_level_payloads, seed_levels

    payload = make_level_payload()
    payloads = make_level_payloads(3)
    seed_levels()  # creates Open, Beginner, Improver, Intermediate, Advance in the DB
"""

import random
from event.models import Level

STANDARD_LEVELS = ["Open", "Beginner", "Improver", "Intermediate", "Advance"]


def seed_levels() -> list[Level]:
    """Create the standard levels in the DB and return them."""
    return [Level.objects.get_or_create(name=name)[0] for name in STANDARD_LEVELS]


def make_level_payload(**overrides) -> dict:
    payload = {"name": random.choice(STANDARD_LEVELS)}
    payload.update(overrides)
    return payload


def make_level_payloads(n: int, **overrides) -> list[dict]:
    return [make_level_payload(**overrides) for _ in range(n)]
