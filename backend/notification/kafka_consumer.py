# notification/kafka_consumer.py
from django.conf import settings

import json
from aiokafka import AIOKafkaConsumer
from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from .models import Notification
from .constants import EventType
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


async def consume_user_events():
    # Initialize the Kafka consumer, connecting to the user.registered topic
    consumer = AIOKafkaConsumer(
        "user.registered",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="notification_group",
        value_deserializer=lambda m: json.loads(m.decode("utf-8"))
    )

    await consumer.start()

    channel_layer = get_channel_layer()

    try:
        # Iterate over incoming Kafka messages indefinitely
        async for message in consumer:
            event_data = message.value  # already deserialized to dict
            logger.info("Received Kafka message: topic=%s offset=%d value=%s",
                        message.topic, message.offset, event_data)
            # Fetch all active admin users from the database
            admins = await sync_to_async(list)(
                User.objects.filter(is_active=True, is_staff=True)
            )

            # Build Notification objects for each admin
            notifications = [
                Notification(
                    event_type=EventType.USER_REGISTERED,
                    payload=event_data,
                    recipient=admin
                )
                for admin in admins
            ]

            # Save all notifications in a single DB query
            await sync_to_async(Notification.objects.bulk_create)(notifications)

            # Broadcast real-time notification to all connected admins
            await channel_layer.group_send(
                "admin_dashboard",
                {
                    "type": "notification.new",
                    "payload": event_data,
                }
            )

    finally:
        # Always stop the consumer cleanly on exit
        await consumer.stop()