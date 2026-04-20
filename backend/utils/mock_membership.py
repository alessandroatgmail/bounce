from faker import Faker
from membership.models import Membership, MembershipType

_fake = Faker("it_IT")
_TYPES = [t.value for t in MembershipType]


def make_membership_payload(**overrides) -> dict:
    import random
    payload = {
        "name": _fake.word().capitalize() + " Membership",
        "type": random.choice(_TYPES),
        "contribution": random.randint(10, 200),
        "max_courses": random.randint(0, 10),
        "max_parties": random.randint(0, 10),
        "color": "#e67e22",
        "event_ids": [],
    }
    payload.update(overrides)
    return payload
