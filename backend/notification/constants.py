from django.db import models


class EventType(models.TextChoices):

    USER_REGISTERED = "user_registered", "User Registered"
    USER_DEACTIVATED = "user_deactivated", "User Deactivated"
    USER_ACTIVATED = "user_activated", "User Activated"