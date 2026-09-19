from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from event.models import Event, Frequency
from utils.tasks import send_email as send_email_task


def _recurring_children_window(user, membership, event):
    """For a capped membership (`max_events` set) on a recurring,
    non-festival event, return the next `max_events` child occurrences the
    user hasn't already been booked into for this series — continuing
    right after their most recent booking on it, or starting from the very
    first class if they have none yet.

    Returns None when the cap doesn't apply (single event, festival, or an
    unlimited membership), so callers fall back to booking every child
    alongside the parent event. The returned list may be shorter than
    `max_events` when the series doesn't have that many classes left —
    callers must treat that as a validation error, not book a partial
    window silently.
    """
    if event.multi_events or event.event_type.frequency == Frequency.SINGLE:
        return None
    if not membership or not membership.max_events:
        return None

    from booking.models import Booking

    children = event.events.all()
    last_booking = (
        Booking.objects
        .filter(user=user, event__in=children)
        .select_related('event')
        .order_by('-event__start_date')
        .first()
    )
    ordered = children.order_by('start_date')
    if last_booking:
        ordered = ordered.filter(start_date__gt=last_booking.event.start_date)
    return list(ordered[:membership.max_events])


def book_events_for_contribution(contribution):
    """
    Create a Booking for every event this contribution covers — the event
    itself plus, for a regular repeating class or a non-free festival, all
    of its children (filtered by level for festivals) — regardless of the
    contribution's status. Existing bookings are left untouched — an
    admin may already have re-arranged the register.

    A regular repeating class paid for by a capped membership only books
    the next `max_events` occurrences after the user's last booking on the
    series (see _recurring_children_window) — the parent event itself is
    not booked in that case, since it's the series template rather than a
    session the student attends.

    A single registrant (no partner) is automatically partnered, mutually,
    with the first unpartnered booking of another role on each event.
    """
    from booking.models import Booking

    partner_email = (
        contribution.partner.email if contribution.partner
        else contribution.partner_email
    )
    couple = (
        contribution.original_contribution_id is not None
        or contribution.twin_contributions.exists()
    )
    event = contribution.events.first()

    if not event:
        return
    if event.multi_events and not event.free:
        fix_events = (
            contribution.membership.fix_events.all()
            if contribution.membership else Event.objects.none()
        )
        events = event.events.filter(
            Q(level=contribution.level) | Q(pk__in=fix_events.values_list("pk", flat=True))
        )
        targets = [event, *events]
    else:
        window = _recurring_children_window(contribution.user, contribution.membership, event)
        if window is not None:
            targets = window
        else:
            targets = [event, *event.events.all()]

    for event in targets:

        booking, _ = Booking.objects.get_or_create(
            user=contribution.user,
            event=event,
            defaults={
                "role": contribution.role,
                "partner_email": partner_email,
                "partner": contribution.partner,
                "partner_role": contribution.events.first().event_type.partner_roles.all().exclude(pk=contribution.role.pk).first() if partner_email else None,
                "contribution": contribution,
                "couple": couple,
                "role": contribution.role if contribution.role else None,
            },
        )
        if booking.partner_email or booking.role_id is None:
            continue
        free_partner = (
            Booking.objects
            .filter(event=event, role__isnull=False)
            .filter(Q(partner_email__isnull=True) | Q(partner_email=''))
            .exclude(role=booking.role)
            .exclude(pk=booking.pk)
            .select_related('user')
            .order_by('id')
            .first()
        )
        if free_partner:
            booking.partner_email = free_partner.user.email
            booking.partner = free_partner.user
            booking.contribution = contribution
            booking.partner_role = free_partner.role
            booking.save(update_fields=['partner_email', 'partner', 'contribution', 'partner_role'])
            free_partner.partner_email = booking.user.email
            free_partner.partner = booking.user
            free_partner.partner_role = booking.role
            free_partner.save(update_fields=['partner_email', 'partner', 'partner_role'])


def add_payed_bookings(contribution):
    """Payment no longer needs to create bookings — they already exist
    from registration time — but this is kept as a safety net for
    contributions whose events were attached without going through the
    booking endpoints (e.g. directly via the ORM), and stays idempotent
    via book_events_for_contribution's get_or_create."""
    book_events_for_contribution(contribution)


def mark_contributions_payed(contributions):
    """Flip each contribution to PAYED, saved one by one (not .update())
    so the PAYED transition in Contribution.save() runs and books the
    payer on the events."""
    from booking.models import ContributionStatus

    for contribution in contributions:
        contribution.status = ContributionStatus.PAYED
        contribution.save(update_fields=['status'])


def send_payment_emails(contributions):
    for c in contributions:
        first_event = c.events.first()
        send_email_task.delay(
            c.user.id,
            template='payment_success_email',
            context={
                'first_name': c.user.first_name,
                'event_name': first_event.name if first_event else '—',
                'membership_name': c.membership.name if c.membership else '—',
                'amount': str(c.discounted_amount),
                'url': settings.FRONTEND_URL + '/?section=payments',
            },
        )


def send_transaction_emails(transactions):
    """Sent for the amount actually paid in each transaction — not the full
    amount owed on its linked contribution(s), since a contribution can be
    settled across several installment payments. See the transaction_completed
    template (booking/migrations/0034_load_transaction_completed_email_template.py).

    Dispatches by id, not by passing the Transaction instance itself — Celery
    serializes .delay() arguments to JSON, and an ORM instance isn't
    serializable. send_transaction_completed_email re-fetches it inside the
    task instead."""
    from booking.tasks import send_transaction_completed_email

    for t in transactions:
        send_transaction_completed_email.delay(t.id)


def sync_bookings(user, added_events, removed_events):
    from booking.models import Booking

    now = timezone.now()

    for event in added_events:
        children = event.events.all()
        if event.start_date <= now:
            children = children.filter(start_date__gt=now)
        for child in children:
            Booking.objects.get_or_create(user=user, event=child)

    for event in removed_events:
        future_children = event.events.filter(start_date__gt=now)
        Booking.objects.filter(user=user, event__in=future_children).delete()
