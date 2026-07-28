from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async


class EventNotificationConsumer(AsyncJsonWebsocketConsumer):
    """

    """

    async def connect(self):
        self.group_name = None
        if not self.scope["user"].is_authenticated:
            await self.close()
            return

        self.group_name = f"admin_dashboard"

        # Join the group for this specific event
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current seat availability immediately on connect,
        # so the user doesn't have to wait for the next update
        notifications = await self.get_new_notifications()
        await self.send_json(
            [{
                "event_type": notification.event_type,
                "recipient": notification.recipient.email,
                "payload": notification.payload,
                "date": notification.created_at.isoformat()
              }
             for notification in notifications]
        )

    async def disconnect(self, close_code):
        # Leave the group when the connection closes
        if self.group_name is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)


    @database_sync_to_async
    def get_new_notifications(self):
        """
        Fetch unread notifications for the connected user.
        select_related('recipient') avoids a lazy FK load in the async connect()
        method, which would raise SynchronousOnlyOperation.
        """
        from .models import Notification

        return list(
            Notification.objects
            .filter(recipient=self.scope["user"], read_at__isnull=True)
            .select_related("recipient")
        )

    async def notification_new(self, event):
        """
        Receives broadcast from Kafka consumer and forwards it to the WebSocket client.
        event contains the data sent via group_send.
        """
        await self.send_json(event["payload"])
