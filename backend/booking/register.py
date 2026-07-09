"""
Event register: build the attendee grid for an event and consolidate it
into Booking rows.

The grid (build_register) is a view over the Booking model: bookings are
created automatically when a contribution becomes payed (see
booking.utils.add_payed_bookings), so the register fills up as people
pay. It powers GET /api/events/register/. Consolidation
(consolidate_register) writes a grid back into Booking for the event and
all its children — either from a payload posted by the frontend or
automatically before the event starts (see
booking.tasks.consolidate_upcoming_parent_events).
"""
from django.contrib.auth import get_user_model
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


class ConsolidateError(ValueError):
    """Base class for invalid consolidation payloads."""


class CoupleSplitError(ConsolidateError):
    """A consolidation payload places the two members of a real couple
    (twin contributions) in different rows."""


class PayedMemberRemovalError(ConsolidateError):
    """A consolidation payload asks to remove a user who has a payed
    contribution for the event."""


def _booking_cell(booking, payed_user_ids):
    user = booking.user
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "status": ContributionStatus.PAYED if user.id in payed_user_ids else None,
        "contribution_id": None,
        "attended": booking.attended,
    }


def _rows_from_bookings(event, bookings, roles):
    """Build the grid rows from Booking records, pairing members through
    their mutual partner_email. Users holding a payed contribution for the
    event keep status 'payed' on their cell — they cannot be removed from
    the register.

    A partner referenced by partner_email but not booked yet (couple mate
    who has not payed) is shown with their role and contribution status
    while it is payed/accepted/waiting; a partner with no account at all
    is shown as an email-only cell."""
    payed_user_ids = set(
        Contribution.objects.filter(
            events=event, status=ContributionStatus.PAYED,
        ).values_list("user_id", flat=True)
    )

    def role_of(booking):
        return booking.role.name if booking.role else "unknown"

    for booking in bookings:
        if role_of(booking) not in roles:
            roles.append(role_of(booking))

    by_email = {b.user.email: b for b in bookings}

    # Partners referenced by email but without a booking.
    missing_emails = {
        b.partner_email for b in bookings
        if b.partner_email and b.partner_email not in by_email
    }
    visible_statuses = {
        ContributionStatus.PAYED,
        ContributionStatus.ACCEPTED,
        ContributionStatus.WAITING,
    }
    pending_partners, registered_emails = {}, set()
    if missing_emails:
        for c in (
            Contribution.objects
            .filter(events=event, user__email__in=missing_emails)
            .select_related("user", "role")
            .order_by("date", "id")
        ):
            if c.status in visible_statuses:
                pending_partners.setdefault(c.user.email, c)
        registered_emails = set(
            get_user_model().objects
            .filter(email__in=missing_emails)
            .values_list("email", flat=True)
        )

    rows, consumed = [], set()
    for booking in bookings:
        if booking.id in consumed:
            continue
        consumed.add(booking.id)
        members = {name: None for name in roles}
        members[role_of(booking)] = _booking_cell(booking, payed_user_ids)

        mate = by_email.get(booking.partner_email) if booking.partner_email else None
        if mate:
            if mate.id not in consumed and members[role_of(mate)] is None:
                consumed.add(mate.id)
                members[role_of(mate)] = _booking_cell(mate, payed_user_ids)
        elif booking.partner_email:
            partner_c = pending_partners.get(booking.partner_email)
            if partner_c:
                cell = _member_cell(partner_c)
                preferred = partner_c.role.name if partner_c.role else None
            elif booking.partner_email not in registered_emails:
                # No account at all: only the email is known.
                cell = _email_only_cell(booking.partner_email)
                preferred = None
            else:
                # Registered but no visible contribution (e.g. cancelled).
                cell = None
                preferred = None
            if cell:
                if preferred not in members or members.get(preferred) is not None:
                    preferred = next((n for n in roles if members[n] is None), None)
                if preferred:
                    members[preferred] = cell

        rows.append({"couple": booking.couple, "members": members})
    return rows


def build_register(event):
    """
    Return the attendee grid {event_id, roles, rows, parent, consolidated}
    for an event.

    ``parent`` is False when the event is a child of another event.
    ``consolidated`` is True when the event has Booking records. The rows
    come straight from the bookings (see _rows_from_bookings) — an event
    without bookings has an empty register, since paying is what books a
    user in.
    """
    roles = [r.name for r in event.event_type.partner_roles.all()]
    is_parent = not type(event).events.through.objects.filter(to_event=event).exists()

    bookings = list(
        Booking.objects.filter(event=event)
        .select_related("user", "role")
        .order_by("id")
    )
    return {
        "event_id": event.id,
        "roles": roles,
        "rows": _rows_from_bookings(event, bookings, roles),
        "parent": is_parent,
        "consolidated": bool(bookings),
    }


def _validate_couples_not_split(event, rows):
    """Raise CoupleSplitError when two users who booked together as a
    couple (contributions linked via original_contribution) appear in
    different rows of the payload."""
    twin_pairs = Contribution.objects.filter(
        events=event, original_contribution__isnull=False,
    ).values_list("user_id", "original_contribution__user_id")

    row_of = {
        member["id"]: index
        for index, row in enumerate(rows)
        for member in (row.get("members") or {}).values()
        if member and member.get("id") is not None
    }
    for user_id, twin_user_id in twin_pairs:
        if (
            user_id in row_of and twin_user_id in row_of
            and row_of[user_id] != row_of[twin_user_id]
        ):
            raise CoupleSplitError(
                f"Users {user_id} and {twin_user_id} booked as a couple "
                "and cannot be placed in different rows."
            )


def consolidate_register(event, rows, removed_user_ids=None):
    """
    Insert the register grid into Booking, for the event and all its
    children.

    Every member with a user id gets a Booking carrying its partner role,
    the email of the row mate and the row's ``couple`` flag. A mate
    without an account (id null, email-only) cannot be booked: it is
    dropped and the member is treated as single (no partner_email). Real
    couples must stay on the same row (CoupleSplitError otherwise).

    ``removed_user_ids`` lists users whose bookings must be deleted from
    the event and its children — allowed only for users without a payed
    contribution for the event (PayedMemberRemovalError otherwise); ids
    still present in the rows are kept.

    Idempotent: re-running updates role/partner_email/couple but never
    touches ``attended``.

    Returns (created, updated) counts.
    """
    _validate_couples_not_split(event, rows)

    events = [event, *event.events.all()]

    removed_user_ids = set(removed_user_ids or [])
    if removed_user_ids:
        payed_removed = Contribution.objects.filter(
            events=event,
            status=ContributionStatus.PAYED,
            user_id__in=removed_user_ids,
        ).values_list("user_id", flat=True)
        if payed_removed:
            raise PayedMemberRemovalError(
                f"Users {sorted(payed_removed)} have a payed contribution "
                "and cannot be removed from the register."
            )
        ids_in_rows = {
            member["id"]
            for grid_row in rows
            for member in (grid_row.get("members") or {}).values()
            if member and member.get("id") is not None
        }
        Booking.objects.filter(
            event__in=events,
            user_id__in=removed_user_ids - ids_in_rows,
        ).delete()
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
                            "couple": bool(row.get("couple")),
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1
    return created, updated
