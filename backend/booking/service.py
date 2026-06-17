from django.db import transaction
from django.utils import timezone
from datetime import date

from dateutil.relativedelta import relativedelta

from .models import Contribution, ContributionStatus
from membership.models import Membership, Discount

from django.contrib.auth import get_user_model
from utils.tasks import  send_email
from event.models import Event
from .tasks import send_email_accept_email

def _create_partner_contribution(original: Contribution, partner: get_user_model()) -> Contribution:
    """
    Creates a mirrored contribution for the partner user,
    swapping user and partner fields.
    """
    with transaction.atomic():
        partner_contribution = Contribution.objects.create(
            user=partner,
            partner=original.user,
            membership=original.membership,
            amount=original.amount,
            start_date=original.start_date,
            end_date=original.end_date,
            original_contribution=original,
            role = original.events.first().event_type.partner_roles.all().exclude(pk=original.role.pk).first(),
            # copia gli altri campi rilevanti
        )
        # link the same events
        partner_contribution.events.set(original.events.all())
    return partner_contribution

def _send_contribution_email(contribution: Contribution)->None:

    if contribution.events.exists():
        if contribution.role:
            if contribution.original_contribution:
                template = "booking_twin_email"
            else:
                template = "booking_email"
        else:
            template = "booking_single_email"
        context = {
                "partner_user": f"{contribution.partner.first_name} {contribution.partner.last_name}" \
                    if contribution.partner else None,
                "event_name": contribution.events.first().name,
                "role": contribution.role.name if contribution.role else None,
            }
        send_email.delay(
            contribution.user.id,
            template=template,
            context=context,
        )

def _contribution_date_range(membership: Membership, event: Event) -> tuple[date | None, date | None]:
    start_date = None
    end_date = None
    if event:
        if membership.duration:
            start_date = max(event.start_date, timezone.now())
            end_date = min(start_date + relativedelta(months=membership.duration),
                                        event.end_date)
        else:
            start_date = max(event.start_date, timezone.now())
            end_date = event.end_date

    return start_date, end_date

def _dispatch_change_status_email(contribution_id: int, user_id: int, old_status: str, new_status: str) -> None:
    if new_status == ContributionStatus.ACCEPTED:
        send_email_accept_email(user_id=user_id, contribution_id=contribution_id)

def _validate_double_registrations(user, event):
    print ("---------- ENTERED VALIDATE REGISTRATIONS ---------")
    print (user)
    print (event)
    print (Contribution.objects.filter(user=user).all())
    return Contribution.objects.filter(user=user,
                                   events=event).exists()

#################################################
######             DISCOUNT RULES           #####
#################################################

def _apply_couple_discount(*contributions: Contribution) -> None:
    """Grant the COUPLE discount to contributions booked as a couple."""
    couple_discount = Discount.objects.filter(name='COUPLE').first()
    if not couple_discount:
        return
    for contribution in contributions:
        contribution.discounts.add(couple_discount)