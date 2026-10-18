"""
Case 4 — festival, free choice: event.multi_events=True, event.free=True.

Unlike Case 3 (fixed choice: one level + role picked once, applied to
every child at that level — see test_festival_booking.py), a free-choice
festival lets the student pick any set of child events themselves, each
with its own role. That set is submitted as `event_ids` alongside the
usual `event_id` (the festival/parent) on the regular
POST /api/booking/my-memberships/ endpoint — this case was never routed
through the dedicated book-festival/ endpoint, since there's no single
level to apply. Each entry is an object: `{"event_id": ..., "role_id":
...}` — `role_id` is null/omitted for a child whose event type has no
partner role.

Contract under test (nothing else about Case 4 yet — no event_ids,
or the wrong number of event_ids, must be rejected before anything is
created):
- `event_ids` is required when booking a free-choice festival; omitting
  it returns 400.
- The number of entries given (not counting the parent/festival itself)
  must equal the membership's `max_events`; a mismatched count returns
  400.
"""
import pytest
from datetime import timedelta
from django.core import mail
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution
from event.models import Event, EventType, PartnerRole
from membership.models import Membership
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

pytestmark = pytest.mark.django_db

LIST_URL = "/api/booking/my-memberships/book-free-festival/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event(event_type, start_date, capacity=None):
    payload = make_event_payload(event_type_id=event_type.pk)
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        room_id=payload["room_id"],
        start_date=start_date,
        end_date=start_date + timedelta(minutes=90),
        duration=90,
        capacity=capacity if capacity is not None else payload["capacity"],
    )


def make_free_festival(membership, n_children=3):
    """A free-choice multi_events festival (event.free=True) with
    `n_children` child events, linked to `membership` so
    _validate_membership_events accepts it."""
    event_type = EventType.objects.create(**make_event_type_payload())
    now = timezone.now()
    festival = make_event(event_type, now - timedelta(days=1))
    festival.multi_events = True
    festival.free = True
    festival.save()
    festival.memberships.add(membership)
    children = [
        make_event(event_type, now + timedelta(hours=i + 1))
        for i in range(n_children)
    ]
    festival.events.set(children)
    return festival, children


def make_membership(max_events, **overrides):
    defaults = {"name": "Festival Plan", "contribution": 50, "max_events": max_events, "duration": 0}
    defaults.update(overrides)
    return Membership.objects.create(**defaults)


def entry(event, role_id=None, partner_id=None):
    """One `event_ids` list entry — role_id stays null for an event
    whose type has no partner role; partner_id stays null for an event
    booked without a partner."""
    return {"event_id": event.id, "role_id": role_id, "partner_id": partner_id}


# ── event_ids is required ─────────────────────────────────────────────────────

class TestFreeFestivalRequiresEventIds:

    def test_missing_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, _children = make_free_festival(m)

        response = student_client.post(
            LIST_URL, {"membership_id": m.pk, "event_id": festival.id}, format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_empty_event_ids_list_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, _children = make_free_festival(m)

        response = student_client.post(
            LIST_URL,
            {"membership_id": m.pk, "event_id": festival.id, "event_ids": []},
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0


# ── event_ids count must match the membership's max_events ───────────────────

class TestFreeFestivalEventIdsCountMustMatchMaxEvents:

    def test_too_few_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {"membership_id": m.pk, "event_id": festival.id, "event_ids": [entry(children[0])]},
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_too_many_event_ids_returns_400(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(c) for c in children],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0

    def test_matching_count_is_accepted(self, student_client, student_user, world_data):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=3)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(children[0]), entry(children[1])],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get(pk=response.data["id"])
        # The parent festival stays on contribution.events too, same as
        # every other case — that's what the festival's own event card
        # matches against to show "already booked".
        assert set(contribution.events.values_list("id", flat=True)) == {
            festival.id, children[0].id, children[1].id,
        }
        assert Booking.objects.filter(
            user=student_user, event_id__in=[children[0].id, children[1].id],
        ).count() == 2


# ── Membership fix_events are additional, on top of max_events ───────────────

