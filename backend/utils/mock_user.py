"""
Factory functions for mock user API payloads using Faker.

Usage:
    from utils.mock_user import make_user_payload, make_user_payloads

    payload = make_user_payload()
    payload = make_user_payload(email="custom@bounce.com", acsi=True)

    payloads = make_user_payloads(5)
    payloads = make_user_payloads(3, acsi=True)
"""

import random

from faker import Faker

from users.models import Country, City

_fake = Faker("it_IT")


def _random_city() -> City:
    ids = list(City.objects.values_list("id", flat=True))
    if not ids:
        raise RuntimeError("No cities in the database. Run load_worldcities() first.")
    return City.objects.get(id=random.choice(ids))


def make_user_payload(**overrides) -> dict:
    """
    Return a dict with all required registration fields filled with Faker data.
    password2 mirrors password so they match by default.
    Any field can be overridden via kwargs.
    """
    acsi = random.choice([True, False])
    password = _fake.password(length=12, special_chars=True, digits=True, upper_case=True)
    place_of_birth = _random_city()
    city = _random_city()

    payload = {
        "email": _fake.unique.email(),
        "password": password,
        "password2": password,
        "first_name": _fake.first_name(),
        "last_name": _fake.last_name(),
        "phone": _fake.phone_number(),
        "date_of_birth": _fake.date_of_birth(minimum_age=18, maximum_age=80).isoformat(),
        "place_of_birth": place_of_birth.pk,
        "ci": _fake.ssn(),
        "address": _fake.street_address(),
        "city": city.pk,
        "postal_code": _fake.postcode(),
        "country": city.country.pk,
        "acsi": acsi,
        "acsi_number": _fake.bothify("??#####").upper() if acsi else None,
        "acsi_starting_date": _fake.date_between(start_date="-2y", end_date="today").isoformat() if acsi else None,
        "privacy_consent": True,
        "marketing_consent": False,
    }
    payload.update(overrides)
    return payload


def make_user_payloads(n: int, **overrides) -> list[dict]:
    """
    Return a list of n mock user payloads, each with a unique email.
    Shared overrides are applied to all payloads.
    """
    return [make_user_payload(**overrides) for _ in range(n)]
