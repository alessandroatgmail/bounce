from django.db import models
from django.contrib.auth import get_user_model
from event.models import Event
from membership.models import Memebership

class Contribution(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=10)
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.PROTECT, null=True, blank=True)
    events = models.ManyToManyField(Event, blank=True)
    Memebership = models.ForeignKey(Memebership, on_delete=models.PROTECT, null=True, blank=True)


class Booking(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.PROTECT)
