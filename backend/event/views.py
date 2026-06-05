from datetime import timedelta

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny

from .models import EventType, Location, Room, Style, Genre, ArtistType, Artist, Level, Event, Status, Frequency, PartnerRole
from .serializers import EventTypeSerializer, LocationSerializer, RoomSerializer, StyleSerializer, GenreSerializer, ArtistTypeSerializer, ArtistSerializer, LevelSerializer, EventSerializer, PartnerRoleSerializer
import logging
logger = logging.getLogger('event view')
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)
logger.addHandler(handler)

def _create_recurring_events(original: Event) -> None:
    """
    For weekly event types, generate one child Event per week between
    original.start_date and original.end_date (inclusive, same weekday).
    All children are linked to the original via the events M2M field.
    """
    if original.event_type.frequency != Frequency.WEEKLY:
        return

    duration = timedelta(minutes=original.duration)
    children = []
    current = original.start_date

    while current.date() <= original.end_date.date():
        child = Event.objects.create(
            name=f"{original.name} - {current.strftime('%d/%m/%Y')}",
            status=original.status,
            event_type=original.event_type,
            type=original.type,
            level=original.level,
            room=original.room,
            start_date=current,
            end_date=current + duration,
            duration=original.duration,
            capacity=original.capacity,
            color=original.color,
        )
        child.styles.set(original.styles.all())
        child.genres.set(original.genres.all())
        child.artists.set(original.artists.all())
        children.append(child)
        current += timedelta(weeks=1)

    if children:
        original.events.set(children)


class PartnerRoleViewSet(viewsets.ModelViewSet):
    queryset = PartnerRole.objects.all()
    serializer_class = PartnerRoleSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class EventTypeViewSet(viewsets.ModelViewSet):
    queryset = EventType.objects.all()
    serializer_class = EventTypeSerializer
    permission_classes = [IsAdminUser]


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAdminUser]


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAdminUser]


class StyleViewSet(viewsets.ModelViewSet):
    queryset = Style.objects.all()
    serializer_class = StyleSerializer
    permission_classes = [IsAdminUser]


class GenreViewSet(viewsets.ModelViewSet):
    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = [IsAdminUser]


class ArtistTypeViewSet(viewsets.ModelViewSet):
    queryset = ArtistType.objects.all()
    serializer_class = ArtistTypeSerializer
    permission_classes = [IsAdminUser]


class ArtistViewSet(viewsets.ModelViewSet):
    queryset = Artist.objects.all()
    serializer_class = ArtistSerializer
    permission_classes = [IsAdminUser]


class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    permission_classes = [IsAdminUser]


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Event.objects.all()
        return Event.objects.filter(status=Status.PUBLISHED)

    def perform_create(self, serializer):
        event = serializer.save()
        logger.info(f"Created event {event.name}")

    def perform_update(self, serializer):
        # Capture state before save
        prev_status = serializer.instance.status
        if self.request.method == 'PUT':
            children = list(serializer.instance.events.all())
        else:
            children = []

        instance = serializer.save()

        # Trigger recurring generation when status moves draft → confirmed (only once)
        if prev_status == Status.DRAFT and instance.status == Status.CONFIRMED and not instance.events.exists():
            _create_recurring_events(instance)

        # Cascade field changes to existing children (PUT only)
        if not children:
            return
        for child in children:
            # Each child lives on its own calendar date; only the time-of-day and
            # duration should change, so shift the child by the same offset as the parent.
            day_delta = child.start_date.date() - instance.start_date.date()
            new_start = instance.start_date + timedelta(days=day_delta.days)
            new_end = new_start + timedelta(minutes=instance.duration)

            child.room = instance.room
            child.start_date = new_start
            child.end_date = new_end
            child.duration = instance.duration
            child.color = instance.color
            child.save(update_fields=['room', 'start_date', 'end_date', 'duration', 'color'])
            child.artists.set(instance.artists.all())
            child.styles.set(instance.styles.all())
            child.genres.set(instance.genres.all())
