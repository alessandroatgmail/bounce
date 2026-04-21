"""
Tests for the weekly recurring event creation logic.

When an event with a weekly EventType is created via the API, the backend
generates one child Event per week between start_date and end_date (inclusive),
names each "{original_name} - dd/mm/yyyy", and links them all to the original
via the events M2M field.
"""
import pytest
from datetime import datetime, timedelta
from rest_framework import status as http_status

from event.models import Event
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload
from event.models import EventType

LIST_URL = "/api/events/events/"


def make_weekly_event_type():
    return EventType.objects.create(**make_event_type_payload(frequency="weekly"))


def make_single_event_type():
    return EventType.objects.create(**make_event_type_payload(frequency="single"))


# ── Single frequency — no recurrence ─────────────────────────────────────────

class TestNoRecurrenceForSingle:

    def test_single_frequency_creates_one_event(self, staff_client, world_data):
        et = make_single_event_type()
        payload = make_event_payload(event_type_id=et.pk)
        staff_client.post(LIST_URL, payload, format="json")
        assert Event.objects.count() == 1

    def test_single_frequency_events_m2m_is_empty(self, staff_client, world_data):
        et = make_single_event_type()
        payload = make_event_payload(event_type_id=et.pk)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["events"] == []


# ── Weekly recurrence — count ─────────────────────────────────────────────────

class TestWeeklyRecurrenceCount:

    def test_two_weeks_creates_two_children(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)   # Tuesday
        end   = datetime(2026, 4, 28, 10, 0)   # Tuesday +1 week
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        # original + 2 children
        assert Event.objects.count() == 3

    def test_five_weeks_creates_five_children(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 5, 19, 10, 0)   # 4 weeks later = 5 Tuesdays
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        assert Event.objects.count() == 6  # original + 5

    def test_end_before_next_week_creates_one_child(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 25, 10, 0)   # only 4 days later, no second Tuesday
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        assert Event.objects.count() == 2  # original + 1


# ── Weekly recurrence — naming ────────────────────────────────────────────────

class TestWeeklyRecurrenceNaming:

    def test_child_names_include_original_name(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            name="Lindy Hop",
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        children = Event.objects.exclude(name="Lindy Hop")
        assert all("Lindy Hop" in c.name for c in children)

    def test_child_names_contain_date_in_european_format(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            name="Swing",
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        children = Event.objects.exclude(name="Swing").order_by("start_date")
        names = [c.name for c in children]
        assert names[0] == "Swing - 21/04/2026"
        assert names[1] == "Swing - 28/04/2026"


# ── Weekly recurrence — dates ─────────────────────────────────────────────────

class TestWeeklyRecurrenceDates:

    def test_children_start_dates_are_weekly_apart(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 5, 5, 10, 0)   # 3 Tuesdays
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        children = list(original.events.order_by("start_date"))
        assert len(children) == 3
        assert children[1].start_date.date() - children[0].start_date.date() == timedelta(weeks=1)
        assert children[2].start_date.date() - children[1].start_date.date() == timedelta(weeks=1)

    def test_children_preserve_original_time(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 18, 30)
        end   = datetime(2026, 4, 28, 18, 30)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        for child in original.events.all():
            assert child.start_date.hour == 18
            assert child.start_date.minute == 30

    def test_child_end_date_is_start_plus_duration(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
            duration=90,
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        for child in original.events.all():
            expected_end = child.start_date + timedelta(minutes=90)
            assert child.end_date == expected_end

    def test_first_child_start_date_equals_original_start(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        first_child = original.events.order_by("start_date").first()
        assert first_child.start_date.date() == start.date()

    def test_last_child_start_date_does_not_exceed_end_range(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 5, 19, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        last_child = original.events.order_by("start_date").last()
        assert last_child.start_date.date() <= end.date()


# ── Weekly recurrence — data inheritance ─────────────────────────────────────

class TestWeeklyRecurrenceDataInheritance:

    def test_children_inherit_status(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            status="confirmed",
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        assert all(c.status == "confirmed" for c in original.events.all())

    def test_children_inherit_capacity(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            capacity=42,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        assert all(c.capacity == 42 for c in original.events.all())

    def test_children_inherit_room(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        assert all(c.room_id == original.room_id for c in original.events.all())

    def test_children_inherit_styles(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        original_style_ids = set(original.styles.values_list("id", flat=True))
        for child in original.events.all():
            assert set(child.styles.values_list("id", flat=True)) == original_style_ids

    def test_children_inherit_genres(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        original_genre_ids = set(original.genres.values_list("id", flat=True))
        for child in original.events.all():
            assert set(child.genres.values_list("id", flat=True)) == original_genre_ids

    def test_children_inherit_artists(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        original_artist_ids = set(original.artists.values_list("id", flat=True))
        for child in original.events.all():
            assert set(child.artists.values_list("id", flat=True)) == original_artist_ids


# ── Weekly recurrence — M2M linkage ──────────────────────────────────────────

class TestWeeklyRecurrenceLinkage:

    def test_original_events_m2m_contains_all_children(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 5, 5, 10, 0)   # 3 occurrences
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])
        assert original.events.count() == 3

    def test_children_are_not_linked_to_each_other(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        staff_client.post(LIST_URL, payload, format="json")
        original = Event.objects.get(name=payload["name"])

        for child in original.events.all():

            assert child.events.count() == 0

    def test_response_includes_child_ids(self, staff_client, world_data):
        et = make_weekly_event_type()
        start = datetime(2026, 4, 21, 10, 0)
        end   = datetime(2026, 4, 28, 10, 0)
        payload = make_event_payload(
            event_type_id=et.pk,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        response = staff_client.post(LIST_URL, payload, format="json")
        assert len(response.data["events"]) == 2
