# core/routing.py
from channels.routing import URLRouter
from django.urls import path

from notification.routing import websocket_urlpatterns as notification_patterns
# in futuro:
# from chat.routing import websocket_urlpatterns as chat_patterns

websocket_urlpatterns = [
    *notification_patterns,
    # *chat_patterns,
]