from celery import shared_task
from django.contrib.auth import get_user_model
from .models import Contribution
from post_office import mail
import json

producer = None


@shared_task
def send_email_accept_email(user_id: int, contribution_id: int) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    contribution = Contribution.objects.get(pk=contribution_id)
    if contribution.partner:
        template = "registration_accepted_with_partner_email"
    else:
        template = "registration_accepted_email"

    context = {
        "user": user,
        "contribution": contribution,
        "event": contribution.events.first(),
    }
    try:
        mail.send(
            user.email,
            template=template,
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print (f"email  failed user {user.email} - template registration_accepted_email - {context}")
        print (exc)