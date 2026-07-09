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
    for event in contribution.events.all():
        for target in [event, *event.events.all()]:
            booking, _ = Booking.objects.get_or_create(
                user=contribution.user,
                event=target,
                defaults={
                    "role": contribution.role,
                    "partner_email": partner_email,
                    "couple": couple,
                },
            )
            if booking.partner_email or booking.role_id is None:
                continue
            free_partner = (
                Booking.objects
                .filter(event=target, role__isnull=False)
                .filter(Q(partner_email__isnull=True) | Q(partner_email=''))
                .exclude(role=booking.role)
                .exclude(pk=booking.pk)
                .select_related('user')
                .order_by('id')
                .first()
            )
            if free_partner:
                booking.partner_email = free_partner.user.email
                booking.save(update_fields=['partner_email'])
                free_partner.partner_email = booking.user.email
                free_partner.save(update_fields=['partner_email'])


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