class TestFreeFestivalFixEvents:
    """A membership's fix_events (bonus events bundled with the plan
    regardless of what the student picks — e.g. a festival party) are
    booked alongside whatever was explicitly chosen, on top of
    max_events, not counted against it. max_events=4 with 3 fix_events
    means the student picks exactly 4 themselves and ends up with 7
    events total; only the 4 they picked are ever sent as event_ids."""

    def make_party_events(self, n=3):
        party_type = EventType.objects.create(**make_event_type_payload())
        now = timezone.now()
        return [make_event(party_type, now + timedelta(hours=5 + i)) for i in range(n)]

    def test_books_chosen_events_plus_fixed_events(self, student_client, student_user, world_data):
        m = make_membership(max_events=4)
        festival, children = make_free_festival(m, n_children=4)
        party1, party2, party3 = self.make_party_events()
        m.fix_events.set([party1, party2, party3])

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(c) for c in children],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        contribution = Contribution.objects.get(pk=response.data["id"])
        chosen_and_fixed = {c.id for c in children} | {party1.id, party2.id, party3.id}
        # The parent festival stays on contribution.events too — that's
        # what the festival's own event card checks for "already booked".
        assert set(contribution.events.values_list("id", flat=True)) == chosen_and_fixed | {festival.id}
        assert Booking.objects.filter(user=student_user, event_id__in=chosen_and_fixed).count() == 7

    def test_chosen_count_still_checked_against_max_events_not_reduced(
        self, student_client, student_user, world_data,
    ):
        """Picking fewer than max_events is still wrong, regardless of
        how many fix_events the plan carries — fix_events never reduce
        how many the student must pick."""
        m = make_membership(max_events=4)
        festival, children = make_free_festival(m, n_children=4)
        party1, party2, party3 = self.make_party_events()
        m.fix_events.set([party1, party2, party3])

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(children[0])],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0


# ── Partner is per-child, not shared across the whole registration ───────────

class TestFreeFestivalPerEventPartner:
    """Unlike the single-event/fixed-choice-festival case, a free-choice
    festival's partner isn't one value for the whole registration — each
    event_ids entry can name its own partner_id, since the student may
    pair with a different partner (or no partner) per child event."""

    def test_booking_partner_is_set_per_event(
        self, student_client, student_user, partner_user, world_data,
    ):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=2)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    entry(children[0], partner_id=partner_user.pk),
                    entry(children[1]),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        booking_with_partner = Booking.objects.get(user=student_user, event=children[0])
        booking_without_partner = Booking.objects.get(user=student_user, event=children[1])
        assert booking_with_partner.partner_id == partner_user.pk
        assert booking_without_partner.partner_id is None

    def test_partner_already_booked_for_event_returns_400(
        self, student_client, student_user, partner_client, partner_user, world_data,
    ):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=2)

        # Partner already has their own booking for one of the festival's
        # child events — booked independently, outside this festival.
        other_membership = make_membership(max_events=1)
        setup_response = partner_client.post(
            "/api/booking/my-memberships/",
            {"membership_id": other_membership.pk, "event_id": children[0].id},
            format="json",
        )
        assert setup_response.status_code == http_status.HTTP_201_CREATED

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    entry(children[0], partner_id=partner_user.pk),
                    entry(children[1]),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.filter(user=student_user).count() == 0


# ── A chosen child event can't be one the student is already booked for ─────

class TestFreeFestivalChildAlreadyBooked:
    """Same double-registration rule the single-event path already
    enforces (see validate_event_id/_validate_double_registrations) —
    a child event picked via event_ids must not be one the student
    already holds a contribution for, booked outside this festival."""

    def test_student_already_booked_for_event_returns_400(
        self, student_client, student_user, world_data,
    ):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=2)

        # Student already booked one of the festival's child events
        # directly, outside this festival.
        other_membership = make_membership(max_events=1)
        setup_response = student_client.post(
            "/api/booking/my-memberships/",
            {"membership_id": other_membership.pk, "event_id": children[0].id},
            format="json",
        )
        assert setup_response.status_code == http_status.HTTP_201_CREATED

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [entry(children[0]), entry(children[1])],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        # Only the earlier direct booking exists — the rejected attempt
        # must not have created a second contribution.
        assert Contribution.objects.filter(user=student_user).count() == 1


