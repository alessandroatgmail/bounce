from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Event          # adjust to your actual model name
from .serializers import EventSerializer  # adjust to your serializer
from django.db import transaction


@receiver(post_save, sender=Event)
def broadcast_event_update(sender, instance, **kwargs):
    """
    Fires after every Event save (create or update).
    Serializes the instance and broadcasts it to the 'events' WS group.

    Uses transaction.on_commit so the broadcast only happens after the
    database transaction is committed — preventing clients from receiving
    a payload before the data is actually readable.
    """

    def _broadcast():
        channel_layer = get_channel_layer()
        serializer = EventSerializer(instance)
        async_to_sync(channel_layer.group_send)(
            "events",
            {
                # type maps to the consumer method: event_updated()
                "type": "event.updated",
                "event": serializer.data,
            },
        )

    # Wrap in on_commit to avoid race conditions
    transaction.on_commit(_broadcast)