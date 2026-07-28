"""
Bounce Blues Festival — full end-to-end scenario driven through the API.

Setup, all through admin endpoints (no ORM writes except student accounts,
which have no admin endpoint):

  * Festival "Bounce Blues Festival", multi_events, Oct 30 2026 → midnight
    closing Sunday Nov 1 2026.
  * 16 child classes of 75 minutes, capacity 5, extras 2, over Saturday
    Oct 31 and Sunday Nov 1, two rooms, four levels:
      - Sat morning   room 1: Improvers ×2      room 2: Intermediate ×2
      - Sat afternoon room 1: Advance ×2        room 2: Advance+ ×2
      - Sun morning   room 1: Advance ×2        room 2: Advance+ ×2
      - Sun afternoon room 1: Improvers ×2      room 2: Intermediate ×2
    Morning slots 10:00-11:15 / 11:30-12:45, afternoon 14:00-15:15 /
    15:30-16:45 (15-minute breaks).
  * Two festival passes linked to the festival:
      - "Early Bird"  €135, bookable Aug 15 → Sep 15 2026
      - "Normal Rate" €165, bookable Sep 15 → Oct 15 2026
    (the Normal Rate price is not part of the spec — any value works).

Booking flow under test (the payload the real frontend sends: parent
festival as event_id + membership_id + role_id + level_id):

  * membership window: students only see/book the pass whose window covers
    now (time is frozen inside a window with mocker).
  * partner registration: booking with partner_id mirrors a twin
    contribution with the opposite role, both accepted.
  * single registration: a solo role is accepted while the level's role
    imbalance stays within the class extras (2).
  * waiting list: a booking beyond the level's role imbalance or beyond the
    level's class capacity (5 accepted/payed) lands on WAITING.
  * cancellation: a student can cancel an unpaid contribution; the freed
    spot makes the level bookable again; paid contributions cannot be
    cancelled.
"""
import pytest
from datetime import datetime

from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from booking.models import Contribution, ContributionStatus, Booking
from event.models import Event
from users.models import User, City

pytestmark = pytest.mark.django_db

EVENTS_URL = "/api/events/events/"
EVENT_TYPES_URL = "/api/events/event-types/"
PARTNER_ROLES_URL = "/api/events/partner-roles/"
LEVELS_URL = "/api/events/levels/"
LOCATIONS_URL = "/api/events/locations/"
ROOMS_URL = "/api/events/rooms/"
ARTISTS_URL = "/api/events/artists/"
MEMBERSHIPS_URL = "/api/membership/memberships/"
MY_MEMBERSHIPS_URL = "/api/booking/my-memberships/"

SATURDAY = "2026-10-31"
SUNDAY = "2026-11-01"
MORNING_SLOTS = [("10:00", "11:15"), ("11:30", "12:45")]
AFTERNOON_SLOTS = [("14:00", "15:15"), ("15:30", "16:45")]

LEVEL_NAMES = ["Improvers", "Intermediate", "Advance", "Advance+"]

IN_EARLY_BIRD_WINDOW = datetime(2026, 9, 1, 12, 0)
IN_NORMAL_RATE_WINDOW = datetime(2026, 10, 1, 12, 0)


def freeze(mocker, naive_dt):
    """Freeze django.utils.timezone.now at the given (naive, local) moment."""
    frozen = timezone.make_aware(naive_dt)
    mocker.patch("django.utils.timezone.now", return_value=frozen)
    return frozen


@pytest.fixture
def september(mocker):
    """Now = Sep 1 2026: Early Bird open, Normal Rate not started yet."""
    return freeze(mocker, IN_EARLY_BIRD_WINDOW)


def post(client, url, payload):
    response = client.post(url, payload, format="json")
    assert response.status_code == http_status.HTTP_201_CREATED, response.data
    return response.data


def make_student(email):
    local = email.split("@")[0]
    return User.objects.create_user(
        email=email,
        password="StrongPass123!",
        first_name=local.capitalize(),
        last_name="Test",
        is_active=True,
    )


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def book(student, festival, membership, role=None, level=None, partner=None):
    payload = {
        "membership_id": festival["memberships"][membership],
        "event_id": festival["festival_id"],
    }
    if role:
        payload["role_id"] = festival["roles"][role]
    if level:
        payload["level_id"] = festival["levels"][level]
    if partner:
        payload["partner_id"] = partner.id
        payload["partner_email"] = partner.email
    return client_for(student).post(MY_MEMBERSHIPS_URL, payload, format="json")


