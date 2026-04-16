import asyncio
import logging
import os

logger = logging.getLogger(__name__)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from .routing import websocket_urlpatterns

django_asgi_app = get_asgi_application()
from notification.kafka_consumer import consume_user_events


async def _run_consumer():
    """Wrapper so crashes in consume_user_events appear in the logs."""
    try:
        logger.info("Kafka consumer starting...")
        await consume_user_events()
        logger.warning("Kafka consumer exited without error")
    except Exception:
        logger.exception("Kafka consumer crashed")


async def lifespan(scope, receive, send):
    if scope["type"] == "lifespan":
        await receive()  # startup event
        asyncio.create_task(_run_consumer())
        logger.info("Lifespan startup complete")
        await send({"type": "lifespan.startup.complete"})
        await receive()  # shutdown event
        await send({"type": "lifespan.shutdown.complete"})


application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    "lifespan": lifespan,
})