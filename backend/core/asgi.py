# asgi.py
import asyncio
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from .routing import websocket_urlpatterns

django_asgi_app = get_asgi_application()
from notification.kafka_consumer import consume_user_events

async def lifespan(scope, receive, send):
    if scope["type"] == "lifespan":
        await receive()  # wait for startup event
        asyncio.create_task(consume_user_events())
        await send({"type": "lifespan.startup.complete"})
        await receive()  # wait for shutdown event
        await send({"type": "lifespan.shutdown.complete"})

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    "lifespan": lifespan,
})