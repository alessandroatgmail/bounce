from datetime import timedelta

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import EventType, Location, Room, Style, Genre, ArtistType, Artist, Level, Event, Status, Frequency
from .serializers import EventTypeSerializer, LocationSerializer, RoomSerializer, StyleSerializer, GenreSerializer, ArtistTypeSerializer, ArtistSerializer, LevelSerializer, EventSerializer
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

        )
        child.styles.set(original.styles.all())
        child.genres.set(original.genres.all())
        child.artists.set(original.artists.all())
        children.append(child)
        current += timedelta(weeks=1)

    if children:
        original.events.set(children)


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
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Event.objects.all()
        return Event.objects.filter(status=Status.PUBLISHED)

    def perform_create(self, serializer):
        event = serializer.save()
        logger.info(f"Created event {event.name}")
        _create_recurring_events(event)
