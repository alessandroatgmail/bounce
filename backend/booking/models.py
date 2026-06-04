from dateutil.relativedelta import relativedelta

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from event.models import Event
from membership.models import Membership

class ContributionStatus(models.TextChoices):
    RECEIVED = "received", "Received"
    ACCEPTED = "accepted", "Accepted"
    CONFIRMED = "confirmed", "Confirmed"
    PAYED = "payed", "Payed"


class Contribution(models.Model):

    status = models.CharField(max_length=20, choices=ContributionStatus.choices, default=ContributionStatus.RECEIVED)
    amount = models.DecimalField(decimal_places=2, max_digits=10)
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    events = models.ManyToManyField(Event, blank=True, related_name='contributions')
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT, null=True, blank=True,
                                   related_name='contributions')
    start_date = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    upgraded_from = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._previous_status = self.status

    def save(self, *args, **kwargs):

        is_confirmation = (
            self.status == ContributionStatus.CONFIRMED
            and self._previous_status != ContributionStatus.CONFIRMED
        )
        super().save(*args, **kwargs)

        if is_confirmation:
            from booking.utils import sync_bookings
            sync_bookings(self.user, added_events=list(self.events.all()), removed_events=[])
        self._previous_status = self.status



class Booking(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.PROTECT)
