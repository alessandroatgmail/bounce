from django.urls import path

from .consumers import EventNotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/', EventNotificationConsumer.as_asgi()),
]