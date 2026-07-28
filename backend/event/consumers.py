import json
from channels.generic.websocket import AsyncWebsocketConsumer


class EventsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time event updates.
    All connected clients join the shared 'events' group and receive
    a full event payload whenever an event is created or updated.
    """

    GROUP_NAME = "events"

    async def connect(self):
        # Join the shared events group
        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave the group on disconnect
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    # Called when a message arrives from the channel layer (sent by the signal)
    async def event_updated(self, message):
        """
        Forwards the event payload to the WebSocket client.
        The message type must match the method name (dots → underscores).
        """
        await self.send(text_data=json.dumps({
            "type": "event_updated",
            "event": message["event"],
        }))