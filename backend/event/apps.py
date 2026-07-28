from django.apps import AppConfig

class EventsConfig(AppConfig):
    name = "event"

    def ready(self):
        import event.signals  # noqa