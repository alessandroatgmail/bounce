import asyncio
import logging
import time

from django.core.management.base import BaseCommand

from notification.kafka_consumer import consume_user_events

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run the Kafka consumer for user events"

    def handle(self, *args, **options):
        self.stdout.write("Starting Kafka consumer...")
        asyncio.run(self._run())

    async def _run(self):
        max_attempts = 10
        delay = 5

        for attempt in range(1, max_attempts + 1):
            try:
                logger.info("Kafka consumer attempt %d/%d", attempt, max_attempts)
                self.stdout.write(f"Connecting to Kafka (attempt {attempt}/{max_attempts})...")
                await consume_user_events()
            except Exception as exc:
                logger.exception("Kafka consumer crashed: %s", exc)
                self.stderr.write(f"Consumer crashed: {exc}")
                if attempt < max_attempts:
                    self.stdout.write(f"Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                else:
                    self.stderr.write("Max attempts reached, giving up.")
                    raise
