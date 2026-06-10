from django.db import transaction
from .models import Contribution
from django.contrib.auth import get_user_model
from utils.tasks import  send_email

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
