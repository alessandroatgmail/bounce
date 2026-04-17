"""
Factory functions for Artist API payloads.

ArtistType, Style and Genre instances are created as dependencies so that
type_ids, style_ids and genre_ids are always valid FKs.

An artist payload must contain either a user pk OR both first_name and last_name.

Usage:
    from utils.mock_artist import make_artist_payload, make_artist_payloads

    payload = make_artist_payload()                      # uses first_name / last_name
    payload = make_artist_payload(user_pk=user.pk)       # uses user FK
    payloads = make_artist_payloads(3)
"""

from faker import Faker
from event.models import ArtistType, Style, Genre
from utils.mock_artist_type import make_artist_type_payload
from utils.mock_style import make_style_payload
from utils.mock_genre import make_genre_payload

_fake = Faker("it_IT")


def _create_dependencies():
    types = [ArtistType.objects.create(**make_artist_type_payload()) for _ in range(2)]
    styles = [Style.objects.create(**make_style_payload()) for _ in range(2)]
    genres = [Genre.objects.create(**make_genre_payload()) for _ in range(2)]
    return types, styles, genres


def make_artist_payload(user_pk=None, **overrides) -> dict:
    """
    Return a dict with all required Artist fields.
    Creates ArtistType, Style and Genre instances in the DB.
    Pass user_pk to build a user-linked payload; otherwise first_name/last_name are used.
    """
    types, styles, genres = _create_dependencies()

    if user_pk is not None:
        payload = {
            "user": user_pk,
            "type_ids": [t.pk for t in types],
            "style_ids": [s.pk for s in styles],
            "genre_ids": [g.pk for g in genres],
        }
    else:
        payload = {
            "first_name": _fake.first_name(),
            "last_name": _fake.last_name(),
            "type_ids": [t.pk for t in types],
            "style_ids": [s.pk for s in styles],
            "genre_ids": [g.pk for g in genres],
        }

    payload.update(overrides)
    return payload


def make_artist_payloads(n: int, **overrides) -> list[dict]:
    """Return a list of n mock Artist payloads (all using first_name/last_name)."""
    return [make_artist_payload(**overrides) for _ in range(n)]