# ── Naming a partner also books the partner on that event ────────────────────

class TestFreeFestivalPartnerBooking:
    """Naming a partner for a child event books the partner on it too —
    a plain Booking (no mirrored Contribution: the partner isn't the one
    paying), with the two Bookings pointing at each other via
    role/partner_role, same as the mutual-pairing convention used
    elsewhere (see book_events_for_contribution). Pairing the same
    partner across several events still sends them a single combined
    email, not one per event — same "one email however many events"
    rule as create_partner_contributions_for_user's activation hook."""

    def make_festival_with_roles(self, max_events=2, n_children=2):
        m = make_membership(max_events=max_events)
        festival, children = make_free_festival(m, n_children=n_children)
        leader = PartnerRole.objects.get_or_create(name="Leader")[0]
        follower = PartnerRole.objects.get_or_create(name="Follower")[0]
        festival.event_type.partner_roles.set([leader, follower])
        return m, festival, children, leader, follower

    def test_partner_gets_their_own_booking_not_a_contribution(
        self, student_client, student_user, partner_user, world_data,
    ):
        m, festival, children, leader, follower = self.make_festival_with_roles()

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    entry(children[0], role_id=leader.pk, partner_id=partner_user.pk),
                    entry(children[1], role_id=leader.pk, partner_id=partner_user.pk),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        partner_booking = Booking.objects.get(user=partner_user, event=children[0])
        assert partner_booking.partner_id == student_user.pk
        assert partner_booking.role_id == follower.pk
        assert partner_booking.contribution_id is None
        student_booking = Booking.objects.get(user=student_user, event=children[0])
        assert student_booking.partner_role_id == follower.pk
        assert Contribution.objects.filter(user=partner_user).count() == 0

    def test_same_partner_across_events_gets_one_combined_email(
        self, student_client, student_user, partner_user, world_data,
    ):
        m, festival, children, leader, follower = self.make_festival_with_roles()

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    entry(children[0], role_id=leader.pk, partner_id=partner_user.pk),
                    entry(children[1], role_id=leader.pk, partner_id=partner_user.pk),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        partner_emails = [e for e in mail.outbox if partner_user.email in e.to]
        assert len(partner_emails) == 1
        assert children[0].name in partner_emails[0].body
        assert children[1].name in partner_emails[0].body

    def test_email_includes_partner_role_and_booker_name(
        self, student_client, student_user, partner_user, world_data,
    ):
        student_user.first_name = "Alice"
        student_user.last_name = "Booker"
        student_user.save()
        m, festival, children, leader, follower = self.make_festival_with_roles()

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    entry(children[0], role_id=leader.pk, partner_id=partner_user.pk),
                    entry(children[1], role_id=leader.pk, partner_id=partner_user.pk),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_201_CREATED
        partner_email = next(e for e in mail.outbox if partner_user.email in e.to)
        # The partner was booked as Follower (the complement of the
        # booker's Leader) on both events — and should be told who added
        # them, not just which classes.
        assert follower.name in partner_email.body
        assert "Alice Booker" in partner_email.body


# ── An unresolvable partner email must not be silently dropped ──────────────

class TestFreeFestivalInvalidPartnerEmail:
    """The frontend resolves an email to a partner_id client-side, but
    sends the raw email too — if resolution failed (typo, unregistered
    account) partner_id comes through null while partner_email still
    carries what the student typed. That must be validated server-side
    (same rule as the base serializer's partner_email), not silently
    booked without a partner."""

    def test_unresolvable_partner_email_returns_400(
        self, student_client, student_user, world_data,
    ):
        m = make_membership(max_events=2)
        festival, children = make_free_festival(m, n_children=2)

        response = student_client.post(
            LIST_URL,
            {
                "membership_id": m.pk, "event_id": festival.id,
                "event_ids": [
                    {
                        "event_id": children[0].id, "role_id": None,
                        "partner_id": None, "partner_email": "nope@nowhere.com",
                    },
                    entry(children[1]),
                ],
            },
            format="json",
        )

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Contribution.objects.count() == 0
