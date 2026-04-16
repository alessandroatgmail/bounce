from django.db.models.signals import post_save, post_delete
from django.db import transaction

from django.dispatch import receiver
from .models import User
from .tasks import  send_to_kafka, send_activation_email



@receiver(post_save, sender=User)
def on_user_created(sender, instance, created, **kwargs):
    """Fires after a new Subscription is saved."""
    if created:
        transaction.on_commit(lambda: send_to_kafka.delay(
            data={
            "type": "user_registered",
            "email": instance.email,
            "id": instance.id,
        }))
        send_activation_email.delay(instance.id)


