from django.db.models.signals import post_save, post_delete
from django.db import transaction

from django.dispatch import receiver
from .models import Contribution
from utils.tasks import  send_to_kafka, send_email



# @receiver(post_save, sender=Contribution)
# def on_contribution_created(sender, instance, created, **kwargs):
#     """Fires after a new Contribution is saved."""
#     print ("----------------- SIGNALS CONTRIBUTION CREATED -----------")
#     if created:
#         if not instance.original_contribution:
#             """
#             first contribution with no original contribution
#             """
#             # transaction.on_commit(lambda: send_to_kafka.delay(
#             #     type="user.registration",
#             #     data={
#             #     "type": "user_booking",
#             #     "email": instance.user.email,
#             #     "id": instance.id,
#             # }))
#             send_email.delay(
#                 instance.user.id,
#                 template="booking_email",
#                 context={
#                     "partner_user": instance.partner,
#                     "event_name": instance.events.first().name,
#                     "user": instance.user,
#                     "role": instance.role,
#                 }
#             )
#         else:
#             """
#             second contribution with original contribution
#             """
#             # transaction.on_commit(lambda: send_to_kafka.delay(
#             #     type="user.twin_registration",
#             #     data={
#             #         "type": "user_booking",
#             #         "email": instance.user.email,
#             #         "id": instance.id,
#             #     }))
#             send_email.delay(
#                 instance.user.id,
#                 template="booking_twin_email",
#                 context={
#                     "original_user": instance.original_contribution.user,
#                     "event_name": instance.events.first().name,
#                     "user": instance.user,
#                     "role": instance.role,
#                 }
#             )