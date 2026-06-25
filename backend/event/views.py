from datetime import timedelta

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from .paginations import EventPagination
from .filters import EventFilter

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

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]


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

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    pagination_class = EventPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = EventFilter

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = Event.objects.all() if self.request.user.is_staff else Event.objects.filter(status=Status.PUBLISHED)
        return qs.order_by('start_date')

    def perform_create(self, serializer):
        event = serializer.save()
        logger.info(f"Created event {event.name}")

    def perform_destroy(self, instance):
        from booking.models import Contribution, Booking
        from rest_framework.exceptions import ValidationError

        child_ids = list(instance.events.values_list('id', flat=True))
        all_ids = [instance.pk] + child_ids

        has_registrations = (
            Contribution.objects.filter(events__in=all_ids).exists()
            or Booking.objects.filter(event_id__in=all_ids).exists()
        )
        if has_registrations:
            raise ValidationError({"detail": "Cannot delete an event with existing registrations."})

        instance.events.all().delete()
        instance.delete()

    def perform_update(self, serializer):
        prev_status = serializer.instance.status

        # For non-multi PUT, capture children before the save so we can cascade
        if self.request.method == 'PUT' and not serializer.instance.multi_events:
            children = list(serializer.instance.events.all())
        else:
            children = []

        instance = serializer.save()

        # multi_events parent: cascade status only when it changed
        if instance.multi_events:
            if instance.status != prev_status:
                instance.events.all().update(status=instance.status)
            return

        # Non-multi: trigger recurring generation on draft → confirmed
        if prev_status == Status.DRAFT and instance.status == Status.CONFIRMED and not instance.events.exists():
            _create_recurring_events(instance)

        # Non-multi PUT: cascade room/dates/duration/color/artists/styles/genres to children
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