def contribution_of(user):
    return Contribution.objects.get(user=user)


@pytest.fixture
def blues_festival(admin_client, world_data):
    """Build the whole festival through the admin API. Returns a dict of ids."""
    # ── roles + event types ───────────────────────────────────────────────
    leader = post(admin_client, PARTNER_ROLES_URL, {"name": "Leader"})
    follower = post(admin_client, PARTNER_ROLES_URL, {"name": "Follower"})
    role_ids = [leader["id"], follower["id"]]

    festival_type = post(admin_client, EVENT_TYPES_URL, {
        "name": "Blues Festival", "frequency": "single",
        "partners": 2, "role_ids": role_ids,
    })
    class_type = post(admin_client, EVENT_TYPES_URL, {
        "name": "Blues Class", "frequency": "single",
        "partners": 2, "role_ids": role_ids,
    })

    # ── levels ────────────────────────────────────────────────────────────
    levels = {
        name: post(admin_client, LEVELS_URL, {"name": name})["id"]
        for name in LEVEL_NAMES
    }

    # ── venue: location + two rooms ───────────────────────────────────────
    city = City.objects.first()  # seeded by world_data; cities have no create endpoint
    location = post(admin_client, LOCATIONS_URL, {
        "name": "Blues Venue", "address": "Via del Blues 1", "city_id": city.pk,
    })
    room1 = post(admin_client, ROOMS_URL, {
        "name": "Room 1", "capacity": 30, "location_id": location["id"],
    })["id"]
    room2 = post(admin_client, ROOMS_URL, {
        "name": "Room 2", "capacity": 30, "location_id": location["id"],
    })["id"]

    # ── teachers ──────────────────────────────────────────────────────────
    teacher1 = post(admin_client, ARTISTS_URL, {"first_name": "Vicci", "last_name": "Moore"})["id"]
    teacher2 = post(admin_client, ARTISTS_URL, {"first_name": "Damon", "last_name": "Stone"})["id"]

    # ── festival passes with booking windows ──────────────────────────────
    early = post(admin_client, MEMBERSHIPS_URL, {
        "name": "Early Bird", "type": "single", "contribution": 135,
        "max_events": 0, "duration": 0,
        "start_date": "2026-08-15T00:00:00", "end_date": "2026-09-15T00:00:00",
    })["id"]
    normal = post(admin_client, MEMBERSHIPS_URL, {
        "name": "Normal Rate", "type": "single", "contribution": 165,
        "max_events": 0, "duration": 0,
        "start_date": "2026-09-15T00:00:00", "end_date": "2026-10-15T23:59:59",
    })["id"]

    # ── 16 classes: (day, slots, room, level, teacher) ────────────────────
    sessions = [
        (SATURDAY, MORNING_SLOTS,   room1, "Improvers",    teacher1),
        (SATURDAY, MORNING_SLOTS,   room2, "Intermediate", teacher2),
        (SATURDAY, AFTERNOON_SLOTS, room1, "Advance",      teacher1),
        (SATURDAY, AFTERNOON_SLOTS, room2, "Advance+",     teacher2),
        (SUNDAY,   MORNING_SLOTS,   room1, "Advance",      teacher2),
        (SUNDAY,   MORNING_SLOTS,   room2, "Advance+",     teacher1),
        (SUNDAY,   AFTERNOON_SLOTS, room1, "Improvers",    teacher2),
        (SUNDAY,   AFTERNOON_SLOTS, room2, "Intermediate", teacher1),
    ]
    child_ids = []
    for day, slots, room_id, level_name, teacher_id in sessions:
        for start, end in slots:
            child = post(admin_client, EVENTS_URL, {
                "name": f"{level_name} class {day} {start}",
                "status": "draft",
                "event_type_id": class_type["id"],
                "type": "members",
                "level_id": levels[level_name],
                "room_id": room_id,
                "start_date": f"{day}T{start}:00",
                "end_date": f"{day}T{end}:00",
                "duration": 75,
                "capacity": 5,
                "extras": 2,
                "accepted_role_ids": role_ids,
                "artist_ids": [teacher_id],
            })
            child_ids.append(child["id"])

    # ── parent festival, then publish (cascades to the children) ─────────
    festival = post(admin_client, EVENTS_URL, {
        "name": "Bounce Blues Festival",
        "status": "draft",
        "event_type_id": festival_type["id"],
        "type": "members",
        "room_id": room1,
        "start_date": "2026-10-30T00:00:00",
        "end_date": "2026-11-02T00:00:00",  # midnight closing Sunday Nov 1
        "duration": 4320,
        "capacity": 80,
        "multi_events": True,
        "event_ids": child_ids,
        "membership_ids": [early, normal],
        "accepted_role_ids": role_ids,
        # "extras": 2,
    })
    response = admin_client.patch(
        f"{EVENTS_URL}{festival['id']}/", {"status": "published"}, format="json",
    )
    assert response.status_code == http_status.HTTP_200_OK, response.data

    return {
        "festival_id": festival["id"],
        "child_ids": child_ids,
        "memberships": {"early": early, "normal": normal},
        "roles": {"Leader": leader["id"], "Follower": follower["id"]},
        "levels": levels,
        "rooms": {"room1": room1, "room2": room2},
    }


