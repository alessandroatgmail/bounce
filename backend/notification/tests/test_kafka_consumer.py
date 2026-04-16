"""
Tests for the notification creation logic triggered by Kafka user.registered events.

We don't spin up a real Kafka broker. Instead we call process_event_sync() from
conftest, which replicates exactly what consume_user_events() does when it receives
a message. These are plain sync tests — no async needed here.
"""
import pytest

from notification.constants import EventType
from notification.models import Notification
from notification import kafka_consumer
from users import tasks
from users.models import User
from .conftest import process_event_sync

SAMPLE_EVENT = {"type": "user_registered", "email": "newuser@example.com", "id": 99}


class TestKafkaConsumerNotificationCreation:

    def test_one_notification_created_per_admin(self, db, admin_user, second_admin):
        process_event_sync(SAMPLE_EVENT)
        assert Notification.objects.count() == 2

    def test_regular_users_do_not_receive_notifications(self, db, admin_user, regular_user):
        process_event_sync(SAMPLE_EVENT)
        assert not Notification.objects.filter(recipient=regular_user).exists()

    def test_notification_payload_matches_kafka_event(self, db, admin_user):
        process_event_sync(SAMPLE_EVENT)
        notification = Notification.objects.get(recipient=admin_user)
        assert notification.payload == SAMPLE_EVENT

    def test_notification_event_type_is_user_registered(self, db, admin_user):
        process_event_sync(SAMPLE_EVENT)
        notification = Notification.objects.get(recipient=admin_user)
        assert notification.event_type == EventType.USER_REGISTERED

    def test_notification_is_unread_by_default(self, db, admin_user):
        process_event_sync(SAMPLE_EVENT)
        notification = Notification.objects.get(recipient=admin_user)
        assert notification.is_read is False

    def test_no_notifications_when_no_admins_exist(self, db, regular_user):
        process_event_sync(SAMPLE_EVENT)
        assert Notification.objects.count() == 0

    def test_consumer_and_producer_use_same_bootstrap_server(self):
        """
        The Kafka consumer and producer must connect to the same broker address.
        A mismatch (e.g. 9092 vs 29092) causes messages to be produced to a
        broker the consumer never reads from, silently dropping notifications.
        Reads source files directly to avoid interference from autouse mocks.
        """
        import re
        import inspect
        import pathlib

        # Resolve paths from the module file attributes — immune to mocking
        consumer_path = pathlib.Path(inspect.getfile(kafka_consumer))
        producer_path = pathlib.Path(inspect.getfile(tasks))

        consumer_source = consumer_path.read_text()
        producer_source = producer_path.read_text()

        consumer_servers = re.findall(r'bootstrap_servers\s*=\s*["\']([^"\']+)["\']', consumer_source)
        producer_servers = re.findall(r'"([^"]+)"', re.search(r'bootstrap_servers\s*=\s*\[([^\]]+)\]', producer_source).group(1))

        assert consumer_servers, "Could not find bootstrap_servers in kafka_consumer.py"
        assert producer_servers, "Could not find bootstrap_servers in tasks.py"
        assert consumer_servers[0] == producer_servers[0], (
            f"Bootstrap server mismatch: consumer={consumer_servers[0]!r}, producer={producer_servers[0]!r}"
        )

    def test_inactive_admin_does_not_receive_notification(self, db):
        User.objects.create_user(
            email="inactive_admin@bounce.test",
            password="Pass123!",
            is_staff=True,
            is_active=False,
        )
        process_event_sync(SAMPLE_EVENT)
        assert Notification.objects.count() == 0
