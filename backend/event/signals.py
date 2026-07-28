from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Event
from .serializers import EventSerializer
from django.db import transaction


@receiver(pre_save, sender=Event)
def track_event_type_change(sender, instance, **kwargs):
    """Mark whether event_type changed so post_save can sync accepted_roles."""
    if instance.pk:
        try:
            old_type_id = Event.objects.only('event_type_id').get(pk=instance.pk).event_type_id
            instance._event_type_changed = old_type_id != instance.event_type_id
        except Event.DoesNotExist:
            instance._event_type_changed = True
    else:
        instance._event_type_changed = True  # new instance: always sync


@receiver(post_save, sender=Event)
def sync_accepted_roles(sender, instance, created, **kwargs):
    """Auto-populate accepted_roles from event_type.partner_roles on create or event_type change."""
    if created or getattr(instance, '_event_type_changed', False):
        instance.accepted_roles.set(instance.event_type.partner_roles.all())


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