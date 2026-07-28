from django.db.models import Q
from django.utils import timezone


def add_payed_bookings(contribution):
    """
    Add the payer to the Booking model for every event of the contribution
    and all their children. Existing bookings are left untouched — an
    admin may already have re-arranged the register.

    A single payer (no partner) is automatically partnered, mutually, with
    the first unpartnered booking of another role on each event.
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
        events = event.events.filter(level=contribution.level).all()
    else:
        events = event.events.all()

    for event in [event, *events]:

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