# ── Setup sanity ──────────────────────────────────────────────────────────────

class TestFestivalSetup:

    def test_festival_has_16_published_classes(self, blues_festival):
        festival = Event.objects.get(pk=blues_festival["festival_id"])
        children = festival.events.all()
        assert children.count() == 16
        assert all(c.status == "published" for c in children)
        assert all(c.capacity == 5 for c in children)
        assert all(c.extras == 2 for c in children)
        assert all(c.duration == 75 for c in children)

    def test_each_level_has_4_classes(self, blues_festival):
        festival = Event.objects.get(pk=blues_festival["festival_id"])
        for level_name in LEVEL_NAMES:
            assert festival.events.filter(level__name=level_name).count() == 4

    def test_schedule_layout(self, blues_festival):
        """Each level runs in the right room, day and half-day."""
        festival = Event.objects.get(pk=blues_festival["festival_id"])
        room1 = blues_festival["rooms"]["room1"]
        room2 = blues_festival["rooms"]["room2"]

        def slots_of(level_name):
            slots = set()
            for c in festival.events.filter(level__name=level_name):
                local = timezone.localtime(c.start_date)
                slots.add((local.strftime("%Y-%m-%d"), local.hour, c.room_id))
            return slots

        assert slots_of("Improvers") == {
            (SATURDAY, 10, room1), (SATURDAY, 11, room1),
            (SUNDAY, 14, room1), (SUNDAY, 15, room1),
        }
        assert slots_of("Intermediate") == {
            (SATURDAY, 10, room2), (SATURDAY, 11, room2),
            (SUNDAY, 14, room2), (SUNDAY, 15, room2),
        }
        assert slots_of("Advance") == {
            (SATURDAY, 14, room1), (SATURDAY, 15, room1),
            (SUNDAY, 10, room1), (SUNDAY, 11, room1),
        }
        assert slots_of("Advance+") == {
            (SATURDAY, 14, room2), (SATURDAY, 15, room2),
            (SUNDAY, 10, room2), (SUNDAY, 11, room2),
        }


# ── Membership windows ────────────────────────────────────────────────────────

class TestMembershipWindows:

    def festival_url(self, blues_festival):
        return f"{EVENTS_URL}{blues_festival['festival_id']}/"

    def test_student_sees_only_early_bird_during_early_window(
        self, september, blues_festival, student_client,
    ):
        response = student_client.get(self.festival_url(blues_festival))
        assert [m["name"] for m in response.data["memberships"]] == ["Early Bird"]

    def test_student_sees_only_normal_rate_in_october(
        self, mocker, blues_festival, student_client,
    ):
        freeze(mocker, IN_NORMAL_RATE_WINDOW)
        response = student_client.get(self.festival_url(blues_festival))
        assert [m["name"] for m in response.data["memberships"]] == ["Normal Rate"]

    def test_admin_sees_both_passes(self, september, blues_festival, admin_client):
        response = admin_client.get(self.festival_url(blues_festival))
        names = {m["name"] for m in response.data["memberships"]}
        assert names == {"Early Bird", "Normal Rate"}

    def test_cannot_book_normal_rate_during_early_window(self, september, blues_festival):
        anna = make_student("anna@test.com")
        response = book(anna, blues_festival, "normal", role="Leader", level="Improvers")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "membership_id" in response.data

    def test_cannot_book_early_bird_after_it_closed(self, mocker, blues_festival):
        freeze(mocker, IN_NORMAL_RATE_WINDOW)
        anna = make_student("anna@test.com")
        response = book(anna, blues_festival, "early", role="Leader", level="Improvers")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "membership_id" in response.data

    def test_normal_rate_booking_in_october_succeeds(self, mocker, blues_festival):
        freeze(mocker, IN_NORMAL_RATE_WINDOW)
        anna = make_student("anna@test.com")
        response = book(anna, blues_festival, "normal", role="Leader", level="Improvers")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert contribution_of(anna).amount == 165


