from celery import shared_task
from kafka import KafkaProducer
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
import json

producer = None

def get_producer():
    global producer
    if producer is None:
        producer = KafkaProducer(
            bootstrap_servers=["kafka:29092"],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all'  # Ensures all replicas have the message
        )
    return producer

@shared_task(bind=True, max_retries=10)
def send_to_kafka(self, data):
    try:
        p = get_producer()

        future = p.send('user.registered', value=data)
        metadata = future.get(timeout=10)

        return f"Sent to {metadata.topic} at offset {metadata.offset}"

    except Exception as exc:
        # If the broker is down or the send fails, retry the Celery task
        raise self.retry(exc=exc, countdown=10)

@shared_task
def send_activation_email(user_id):
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activation_link = f"http://localhost:5173/activate/{uid}/{token}/"
    send_mail(
        subject="Activate your Bounce account",
        message=(
            f"Hi {user.first_name},\n\n"
            f"Please activate your Bounce by clicking the link below:\n"
            f"{activation_link}"
        ),
        from_email="noreply@boucneswinglovers.com",
        recipient_list=[user.email],
    )


