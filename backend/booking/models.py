from dateutil.relativedelta import relativedelta

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from event.models import Event, PartnerRole
from membership.models import Membership, Discount


class ContributionStatus(models.TextChoices):
    RECEIVED = "received", "Received"
    ACCEPTED = "accepted", "Accepted"
    CONFIRMED = "confirmed", "Confirmed"
    PAYED = "payed", "Payed"
    CANCELLED = "cancelled", "Cancelled"
    WAITING = "waiting", "Waiting"


class Contribution(models.Model):

    status = models.CharField(max_length=20, choices=ContributionStatus.choices, default=ContributionStatus.RECEIVED)
    amount = models.DecimalField(decimal_places=2, max_digits=10)
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    date = models.DateTimeField(default=timezone.now)
    events = models.ManyToManyField(Event, blank=True, related_name='contributions')
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT, null=True, blank=True,
                                   related_name='contributions')
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    upgraded_from = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True)
    role = models.ForeignKey(PartnerRole, on_delete=models.PROTECT, null=True, blank=True)
    partner_email = models.EmailField(null=True, blank=True,)
    partner = models.ForeignKey(get_user_model(), on_delete=models.PROTECT,
                                null=True, blank=True, related_name='partner_contributions')
    level = models.ForeignKey("event.level", on_delete=models.PROTECT, null=True, blank=True)
    original_contribution = models.ForeignKey(
            "self", on_delete=models.PROTECT,
            null=True, blank=True, related_name='twin_contributions'
    )
    discounts = models.ManyToManyField(Discount, blank=True, related_name='contributions')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._previous_status = self.status

    def save(self, *args, **kwargs):

        is_confirmation = (
            self.status == ContributionStatus.CONFIRMED
            and self._previous_status != ContributionStatus.CONFIRMED
        )
        was_accepted_now_cancelled = (
            self._previous_status == ContributionStatus.ACCEPTED
            and self.status == ContributionStatus.CANCELLED
        )
        super().save(*args, **kwargs)

        if is_confirmation:
            from booking.utils import sync_bookings
            sync_bookings(self.user, added_events=list(self.events.all()), removed_events=[])

        if was_accepted_now_cancelled:
            event = self.events.first()
            if event:
                from booking.tasks import notify_next_waiting
                notify_next_waiting.delay(event.id, self.role_id)

        self._previous_status = self.status

    @property
    def discounted_amount(self):
        new_amount = self.amount
        for discount in self.discounts.all():
            if discount.rate:
                new_amount = new_amount * (100 - discount.rate) / 100
            if discount.amount:
                new_amount -= discount.amount
        return new_amount




class Booking(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.PROTECT)