# ── Partner registration ──────────────────────────────────────────────────────

class TestPartnerRegistration:

    def test_couple_booking_creates_two_accepted_contributions(self, september, blues_festival):
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")

        response = book(anna, blues_festival, "early",
                        role="Leader", level="Improvers", partner=bruno)
        assert response.status_code == http_status.HTTP_201_CREATED, response.data

        assert Contribution.objects.count() == 2
        anna_c = contribution_of(anna)
        bruno_c = contribution_of(bruno)
        assert anna_c.status == ContributionStatus.ACCEPTED
        assert bruno_c.status == ContributionStatus.ACCEPTED
        assert anna_c.partner == bruno
        assert bruno_c.partner == anna
        assert bruno_c.original_contribution == anna_c
        assert anna_c.role.name == "Leader"
        assert bruno_c.role.name == "Follower"
        assert anna_c.amount == 135

    def test_partner_cannot_book_the_festival_again(self, september, blues_festival):
        anna = make_student("anna@test.com")
        bruno = make_student("bruno@test.com")
        book(anna, blues_festival, "early", role="Leader", level="Improvers", partner=bruno)

        response = book(bruno, blues_festival, "early", role="Follower", level="Improvers")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Single registration ───────────────────────────────────────────────────────

class TestSingleRegistration:

    def test_solo_booking_is_accepted(self, september, blues_festival, admin_client):
        emma = make_student("emma@test.com")
        response = book(emma, blues_festival, "early", role="Leader", level="Improvers")
        assert response.status_code == http_status.HTTP_201_CREATED, response.data
        contribution = contribution_of(emma)
        assert contribution.status == ContributionStatus.ACCEPTED
        assert contribution.amount == 135
        response = admin_client.patch(
            f"/api/booking/contributions/{contribution.id}/",
            {"status": ContributionStatus.PAYED},
            format="json",
        )
        levels = set(Booking.objects.filter(user=emma).values_list("event__level__name", flat=True))
        print (levels)
        print (Booking.objects.filter(user=emma, event__level__name__in=levels).values())
        assert len(levels) == 2
        assert response.status_code == http_status.HTTP_200_OK

    def test_role_is_required(self, september, blues_festival):
        emma = make_student("emma@test.com")
        response = book(emma, blues_festival, "early", level="Improvers")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_double_registration_rejected(self, september, blues_festival):
        emma = make_student("emma@test.com")
        assert book(emma, blues_festival, "early", role="Leader",
                    level="Improvers").status_code == http_status.HTTP_201_CREATED
        response = book(emma, blues_festival, "early", role="Leader", level="Improvers")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST


# ── Waiting list ──────────────────────────────────────────────────────────────

def fill_improvers(blues_festival):
    """
    Fill the Improvers level to its class capacity of 5 accepted:
    two couples (4) plus one solo leader. Returns the solo leader and
    their contribution id.
    """
    anna, bruno = make_student("anna@test.com"), make_student("bruno@test.com")
    carla, dario = make_student("carla@test.com"), make_student("dario@test.com")
    assert book(anna, blues_festival, "early", role="Leader",
                level="Improvers", partner=bruno).status_code == 201
    assert book(carla, blues_festival, "early", role="Leader",
                level="Improvers", partner=dario).status_code == 201
    emma = make_student("emma@test.com")
    response = book(emma, blues_festival, "early", role="Leader", level="Improvers")
    assert response.status_code == 201
    print ("how many extras?")
    print(blues_festival)
    festival = Event.objects.get(id=blues_festival['festival_id'])
    print(festival.contributions.count())
    print(festival.contributions.values("role"))
    assert contribution_of(emma).status == ContributionStatus.ACCEPTED
    return emma, response.data["id"]


