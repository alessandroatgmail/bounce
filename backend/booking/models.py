from dateutil.relativedelta import relativedelta

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from event.models import Event
from membership.models import Membership

class Contribution(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=10)
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    events = models.ManyToManyField(Event, blank=True, related_name='contributions')
    membership = models.ForeignKey(Membership, on_delete=models.PROTECT, null=True, blank=True,
                                   related_name='contributions')
    start_date = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)



class Booking(models.Model):
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.PROTECT)
