from django.db import models
from django.db.models import Q
from django.utils import timezone
from colorfield.fields import ColorField
from event.models import EventType, Event

class MembershipType(models.TextChoices):
    SINGLE = "single", "Single"
    MONTHLY = "monthly", "Monthly"
    QUARTER = "quarter", "Quarter"
    YEAR = "year", "Year"


def available_memberships(qs):
    """
    Restrict qs to memberships whose booking window covers now.
    Student-facing only: staff keep seeing (and assigning) old memberships.
    """
    now = timezone.now()
    return qs.filter(
        Q(start_date__isnull=True) | Q(start_date__lte=now),
        Q(end_date__isnull=True) | Q(end_date__gte=now),
    )


class Membership(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=MembershipType.choices, default=MembershipType.SINGLE)
    contribution = models.IntegerField(default=0)
    color = ColorField(format="hex", null=True, blank=True)
    max_events = models.IntegerField(default=1, null=True, blank=True)
    duration = models.IntegerField(default=0, verbose_name="duration (months)")
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Pack"
        verbose_name_plural = "Packs"

    def __str__(self):
        return self.name

    @property
    def is_available(self):
        """True when now falls inside the booking window (null bounds are open)."""
        now = timezone.now()
        if self.start_date and self.start_date > now:
            return False
        if self.end_date and self.end_date < now:
            return False
        return True


class MembershipRule(models.Model):
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT)
    event_type = models.ForeignKey(EventType, on_delete=models.PROTECT)
    max_events = models.IntegerField(default=1)


class Discount(models.Model):
    name = models.CharField(max_length=10)
    name_ext = models.CharField(max_length=100)
    description = models.TextField()
    rate = models.IntegerField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

