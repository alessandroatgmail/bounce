import redis
from urllib.parse import parse_qs
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async

User = get_user_model()


def _get_redis_client():
    """
    Creates the Redis client at call time, not at import time.
    This ensures TESTING flag and correct URL are read after
    Django settings are fully configured.
    """
    from django.conf import settings
    url = settings.REDIS_TEST_URL if getattr(settings, "TESTING", False) else settings.REDIS_URL
    return redis.Redis.from_url(url, decode_responses=True)


@database_sync_to_async
def get_user_from_ticket(ticket: str):
    print (f"DEBUG get_user_from_ticket ticket: {ticket}")
    redis_key = f"ws_ticket:{ticket}"
    # Create the client here, at call time
    user_id = _get_redis_client().getdel(redis_key)
    print(f"DEBUG USER ID: {user_id}")
    print (User.objects.all().values("id", "email"))

    if user_id is None:
        return AnonymousUser()

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class WsTicketAuthMiddleware:
    """
    Channels middleware that authenticates WebSocket connections via a
    one-time ticket passed as a query parameter (?ticket=<uuid>).

    Must wrap the URLRouter in asgi.py so it runs on every WS handshake.
    """

    def __init__(self, app):
        # 'app' is the next layer in the Channels middleware stack
        self.app = app

    async def __call__(self, scope, receive, send):
        # This middleware only acts on WebSocket connections
        redis_client = _get_redis_client()
        if scope["type"] == "websocket":
            query_string = scope.get("query_string", b"").decode()
            params = parse_qs(query_string)

            # parse_qs returns lists, e.g. {"ticket": ["abc123"]}
            ticket = params.get("ticket", [None])[0]

            print(f"DEBUG MIDDLEWARE — ticket={ticket}")
            print(f"DEBUG MIDDLEWARE — TESTING={settings.TESTING}")
            print(f"DEBUG MIDDLEWARE — redis_url={redis_client.connection_pool.connection_kwargs}")

            if ticket:

                scope["user"] = await get_user_from_ticket(ticket)
                print ("---------- UTHENTICATE USER -----------")
                print (scope["user"])
            else:
                scope["user"] = AnonymousUser()

        return await self.app(scope, receive, send)