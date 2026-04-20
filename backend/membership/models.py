from django.db import models
from colorfield.fields import ColorField
from event.models import Event

class MembershipType(models.TextChoices):
    SINGLE = "single", "Single"
    MONTHLY = "monthly", "Monthly"
    QUARTER = "quarter", "Quarter"
    YEAR = "year", "Year"

class Membership(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=MembershipType.choices, default=MembershipType.SINGLE)
    contribution = models.IntegerField(default=0)
    max_courses = models.IntegerField(default=0)
    max_parties = models.IntegerField(default=0)
    color = ColorField(format="hex", null=True, blank=True)
    events = models.ManyToManyField(Event, blank=True)

    def __str__(self):
        return self.name