class TestWaitingList:

    def test_third_unmatched_leader_goes_to_waiting_list(self, september, blues_festival):
        # extras=2 on the classes: at most 2 unmatched leaders are accepted.
        leaders = [make_student(f"leader{i}@test.com") for i in range(3)]
        for student in leaders:
            assert book(student, blues_festival, "early", role="Leader",
                        level="Improvers").status_code == http_status.HTTP_201_CREATED

        statuses = [contribution_of(s).status for s in leaders]
        assert statuses[:2] == [ContributionStatus.ACCEPTED] * 2
        assert statuses[2] == ContributionStatus.WAITING

    def test_minority_role_is_still_accepted(self, september, blues_festival):
        for i in range(2):
            book(make_student(f"leader{i}@test.com"), blues_festival, "early",
                 role="Leader", level="Improvers")
        fabia = make_student("fabia@test.com")
        assert book(fabia, blues_festival, "early", role="Follower",
                    level="Improvers").status_code == http_status.HTTP_201_CREATED
        assert contribution_of(fabia).status == ContributionStatus.ACCEPTED

    def test_sixth_student_of_a_full_level_goes_to_waiting_list(self, september, blues_festival):
        fill_improvers(blues_festival)
        frank = make_student("frank@test.com")
        response = book(frank, blues_festival, "early", role="Follower", level="Improvers")
        assert response.status_code == http_status.HTTP_201_CREATED
        print (Contribution.objects.all().values("user__email", "level", "role"))
        assert contribution_of(frank).status == ContributionStatus.WAITING

    def test_full_level_does_not_block_other_levels(self, september, blues_festival):
        fill_improvers(blues_festival)
        gina = make_student("gina@test.com")
        assert book(gina, blues_festival, "early", role="Leader",
                    level="Advance").status_code == http_status.HTTP_201_CREATED
        assert contribution_of(gina).status == ContributionStatus.ACCEPTED


# ── Cancellation ──────────────────────────────────────────────────────────────

class TestCancellation:

    def test_student_can_cancel_a_booking(self, september, blues_festival):
        emma = make_student("emma@test.com")
        response = book(emma, blues_festival, "early", role="Leader", level="Improvers")
        contribution_id = response.data["id"]

        response = client_for(emma).delete(f"{MY_MEMBERSHIPS_URL}{contribution_id}/")
        assert response.status_code == http_status.HTTP_204_NO_CONTENT
        assert contribution_of(emma).status == ContributionStatus.CANCELLED

    def test_cancelled_spot_reopens_the_level(self, september, blues_festival):
        emma, emma_contribution_id = fill_improvers(blues_festival)
        frank = make_student("frank@test.com")
        book(frank, blues_festival, "early", role="Follower", level="Improvers")
        assert contribution_of(frank).status == ContributionStatus.WAITING

        # The solo leader gives up their spot.
        response = client_for(emma).delete(f"{MY_MEMBERSHIPS_URL}{emma_contribution_id}/")
        assert response.status_code == http_status.HTTP_204_NO_CONTENT

        # A new follower now fits in the level again (4 accepted < 5).
        giulia = make_student("giulia@test.com")
        assert book(giulia, blues_festival, "early", role="Follower",
                    level="Improvers").status_code == http_status.HTTP_201_CREATED
        assert contribution_of(giulia).status == ContributionStatus.ACCEPTED

        # The waiting student is notified, not silently promoted.
        assert contribution_of(frank).status == ContributionStatus.WAITING

    def test_paid_contribution_cannot_be_cancelled(self, september, blues_festival, admin_client):
        emma = make_student("emma@test.com")
        response = book(emma, blues_festival, "early", role="Leader", level="Improvers")
        contribution_id = response.data["id"]

        response = admin_client.patch(
            f"/api/booking/contributions/{contribution_id}/",
            {"status": ContributionStatus.PAYED},
            format="json",
        )
        assert response.status_code == http_status.HTTP_200_OK

        response = client_for(emma).delete(f"{MY_MEMBERSHIPS_URL}{contribution_id}/")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN
        assert contribution_of(emma).status == ContributionStatus.PAYED
