from django.db import models
from django.contrib.auth import get_user_model
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

class EventType(models.Model):
    name = models.CharField(max_length=55)
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.SINGLE)
    partners = models.IntegerField()

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

    def __str__(self):
        return f"{self.name} {self.event_type.name}"





