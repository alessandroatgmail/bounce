from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from post_office import mail
import json

from .models import Contribution, ContributionStatus

producer = None


@shared_task
def cancel_expired_contributions() -> None:
    today = timezone.now().date()
    reminder_date = today + timedelta(days=2)
    contributions = (
        Contribution.objects.filter(status=ContributionStatus.ACCEPTED)
        .prefetch_related('events')
        .select_related('user')
    )
    for contribution in contributions:
        event = contribution.events.first()
        if event is None:
            continue
        deadline = contribution.date.date() + timedelta(days=event.payment_days)
        if deadline < today:
            contribution.status = ContributionStatus.CANCELLED
            contribution.save(update_fields=['status'])
            send_contribution_cancelled_email.delay(contribution.user.id, contribution.id)
        elif deadline == reminder_date:
            send_contribution_expiry_reminder_email.delay(contribution.user.id, contribution.id)


@shared_task
def send_contribution_cancelled_email(user_id: int, contribution_id: int) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    contribution = Contribution.objects.get(pk=contribution_id)
    event = contribution.events.first()
    context = {
        "user": user,
        "contribution": contribution,
        "event": event,
    }
    try:
        mail.send(
            user.email,
            template="contribution_cancelled_email",
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template contribution_cancelled_email - {context}")
        print(exc)


@shared_task
def send_contribution_expiry_reminder_email(user_id: int, contribution_id: int) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    contribution = Contribution.objects.get(pk=contribution_id)
    event = contribution.events.first()
    context = {
        "user": user,
        "contribution": contribution,
        "event": event,
    }
    try:
        mail.send(
            user.email,
            template="contribution_expiry_reminder_email",
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template contribution_expiry_reminder_email - {context}")
        print(exc)


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