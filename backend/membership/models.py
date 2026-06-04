from django.db import models
from colorfield.fields import ColorField
from event.models import EventType

class MembershipType(models.TextChoices):
    SINGLE = "single", "Single"
    MONTHLY = "monthly", "Monthly"
    QUARTER = "quarter", "Quarter"
    YEAR = "year", "Year"

class Membership(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=MembershipType.choices, default=MembershipType.SINGLE)
    contribution = models.IntegerField(default=0)
    color = ColorField(format="hex", null=True, blank=True)
    max_events = models.IntegerField(default=1, null=True, blank=True)
    duration = models.IntegerField(default=0, verbose_name="duration (months)")

    class Meta:
        verbose_name = "Pack"
        verbose_name_plural = "Packs"

    def __str__(self):
        return self.name


class MembershipRule(models.Model):
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT)
    event_type = models.ForeignKey(EventType, on_delete=models.PROTECT)
    max_events = models.IntegerField(default=1)

