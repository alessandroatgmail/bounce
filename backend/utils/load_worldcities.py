"""
Load world cities from utils/data/worldcities.csv into the DB.

For each row the script:
  - Gets or creates a Country matched by iso3 code (creates name from the csv country column)
  - Gets or creates a Region matched by (admin_name, country)
  - Gets or creates a City matched by (city_ascii, country)

Usage:
    from utils.load_worldcities import load_worldcities

    load_worldcities()              # load all cities
    load_worldcities(debug=True)    # load only the first 10, print progress
"""

import csv
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent / "data" / "worldcities.csv"
_DEBUG_LIMIT = 10


def load_worldcities(debug: bool = False) -> dict:
    """
    Load cities (and their countries/regions) from worldcities.csv into the DB.
    Idempotent — safe to run multiple times.

    Args:
        debug: When True, process only the first 10 rows and print progress.

    Returns:
        Dict with counts: {"countries": int, "regions": int, "cities": int}
    """
    from users.models import Country, Region, City

    counts = {"countries": 0, "regions": 0, "cities": 0}

    with open(_DATA_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader):
            if debug and i >= _DEBUG_LIMIT:
                break

            iso3 = row["iso3"].strip()
            country_name = row["country"].strip()
            admin_name = row["admin_name"].strip()
            city_name = row["city_ascii"].strip()

            if not iso3 or not city_name:
                if debug:
                    print(f"  [skip] row {i}: missing iso3 or city name")
                continue

            # ── Country ───────────────────────────────────────────────────────
            country, created = Country.objects.get_or_create(
                iso=iso3,
                defaults={"name": country_name},
            )
            if created:
                counts["countries"] += 1
                if debug:
                    print(f"  [country +] {country_name} ({iso3})")

            # ── Region ────────────────────────────────────────────────────────
            region = None
            if admin_name:
                region, created = Region.objects.get_or_create(
                    name=admin_name,
                    country=country,
                )
                if created:
                    counts["regions"] += 1
                    if debug:
                        print(f"  [region  +] {admin_name} — {country_name}")

            # ── City ──────────────────────────────────────────────────────────
            _, created = City.objects.get_or_create(
                name=city_name,
                country=country,
                defaults={"region": region},
            )
            if created:
                counts["cities"] += 1
                if debug:
                    print(f"  [city    +] {city_name} — {admin_name or '?'}, {country_name}")

    if debug:
        print(f"\nDone: {counts['countries']} countries, {counts['regions']} regions, {counts['cities']} cities created.")

    return counts
