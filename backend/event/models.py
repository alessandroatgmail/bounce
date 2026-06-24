from django.db import models
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from colorfield.fields import ColorField
from users.models import City

class Status(models.TextChoices):
    DRAFT = "draft", "Draft"
    CONFIRMED = "confirmed", "Confirmed"
    PUBLISHED = "published", "Published"

class Frequency(models.TextChoices):
    SINGLE = "single", "One Shot"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monyhly"

class Type(models.TextChoices):
    FREE = "free", "Free"
    MEMBERS = "members", "Members"
    COLLABORATION = "collaboration", "Collaboration"

class PartnerRole(models.Model):
    name = models.CharField(max_length=55)
    def __str__(self):
        return self.name

class EventType(models.Model):
    name = models.CharField(max_length=55)
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.SINGLE)
    partners = models.IntegerField()
    partner_roles = models.ManyToManyField(PartnerRole, blank=True, null=True)
    party = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Location(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.ForeignKey(City, on_delete=models.PROTECT)

    def __str__(self):
        return f"{self.name} {self.city.name}"

class Room(models.Model):
    name = models.CharField(max_length=255)
    location = models.ForeignKey(Location, on_delete=models.PROTECT)
    capacity = models.IntegerField()

    def __str__(self):
        return f"{self.name} {self.location.name}"

class Style(models.Model):
    name = models.CharField(max_length=255)
    def __str__(self):
        return self.name

class Genre(models.Model):
    name = models.CharField(max_length=255)
    def __str__(self):
        return self.name

class ArtistType(models.Model):
    name = models.CharField(max_length=255)
    def __str__(self):
        return self.name

class Artist(models.Model):
    user = models.ForeignKey(get_user_model(), blank=True, null=True, on_delete=models.PROTECT)
    first_name = models.CharField(max_length=255, blank=True, null=True,)
    last_name = models.CharField(max_length=255, blank=True, null=True,)
    types = models.ManyToManyField(ArtistType)
    styles = models.ManyToManyField(Style)
    genres = models.ManyToManyField(Genre)

    def __str__(self):
        if self.user:
            return f"{self.user.first_name} {self.user.last_name}"
        else:
            return f"{self.first_name} {self.last_name}"

class Level(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Event(models.Model):
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    name = models.CharField(max_length=100)
    event_type = models.ForeignKey(EventType, on_delete=models.PROTECT)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.MEMBERS)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    duration = models.IntegerField(verbose_name="Duration (Mins)")
    room = models.ForeignKey(Room, on_delete=models.PROTECT)
    capacity = models.IntegerField(verbose_name="Capacity")
    events = models.ManyToManyField("self", symmetrical=False, blank=True)
    styles = models.ManyToManyField(Style,)
    genres = models.ManyToManyField(Genre,)
    artists = models.ManyToManyField(Artist,)
    level = models.ForeignKey(Level, on_delete=models.PROTECT, null=True)
    info = models.TextField(blank=True, null=True)
    color = ColorField(format="hex", null=True, blank=True)
    image = models.ImageField(upload_to="events/", blank=True, null=True)
    payment_days = models.IntegerField(verbose_name="Giorni per pagare", default=7)
    payment_days_waiting = models.IntegerField(verbose_name="Giorni per pagare rientrati dalla waiting list", default=1)
    accepted_roles = models.ManyToManyField(PartnerRole, blank=True, null=True)
    warning_threshold = models.IntegerField(verbose_name="Warning Threshold", default=5)
    extras = models.IntegerField(default=0)
    multi_events = models.BooleanField(default=False)
    free = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} {self.event_type.name}"

    @property
    def effective_image(self):
        if self.image:
            return self.image
        parent = self.event_set.first()
        if parent and parent.image:
            return parent.image
        return None

    @property
    def available_spot(self):
        from booking.models import ContributionStatus as CS

        return self.capacity - self.contributions.filter(status=CS.PAYED).count()

    @property
    def spot_booked(self):
        from booking.models import ContributionStatus as CS

        return self.contributions.filter(status=CS.RECEIVED).count()

    @property
    def spot_accepted(self):
        from booking.models import ContributionStatus as CS

        return self.contributions.filter(status=CS.ACCEPTED).count()

    @property
    def role_count(self):
        from booking.models import ContributionStatus as CS
        from collections import Counter
        print ("---------- entered in role count ----------")
        roles = list(self.contributions.filter(status=CS.ACCEPTED).values("role__name"))
        print (roles)

        roles = dict(Counter([r["role__name"] for r in roles]))
        print (roles)

        for role in self.event_type.partner_roles.all():
            if role.name not in roles:
                roles[role.name] = 0
        return roles

