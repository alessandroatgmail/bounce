from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Min, Q
from django.utils import timezone
from post_office import mail
import json
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

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
    logger.info(f"Found {contributions.count()} ACCEPTED contributions, today={today}")
    for contribution in contributions:
        event = contribution.events.first()
        if event is None:
            continue
        deadline = contribution.date.date() + timedelta(days=event.payment_days)
        logger.info(f"Contribution {contribution.id}: deadline={deadline}, today={today}, reminder_date={reminder_date}")
        if deadline < today:
            contribution.status = ContributionStatus.CANCELLED
            contribution.save(update_fields=['status'])
            send_contribution_cancelled_email.delay(contribution.user.id, contribution.id)
        elif deadline == reminder_date:
            send_contribution_expiry_reminder_email.delay(contribution.user.id, contribution.id)


@shared_task
def consolidate_event_register(event_id: int) -> None:
    """Replicate a parent event's bookings onto all its children: their
    previous bookings are deleted and recreated from the parent's."""
    from event.models import Event
    from booking.register import consolidate_register

    event = Event.objects.get(pk=event_id)
    created, deleted = consolidate_register(event)
    logger.info(
        f"Consolidated register for event {event_id}: "
        f"{created} bookings created, {deleted} deleted"
    )


@shared_task
def consolidate_upcoming_parent_events() -> None:
    """
    Select every parent event (one that is not a child of another event)
    starting within the next settings.CONSOLIDATE_TIME_HR hours and
    consolidate its register — parent data replicated onto all its
    children. Runs from Celery beat; consolidation is idempotent, so
    being called repeatedly while an event sits inside the window is
    harmless.
    """
    from event.models import Event

    now = timezone.now()
    window = timedelta(hours=settings.CONSOLIDATE_TIME_HR)
    child_ids = Event.events.through.objects.values('to_event_id')
    event_ids = (
        Event.objects
        .filter(start_date__gt=now, start_date__lte=now + window)
        .exclude(pk__in=child_ids)
        .values_list('id', flat=True)
    )
    for event_id in event_ids:
        consolidate_event_register.delay(event_id)


@shared_task
def send_contribution_cancelled_email(user_id: int, contribution_id: int) -> None:
    print ("Celery Task started")
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
    print("Celery Task ended")

