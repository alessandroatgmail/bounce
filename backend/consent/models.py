from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from event.models import Event
from membership.models import Membership
from booking.models import Contribution, ExtraItem


class Communication(models.Model):
    """
    Definition of a consent/notice a student must see and agree to (e.g. "I
    understand I might lose this room if my roommate doesn't confirm").
    Reusable across several targets at once — e.g. one row can cover every
    accommodation ExtraItem for a given festival instead of needing one row
    per item. No target at all means it applies generically (e.g. a privacy
    policy, not tied to any specific Event/ExtraItem/Membership).
    """
    events = models.ManyToManyField(Event, blank=True, related_name='communications')
    extra_items = models.ManyToManyField(ExtraItem, blank=True, related_name='communications')
    plans = models.ManyToManyField(Membership, blank=True, related_name='communications')
    title = models.CharField(max_length=255)
    title_it = models.CharField(max_length=255)
    title_en = models.CharField(max_length=255)
    desc = models.TextField()
    desc_it = models.TextField()
    desc_en = models.TextField()
    # If true, a user must re-confirm this communication every time its
    # target becomes relevant again (e.g. every new booking of one of its
    # extra_items), not just once ever.
    recurrent = models.BooleanField(default=False)

    def __str__(self):
        return self.title


class Consent(models.Model):
    """
    Records that a user has seen and agreed to a Communication at a given
    moment — optionally tied to the Contribution it was asked for (null when
    the communication isn't about a specific booking, e.g. a privacy
    policy). desc_it_signed/desc_en_signed freeze the exact wording the user
    actually saw and agreed to at signing time: editable=False so nothing
    can alter them afterwards, even if the Communication's own text is
    later edited — this is the legal record of what was signed, not a
    live copy of the Communication.
    """
    communication = models.ForeignKey(Communication, on_delete=models.CASCADE, related_name='consents')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='consents')
    contribution = models.ForeignKey(
        Contribution, on_delete=models.CASCADE, null=True, blank=True, related_name='consents',
    )
    date = models.DateTimeField(auto_now_add=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    desc_it_signed = models.TextField(editable=False)
    desc_en_signed = models.TextField(editable=False)

    def save(self, *args, **kwargs):
        if not self.expiration_date:
            self.expiration_date = timezone.now() + relativedelta(years=1)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} - {self.communication} ({self.date:%Y-%m-%d})"
