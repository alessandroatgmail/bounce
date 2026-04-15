from django.db import models
from .constants import EventType
from users.models import User

class Notification(models.Model):
    event_type = models.CharField(max_length=100)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE,
                                  related_name='notifications')
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_read(self):
        """Returns True if the notification has been read."""
        return self.read_at is not None