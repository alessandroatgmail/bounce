"""
Event register: build the attendee grid for an event and consolidate it
into Booking rows.

The grid (build_register) is a view over the Booking model: bookings are
created automatically when a contribution becomes payed (see
booking.utils.add_payed_bookings) and written directly by the admin
register page through the staff bookings API, so the parent event's
bookings are always up to date. It powers GET /api/events/register/.
Consolidation (consolidate_register) replicates the parent's bookings
onto all its children — triggered from the register page or
automatically before the event starts (see
booking.tasks.consolidate_upcoming_parent_events).
"""
from typing import TypedDict

from django.contrib.auth import get_user_model
from django.db import transaction

from event.models import Event
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

class Student(TypedDict):
    """Represents a single member of the couple."""
    id: int
    email: str
    first_name: str
    last_name: str
    status: str | None            # can be "payed" or None
    contribution_id: int | None   # currently None, presumably an int when set
    attended: bool

class RegisterStudents(TypedDict):
    couple: bool
    members: dict[str, Student]

class RegisterDict(TypedDict):
    consolidated: bool
    event_id: int
    parent: bool
    roles: list[str]
    rows: list[RegisterStudents]



def rows_from_bookings(event: Event) -> RegisterDict:
    """
    """


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
        # "rows": _rows_from_bookings(event, bookings, roles),
        "rows": _get_rows_by_sql(event.id),
        "parent": is_parent,
        "consolidated": bool(bookings),
    }

def register(event):
    roles = event.event_type.partner_roles.all().values_list("name", flat=True)
    return {
        "event_id": event.id,
        "roles": roles,
        "rows": [],
        "parent": None,
        "consolidated": None,
    }


def consolidate_register(event, rows=None, removed_user_ids=None):
    """
    Replicate the parent event's bookings onto all its children.

    The parent's Booking rows are the always-up-to-date source of truth:
    paying creates them (booking.utils.add_payed_bookings) and the admin
    register page writes them directly through the staff bookings API.
    Consolidation is therefore a plain rebuild — every booking of every
    child event is deleted, then recreated as a copy of a parent booking
    (user, role, partner, partner_email, partner_role, contribution and
    couple flag).

    ``rows`` and ``removed_user_ids`` are accepted for backward
    compatibility with older callers and ignored: the grid payload no
    longer drives consolidation.

    Returns (created, deleted) counts.
    """

    if event.multi_events and not event.free:
        return 0, 0
    children = list(event.events.all())
    if event.event_set.first():
        if event.event_set.first().multi_events and not event.free:
            children = event.event_set.first().events.filter(level=event.level)
    if not children:
        return 0, 0

    parent_bookings = list(Booking.objects.filter(event=event))
    with transaction.atomic():
        deleted, _ = Booking.objects.filter(event__in=children).delete()
        copies = [
            Booking(
                user_id=booking.user_id,
                event=child,
                role_id=booking.role_id,
                partner_id=booking.partner_id,
                partner_email=booking.partner_email,
                partner_role_id=booking.partner_role_id,
                contribution_id=booking.contribution_id,
                couple=booking.couple,
            )
            for child in children
            for booking in parent_bookings
        ]
        Booking.objects.bulk_create(copies)
    return len(copies), deleted

def _get_rows_by_sql(event_id):
    from django.db import connection
    import json
    import psycopg2.extras

    query = """
    WITH couples AS (
        SELECT
            bb.id  AS booking_id,
            bb.couple,
            bb.event_id,
            bb.attended,
            bb.user_id,
            bb.role_id,
            bb.partner_id,
            bb.partner_email,
            bb.partner_role_id,
            bb2.id      AS partner_booking_id,
            bb2.role_id AS partner_actual_role_id,
            bb.attended as partner_attended
        FROM booking_booking bb
        LEFT JOIN booking_booking bb2
            ON bb.partner_id = bb2.user_id
            AND bb2.event_id = bb.event_id
        WHERE bb.event_id = %(event_id)s
          AND (
              bb.partner_id IS NULL
              OR bb.user_id < bb.partner_id
              OR bb2.id IS NULL
          )
    )
    SELECT
        c.couple,
        jsonb_build_object(
            COALESCE(r1.name, 'unknown_role'),
            jsonb_build_object(
                'id',                  u1.id,
                'email',               u1.email,
                'first_name',          u1.first_name,
                'last_name',           u1.last_name,
                'contribution_id',     co1.id,
                'attended',             c.attended,
                'status',              co1.status
            )
        )
        ||
        CASE
            WHEN c.partner_id IS NULL AND NULLIF(c.partner_email, '') IS NULL
                THEN jsonb_build_object(
            -- Partner role unknown: infer it as the opposite of the main role.
            -- Roles are guaranteed to be either 'Leader' or 'Follower'.
            COALESCE(
                r2.name,                          -- use the real role if we have it
                CASE r1.name
                    WHEN 'Leader'   THEN 'Follower'
                    WHEN 'Follower' THEN 'Leader'
                    ELSE 'unknown_role'           -- safety net: r1.name NULL or unexpected
                END
            ),
            NULL
        )
            ELSE jsonb_build_object(
                    COALESCE(
                    r2.name,                          -- use the real role if we have it
                    CASE r1.name
                        WHEN 'Leader'   THEN 'Follower'
                        WHEN 'Follower' THEN 'Leader'
                        ELSE 'unknown_role'           -- safety net: r1.name NULL or unexpected
                    END
                ),
                jsonb_build_object(
                    'id',                  u2.id,
                    'email',         	   coalesce(u2.email, c.partner_email),
                    'first_name',          u2.first_name,
                    'last_name',           u2.last_name,
                    'status',              co2.status,
                    'contribution_id',     co2.id,
                    'attended',             c.partner_attended
                )
            )
        END AS members
    FROM couples c
    LEFT JOIN users_user u1
        ON u1.id = c.user_id
    LEFT JOIN event_partnerrole r1
        ON r1.id = c.role_id
    LEFT JOIN LATERAL (
        SELECT bc.id, bc.status
        FROM booking_contribution bc
        JOIN booking_contribution_events bce
            ON bce.contribution_id = bc.id
        WHERE bce.event_id = c.event_id
          AND bc.user_id = c.user_id
        ORDER BY (bc.status = 'payed') DESC
        LIMIT 1
    ) co1 ON true
    LEFT JOIN users_user u2
        ON u2.id = c.partner_id
    LEFT JOIN event_partnerrole r2
        ON r2.id = COALESCE(c.partner_actual_role_id, c.partner_role_id)
    LEFT JOIN LATERAL (
        SELECT bc.id, bc.status
        FROM booking_contribution bc
        JOIN booking_contribution_events bce
            ON bce.contribution_id = bc.id
        WHERE bce.event_id = c.event_id
          AND bc.user_id = c.partner_id
        ORDER BY (bc.status = 'payed') DESC
        LIMIT 1
    ) co2 ON true;
    """

    with connection.cursor() as cursor:
        cursor.execute(query, {"event_id": event_id})
        psycopg2.extras.register_default_jsonb(
            conn_or_curs=cursor.cursor,  # the underlying psycopg2 cursor
            loads=json.loads,
        )
        cursor.execute(query, {"event_id": event_id})
        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return rows
