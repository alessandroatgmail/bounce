"""
Utility to load countries from the bundled CSV into the Country model.

Usage:
    from utils.load_countries import seed_countries

    seed_countries()              # load all countries
    seed_countries(test=True)     # load only the first 10 (for tests)
"""

import csv
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent / "data" / "countries.csv"
_TEST_LIMIT = 10


def _read_csv(test: bool = False) -> list[dict]:
    rows = []
    with open(_DATA_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if test and i >= _TEST_LIMIT:
                break
            rows.append({
                "name": row["name"],
                "m49": int(row["m49"]),
                "iso": row["ISO"],
            })
    return rows


def seed_countries(test: bool = False) -> int:
    """
    Load countries from the CSV into the Country model.
    Skips rows that already exist (idempotent).

    Args:
        test: When True, load only the first 10 rows.

    Returns:
        Number of Country objects created.
    """
    from users.models import Country

    rows = _read_csv(test=test)

    created = 0
    for row in rows:
        _, was_created = Country.objects.get_or_create(
            iso=row["iso"],
            defaults={"name": row["name"], "m49": row["m49"]},
        )
        if was_created:
            created += 1

    return created
