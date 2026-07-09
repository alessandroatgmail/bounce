"""
Event register: build the attendee grid for an event and consolidate it
into Booking rows.

The grid (build_register) lists every user with a payed contribution,
arranged in rows by partner role; it powers GET /api/events/register/.
Consolidation (consolidate_register) turns those rows into Booking
records for the event and all its children — either from a payload
posted back by the frontend or automatically before the event starts
(see booking.tasks.consolidate_upcoming_events).
"""
from itertools import zip_longest

from django.db import transaction

from event.models import PartnerRole
from .models import Booking, Contribution, ContributionStatus


def _member_cell(contribution):
    user = contribution.user
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": contribution.status,
        "contribution_id": contribution.id,
    }


def _email_only_cell(email):
    return {
        "id": None,
        "email": email,
        "first_name": None,
        "last_name": None,
        "status": None,
        "contribution_id": None,
    }


def _booking_cell(booking):
    user = booking.user
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": None,
        "contribution_id": None,
        "attended": booking.attended,
    }


def _rows_from_bookings(bookings, roles):
    """Rebuild the grid rows from consolidated Booking records, pairing
    members through their mutual partner_email."""
    def role_of(booking):
        return booking.role.name if booking.role else "unknown"

    for booking in bookings:
        if role_of(booking) not in roles:
            roles.append(role_of(booking))

    by_email = {b.user.email: b for b in bookings}
    rows, consumed = [], set()
    for booking in bookings:
        if booking.id in consumed:
            continue
        consumed.add(booking.id)
        members = {name: None for name in roles}
        members[role_of(booking)] = _booking_cell(booking)
        mate = by_email.get(booking.partner_email) if booking.partner_email else None
        if mate and mate.id not in consumed and members[role_of(mate)] is None:
            consumed.add(mate.id)
            members[role_of(mate)] = _booking_cell(mate)
        rows.append({"couple": False, "members": members})
    return rows


def build_register(event):
    """
    Return the attendee grid {event_id, roles, rows, parent, consolidated}
    for an event.

    ``parent`` is False when the event is a child of another event. Once
    the event has Booking records (``consolidated`` True) the rows come
    straight from them; otherwise they are computed from contributions:
    couples (linked via original_contribution) share a row — a partner who
    has not payed is included only while accepted or waiting, with its
    status exposed so the frontend can highlight it; otherwise the payed
    member is treated as single. A partner known only by email (no
    account, so no twin contribution) is shown as an email-only cell.
    Remaining singles are auto-paired across roles in booking-date order.
    """
    roles = [r.name for r in event.event_type.partner_roles.all()]
    is_parent = not type(event).events.through.objects.filter(to_event=event).exists()

    bookings = list(
        Booking.objects.filter(event=event)
        .select_related("user", "role")
        .order_by("id")
    )
    if bookings:
        return {
            "event_id": event.id,
            "roles": roles,
            "rows": _rows_from_bookings(bookings, roles),
            "parent": is_parent,
            "consolidated": True,
        }

    contributions = list(
        Contribution.objects.filter(events=event)
        .select_related("user", "role")
        .order_by("date", "id")
    )
    by_id = {c.id: c for c in contributions}

    # Twin lookup in both directions (original -> twin and twin -> original)
    twin_of = {}
    for c in contributions:
        original = by_id.get(c.original_contribution_id)
        if original:
            twin_of[c.id] = original
            twin_of[original.id] = c

    partner_visible_statuses = {
        ContributionStatus.PAYED,
        ContributionStatus.ACCEPTED,
        ContributionStatus.WAITING,
    }
    couples, email_couples, singles, consumed = [], [], [], set()
    for c in contributions:
        if c.status != ContributionStatus.PAYED or c.id in consumed:
            continue
        partner_c = twin_of.get(c.id)
        if partner_c and partner_c.status in partner_visible_statuses \
                and partner_c.id not in consumed:
            consumed.update((c.id, partner_c.id))
            couples.append((c, partner_c))
        elif c.partner_id is None and c.partner_email:
            # Partner not in the system yet: only their email is known.
            consumed.add(c.id)
            email_couples.append(c)
        else:
            consumed.add(c.id)
            singles.append(c)

    # Extend the columns with any role seen on an included contribution
    # but missing from the event type (defensive; also covers null roles).
    included = [c for pair in couples for c in pair] + email_couples + singles
    for c in included:
        role_name = c.role.name if c.role else "unknown"
        if role_name not in roles:
            roles.append(role_name)

    def role_of(contribution):
        return contribution.role.name if contribution.role else "unknown"

    rows = []
    for pair in couples:
        members = {name: None for name in roles}
        for c in pair:
            members[role_of(c)] = _member_cell(c)
        rows.append({"couple": True, "members": members})

    for c in email_couples:
        members = {name: None for name in roles}
        members[role_of(c)] = _member_cell(c)
        partner_column = next((n for n in roles if members[n] is None), None)
        if partner_column:
            members[partner_column] = _email_only_cell(c.partner_email)
        rows.append({"couple": True, "members": members})

    buckets = {name: [] for name in roles}
    for c in singles:
        buckets[role_of(c)].append(c)
    for line in zip_longest(*(buckets[name] for name in roles)):
        members = {
            name: _member_cell(c) if c else None
            for name, c in zip(roles, line)
        }
        rows.append({"couple": False, "members": members})

    return {
        "event_id": event.id,
        "roles": roles,
        "rows": rows,
        "parent": is_parent,
        "consolidated": False,
    }


def consolidate_register(event, rows):
    """
    Insert the register grid into Booking, for the event and all its
    children.

    Every member with a user id gets a Booking carrying its partner role
    and the email of the row mate. The ``couple`` flag is ignored. A mate
    without an account (id null, email-only) cannot be booked: it is
    dropped and the member is treated as single (no partner_email).
    Idempotent: re-running updates role/partner_email but never touches
    ``attended``.

    Returns (created, updated) counts.
    """
    events = [event, *event.events.all()]
    role_cache = {}

    def role_named(name):
        if name not in role_cache:
            role_cache[name] = PartnerRole.objects.filter(name=name).first()
        return role_cache[name]

    created = updated = 0
    with transaction.atomic():
        for row in rows:
            members = row.get("members") or {}
            for role_name, member in members.items():
                if not member or member.get("id") is None:
                    continue
                partner_email = next(
                    (mate["email"] for name, mate in members.items()
                     if name != role_name and mate
                     and mate.get("id") is not None and mate.get("email")),
                    None,
                )
                for target in events:
                    _, was_created = Booking.objects.update_or_create(
                        user_id=member["id"],
                        event=target,
                        defaults={
                            "role": role_named(role_name),
                            "partner_email": partner_email,
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1
    return created, updated
