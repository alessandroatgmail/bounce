from celery import shared_task
from kafka import KafkaProducer
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from post_office import mail
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
def send_to_kafka(self, type: str, data: dict) -> None:
    try:
        p = get_producer()

        future = p.send(type, value=data)
        metadata = future.get(timeout=10)

        return f"Sent to {metadata.topic} at offset {metadata.offset}"

    except Exception as exc:
        # If the broker is down or the send fails, retry the Celery task
        raise self.retry(exc=exc, countdown=10)

@shared_task
def send_activation_email(user_id: int, template: str,) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activation_link = f"http://localhost:5173/activate/{uid}/{token}/"
    mail.send(
        user.email,
        template=template,
        context={
            'first_name': user.first_name,
            'activation_link': activation_link,
        },
        language=user.language,
    )

@shared_task
def send_password_reset_email(user_id: int) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_link = f"{frontend_url}/reset-password/{uid}/{token}/"
    mail.send(
        user.email,
        template='password_reset_email',
        context={
            'first_name': user.first_name,
            'reset_link': reset_link,
        },
        language=user.language,
    )


@shared_task
def send_email(user_id: int, template: str, context) -> None:
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    try:
        mail.send(
            user.email,
            template=template,
            context=context,
            language=user.language,
        )
    except Exception as exc:
        print (f"email  failed user {user.email} - template {template} - {context}")
        print (exc)