@shared_task
def send_contribution_expiry_reminder_email(user_id: int, contribution_id: int) -> None:
    print("Celery Task reminder started")
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    contribution = Contribution.objects.get(pk=contribution_id)
    event = contribution.events.first()
    deadline = contribution.date.date() + timedelta(days=event.payment_days)
    context = {
        "user": user,
        "contribution": contribution,
        "event": event,
        "deadline": deadline,
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
    print("Celery Task reminder ended")

@shared_task
def send_waiting_list_for_role_email(user_id: int, contribution_id: int) -> None:
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
            template="waiting_list_for_role",
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template waiting_list_for_role - {context}")
        print(exc)


@shared_task
def send_waiting_list_max_email(user_id: int, contribution_id: int) -> None:
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
            template="waiting_list_max",
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template waiting_list_max - {context}")
        print(exc)


@shared_task
def notify_next_waiting(event_id: int, role_id: int = None) -> None:
    from event.models import Event

    event = Event.objects.select_related('event_type').get(pk=event_id)

    if event.multi_events and not event.free:
        # Contributions link only to the festival, not to the specific
        # child class, so there's no way to tell here which level's spot
        # actually freed up. Leave waiting students waiting; they rebook
        # once the level is open again, instead of being silently
        # promoted into a class/role that may still be full.
        return

    if event.available_spot < 1:
        return

    lower_role_id = None
    role_imbalance = False

    if event.event_type.partners > 1:
        role_counts = event.event_type.partner_roles.annotate(
            count=Count(
                'contribution',
                filter=Q(
                    contribution__events=event,
                    contribution__status__in=[ContributionStatus.ACCEPTED, ContributionStatus.PAYED],
                ),
                distinct=True,
            )
        )
        lower_count = role_counts.aggregate(min_count=Min('count'))['min_count'] or 0
        if role_counts.filter(count__gte=lower_count + event.extras).exists():
            role_imbalance = True
            lower_role_id = role_counts.order_by('count').values_list('id', flat=True).first()

    if role_imbalance and lower_role_id is not None:
        waiting = (
            Contribution.objects.filter(
                events=event,
                status=ContributionStatus.WAITING,
                role_id=lower_role_id,
            )
            .order_by('date')
            .select_related('user')
            .first()
        )
    else:
        waiting = (
            Contribution.objects.filter(events=event, status=ContributionStatus.WAITING)
            .order_by('date')
            .select_related('user')
            .first()
        )

    if waiting:
        waiting.status = ContributionStatus.ACCEPTED
        waiting.save(update_fields=['status'])
        if event.multi_events and waiting.level_id:
            children = event.events.filter(
                Q(level=waiting.level) | Q(event_type__party=True)
            )
            waiting.events.add(*children)
        send_spot_available_email.delay(waiting.user.id, waiting.id)


@shared_task
def promote_waiting_for_level(festival_event_id: int, level_id: int) -> None:
    """A booking or cancellation that changes a festival level's occupancy
    (capacity freed, or the leader/follower balance shifted) may make
    room for students already WAITING there — recheck every WAITING
    contribution at that level, oldest first, and promote whoever now
    clears booking.service.waiting_list, the same eligibility check a
    fresh booking goes through. Freed room may only help one role's
    imbalance, not both, so every waiting contribution gets its own
    check rather than assuming which role benefits.

    Unlike notify_next_waiting (which only runs on cancellation and
    explicitly skips festivals, since it can't tell which level's spot
    freed up), this is unambiguous: the caller always knows the level.
    """
    from event.models import Event
    from .service import waiting_list

    festival_event = Event.objects.get(pk=festival_event_id)

    for waiting in Contribution.objects.filter(
        events=festival_event, level_id=level_id, status=ContributionStatus.WAITING,
    ).order_by('date'):
        waiting.refresh_from_db()
        if waiting.status != ContributionStatus.WAITING or waiting_list(waiting):
            continue

        waiting.status = ContributionStatus.ACCEPTED
        waiting.save(update_fields=['status'])
        partner = waiting.twin_contributions.first() or waiting.original_contribution
        if partner and partner.status == ContributionStatus.WAITING:
            partner.status = ContributionStatus.ACCEPTED
            partner.save(update_fields=['status'])
        send_spot_available_email.delay(waiting.user.id, waiting.id)


@shared_task
def send_spot_available_email(user_id: int, contribution_id: int) -> None:
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
            template="spot_available_email",
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template spot_available_email - {context}")
        print(exc)


def _send_templated_email(user, template, context):
    try:
        mail.send(
            user.email,
            template=template,
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print(f"email failed user {user.email} - template {template} - {context}")
        print(exc)


@shared_task
def send_bulk_emails(user_ids: list, template: str, event_id: int = None, membership_id: int = None) -> None:
    """Admin-triggered bulk send from the Packs management screen.

    - event_id given: a user may hold several contributions, so the event
      is what pins down which one this email is about — one send per
      matching Contribution (a user with two contributions for that event
      gets two emails). membership_id, if also given, narrows those
      contributions further rather than changing the per-user branch below.
    - event_id absent: there's no contribution to pin down, so it's one
      send per user; membership_id (if given) is only there to be quoted
      in the email, not to look up a specific contribution.
    """
    from membership.models import Membership

    if event_id:
        contributions = (
            Contribution.objects
            .filter(user_id__in=user_ids, events=event_id)
            .select_related('user', 'membership')
            .prefetch_related('events')
        )
        if membership_id:
            contributions = contributions.filter(membership_id=membership_id)

        for contribution in contributions:
            context = {"user": contribution.user, "contribution": contribution}
            event = contribution.events.filter(id=event_id).first()
            if event:
                context["event"] = event
            if contribution.membership:
                context["membership"] = contribution.membership
            _send_templated_email(contribution.user, template, context)
    else:
        membership = Membership.objects.filter(id=membership_id).first() if membership_id else None
        users = get_user_model().objects.filter(id__in=user_ids)
        for user in users:
            context = {"user": user}
            if membership:
                context["membership"] = membership
            _send_templated_email(user, template, context)


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