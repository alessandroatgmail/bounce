"""
Occupancy summary for AccommodationTypes, scoped to a single event: for each
type, how many of its rooms are fully booked (occupants == occupants_per_room,
regardless of payment) vs. fully booked AND fully paid — both expressed as a
rate over the type's configured available_rooms.

"Paid" is derived per-occupant: a room's occupants are User rows (no direct
link to Contribution any more), so a room counts as fully paid only when
every occupant holds some Contribution with status=PAYED linked to the
room's event.
"""
import pytest
from rest_framework import status

from booking.models import AccommodationRoom, AccommodationType, Contribution, ContributionStatus, ExtraItem
from event.models import Location
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_location import make_location_payload

OCCUPANCY_URL = "/api/booking/accommodation-types/occupancy/"


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name="Hotel Airone"))


@pytest.fixture
def extra_item(db, location):
    item = ExtraItem.objects.create(
        name="Airone Triple", name_it="Airone Tripla", name_en="Airone Triple", value=120,
    )
    AccommodationType.objects.create(
        extra_item=item, location=location, occupants_per_room=3, available_rooms=2,
    )
    return item


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    from event.models import Event
    return Event.objects.create(**payload)


@pytest.fixture
def other_event(world_data):
    payload = make_event_payload()
    for key in ("style_ids", "genre_ids", "artist_ids", "event_ids"):
        payload.pop(key)
    from event.models import Event
    return Event.objects.create(**payload)


def make_user(email, **overrides):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email, password="StrongPass123!",
        first_name=overrides.pop("first_name", local.capitalize()),
        last_name=overrides.pop("last_name", "Test"),
        is_active=True, **overrides,
    )


def make_user_with_contribution(event, email, status=ContributionStatus.CONFIRMED):
    """A user holding a Contribution linked to `event` with the given
    status — this is what the occupancy endpoint checks (per-occupant,
    status=PAYED) to decide whether a room is fully paid."""
    user = make_user(email)
    contribution = Contribution.objects.create(user=user, amount=0, status=status)
    contribution.events.add(event)
    return user


def make_room(extra_item, event, **overrides):
    return AccommodationRoom.objects.create(extra_item=extra_item, event=event, **overrides)


def entry_for(response, extra_item_id):
    return next(e for e in response.data if e["extra_item_id"] == extra_item_id)


class TestAccommodationTypeOccupancyPermissions:
    def test_unauthenticated_request_returns_401(self, client, extra_item, event):
        response = client.get(OCCUPANCY_URL, {"event": event.pk})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_cannot_view(self, student_client, extra_item, event):
        response = student_client.get(OCCUPANCY_URL, {"event": event.pk})
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAccommodationTypeOccupancy:
    def test_missing_event_returns_400(self, admin_client, extra_item):
        response = admin_client.get(OCCUPANCY_URL)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_no_rooms_yet(self, admin_client, extra_item, event):
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        assert response.status_code == status.HTTP_200_OK
        entry = entry_for(response, extra_item.pk)
        assert entry["available_rooms"] == 2
        assert entry["full_booked_rooms"] == 0
        assert entry["full_paid_rooms"] == 0
        assert entry["occupancy_rate"] == "0/2"
        assert entry["full_paid_rate"] == "0/2"

    def test_partially_occupied_room_not_counted_as_full(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)  # capacity 3
        room.users.add(make_user("c1@bounce.com"), make_user("c2@bounce.com"))
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        entry = entry_for(response, extra_item.pk)
        assert entry["full_booked_rooms"] == 0
        assert entry["full_paid_rooms"] == 0

    def test_full_but_unpaid_room_counts_as_booked_not_paid(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        room.users.add(
            make_user_with_contribution(event, "c1@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c2@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c3@bounce.com", status=ContributionStatus.WAITING),
        )
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        entry = entry_for(response, extra_item.pk)
        assert entry["full_booked_rooms"] == 1
        assert entry["full_paid_rooms"] == 0
        assert entry["occupancy_rate"] == "1/2"
        assert entry["full_paid_rate"] == "0/2"

    def test_full_and_fully_paid_room(self, admin_client, extra_item, event):
        room = make_room(extra_item, event)
        room.users.add(
            make_user_with_contribution(event, "c1@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c2@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c3@bounce.com", status=ContributionStatus.PAYED),
        )
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        entry = entry_for(response, extra_item.pk)
        assert entry["full_booked_rooms"] == 1
        assert entry["full_paid_rooms"] == 1
        assert entry["occupancy_rate"] == "1/2"
        assert entry["full_paid_rate"] == "1/2"

    def test_mixed_rooms_both_counted_in_occupancy(self, admin_client, extra_item, event):
        paid_room = make_room(extra_item, event)
        paid_room.users.add(
            make_user_with_contribution(event, "c1@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c2@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(event, "c3@bounce.com", status=ContributionStatus.PAYED),
        )
        unpaid_full_room = make_room(extra_item, event)
        unpaid_full_room.users.add(
            make_user_with_contribution(event, "c4@bounce.com", status=ContributionStatus.WAITING),
            make_user_with_contribution(event, "c5@bounce.com", status=ContributionStatus.WAITING),
            make_user_with_contribution(event, "c6@bounce.com", status=ContributionStatus.WAITING),
        )
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        entry = entry_for(response, extra_item.pk)
        assert entry["full_booked_rooms"] == 2
        assert entry["full_paid_rooms"] == 1
        assert entry["occupancy_rate"] == "2/2"
        assert entry["full_paid_rate"] == "1/2"

    def test_rooms_from_other_event_not_counted(self, admin_client, extra_item, event, other_event):
        room = make_room(extra_item, other_event)
        room.users.add(
            make_user_with_contribution(other_event, "c1@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(other_event, "c2@bounce.com", status=ContributionStatus.PAYED),
            make_user_with_contribution(other_event, "c3@bounce.com", status=ContributionStatus.PAYED),
        )
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        entry = entry_for(response, extra_item.pk)
        assert entry["full_booked_rooms"] == 0
        assert entry["full_paid_rooms"] == 0

    def test_returns_entry_for_every_accommodation_type(self, admin_client, extra_item, event, location):
        other_item = ExtraItem.objects.create(
            name="Falco Double", name_it="Falco Doppia", name_en="Falco Double", value=90,
        )
        AccommodationType.objects.create(
            extra_item=other_item, location=location, occupants_per_room=2, available_rooms=5,
        )
        response = admin_client.get(OCCUPANCY_URL, {"event": event.pk})
        ids = {e["extra_item_id"] for e in response.data}
        assert {extra_item.pk, other_item.pk} <= ids
