from .models import Contribution
from django.contrib.auth import get_user_model

def _create_partner_contribution(original: Contribution, partner: get_user_model()) -> Contribution:
    """
    Creates a mirrored contribution for the partner user,
    swapping user and partner fields.
    """
    partner_contribution = Contribution.objects.create(
        user=partner,
        partner=original.user,
        membership=original.membership,
        amount=original.amount,
        start_date=original.start_date,
        end_date=original.end_date,
        # copia gli altri campi rilevanti
    )
    # link the same events
    partner_contribution.events.set(original.events.all())
    return partner_contribution