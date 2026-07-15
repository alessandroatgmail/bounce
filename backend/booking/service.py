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

def create_partner_contributions_for_user(user) -> list[Contribution]:
    """
    Activation hook: mirror onto a freshly activated user every
    contribution that named their email as partner while they had no
    account yet.

    Each mirrored contribution carries the booker as partner, the
    opposite role, the same events/membership and the booker's status —
    except payed, which maps to accepted (the new partner still has to
    pay). Cancelled contributions are ignored. Contributions that
    already have a partner or a twin are skipped, so the hook is
    idempotent.
    """
    originals = (
        Contribution.objects
        .filter(partner_email__iexact=user.email, partner__isnull=True)
        .exclude(status=ContributionStatus.CANCELLED)
        .filter(twin_contributions__isnull=True)
        .select_related("role")
    )
    mirrored = []
    for original in originals:
        if original.role_id is None or not original.events.exists():
            continue
        contribution = _create_partner_contribution(original, user)
        contribution.status = (
            ContributionStatus.ACCEPTED
            if original.status == ContributionStatus.PAYED
            else original.status
        )
        contribution.save(update_fields=["status"])
        mirrored.append(contribution)

    if mirrored:
        from django.conf import settings
        event_names = []
        for contribution in mirrored:
            for event in contribution.events.all():
                if event.name not in event_names:
                    event_names.append(event.name)
        send_email.delay(
            user.id,
            template='partner_events_booked_email',
            context={
                'first_name': user.first_name,
                'events': event_names,
                'url': settings.FRONTEND_URL + '/student',
            },
        )
    return mirrored


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
        send_email_accept_email.delay(user_id=user_id, contribution_id=contribution_id)

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

#################################################
######             STATUS RULES             #####
#################################################


def waiting_list(contribution: Contribution) -> bool:
    from booking.tasks import send_waiting_list_for_role_email, send_waiting_list_max_email
    partner_contribution = contribution.twin_contributions.first()
    print ("------------ WAITING LIST +----------")
    print (contribution.events.exists())
    if contribution.events.exists():
        if not _check_max_capacity(contribution):
            print (f" Check Max capacity for {contribution.user.email}: {_check_max_capacity}")
            send_waiting_list_max_email.delay(contribution.user.id, contribution.id)
            if partner_contribution:
                send_waiting_list_max_email.delay(partner_contribution.user.id, partner_contribution.id)
            return True
        if _check_need_role(contribution):
            print(f" Check need role for {contribution.user.email}: {_check_need_role}")
            if not _check_role_accepted(contribution):
                print(f" Check need role accepted for {contribution.user.email}: {_check_role_accepted}")
                send_waiting_list_for_role_email.delay(contribution.user.id, contribution.id)
                if partner_contribution:
                    send_waiting_list_for_role_email.delay(partner_contribution.user.id, partner_contribution.id)
                return True


            if not _check_extras(contribution):
                print(f" Check extras for {contribution.user.email}: {_check_extras}")

                send_waiting_list_for_role_email.delay(contribution.user.id, contribution.id)
                if partner_contribution:
                    send_waiting_list_for_role_email.delay(partner_contribution.user.id, partner_contribution.id)
                return True
            # elif contribution.events.first().multi_events and contribution.events.first().free:
            #     # check waiting list if festival and free
            #     pass
            else:
                # check waiting list for normal regular class

                pass
    return False

def _check_need_role(contribution: Contribution) -> bool:
    event = contribution.events.first()
    if event.multi_events and not event.free:
        event = event.events.filter(level=contribution.level).first()
    if event:
        if event.event_type.partner_roles.count() > 0:
            return True
    return False

def _check_role_accepted(contribution: Contribution) -> bool:
    event = contribution.events.first()
    if event.multi_events and not event.free:
        event = event.events.filter(level=contribution.level).first()
    if event:
        if event.event_type.partner_roles.all().exists():
            if contribution.role:
                if event.multi_events and not event.free:
                    if contribution.role not in event.events.filter(level=contribution.level).first().accepted_roles:
                        return False
                if contribution.role not in event.accepted_roles.all():
                    return False
    return True

def _check_max_capacity(contribution: Contribution) -> bool:

    if contribution.events.exists():
        event = contribution.events.first()
        if event.available_spot:
            return True
        if event.multi_events and not event.free:
            event = event.events.filter(level=contribution.level).first()
            if event.available_spot:
                return True
    return False

def _check_extras(contribution: Contribution) -> bool:
    """
    Check if under extra role
    """
    if contribution.events.first():
        event=contribution.events.first()
        if not contribution.role:
            return True
        if not event.multi_events:
            event = contribution.events.first()
        elif event.multi_events and not event.free:
            event = event.events.first().events.filter(levels=contribution.level).first()
        elif event.multi_events and event.free:
            event = event.events.first()
        else:
            event=None

        roles = event.role_count
        print (" ------------- EXTRAS ----------")
        print (roles)
        print (contribution.role.name)
        print (Contribution.objects.filter(events=event).count())
        print(Contribution.objects.filter(events=event).values("user__email", "role__name", "status"))
        if contribution.role.name not in roles.keys():

            print ("----------- role not in roles -------")
            print (roles.keys())
            return True
        else:
            min_key = min(roles, key=roles.get)
            max_key = max(roles, key=roles.get)
            # if min_key == max_key:
            print (min_key)
            if contribution.role.name == min_key:
                return True
            else:
                if roles[max_key] <= roles[min_key] + event.extras:
                    return True
    return False






