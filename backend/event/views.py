from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework import status as drf_status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from .paginations import EventPagination
from .filters import EventFilter

from .models import EventType, Location, Room, Style, Genre, ArtistType, Artist, Level, Event, Status, Frequency, PartnerRole, EventDescription
from .serializers import EventTypeSerializer, LocationSerializer, RoomSerializer, StyleSerializer, GenreSerializer, ArtistTypeSerializer, ArtistSerializer, LevelSerializer, EventSerializer, EventAdminListSerializer, PartnerRoleSerializer, EventDescriptionSerializer
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


class EventDescriptionViewSet(viewsets.ModelViewSet):
    queryset = EventDescription.objects.all()
    serializer_class = EventDescriptionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["event", "language"]

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
        from booking.models import Contribution, ContributionStatus
        from membership.models import Membership, MembershipRule

        user = self.request.user
        qs = Event.objects.all() if user.is_staff else Event.objects.filter(status=Status.PUBLISHED)

        # MembershipSerializer nests rules -> event_type -> partner_roles,
        # plus fix_events (the events always bundled with the membership).
        membership_qs = Membership.objects.prefetch_related(
            Prefetch(
                "membershiprule_set",
                queryset=MembershipRule.objects.select_related("event_type")
                .prefetch_related("event_type__partner_roles"),
            ),
            "fix_events",
        )

        qs = qs.select_related(
            "event_type", "level", "room__location__city__country",
        ).prefetch_related(
            "styles", "genres", "accepted_roles",
            "event_type__partner_roles",
            Prefetch(
                "artists",
                queryset=Artist.objects.select_related("user")
                .prefetch_related("types", "styles", "genres"),
            ),
            Prefetch(
                "events",
                queryset=Event.objects.select_related("level", "event_type")
                .prefetch_related("event_type__partner_roles", "accepted_roles"),
            ),
            Prefetch("memberships", queryset=membership_qs),
            Prefetch(
                "event_set",
                queryset=Event.objects.only("id", "image"),
                to_attr="prefetched_parents",
            ),
        ).annotate(
            occupied_count=Count(
                "contributions",
                filter=Q(contributions__status__in=[ContributionStatus.PAYED, ContributionStatus.ACCEPTED]),
                distinct=True,
            ),
        ).order_by('start_date')

        if user.is_authenticated:
            qs = qs.annotate(
                user_has_booked=Exists(
                    Contribution.objects.filter(events=OuterRef("pk"), user=user)
                ),
            ).prefetch_related(
                Prefetch(
                    "contributions",
                    queryset=Contribution.objects.filter(
                        user=user, original_contribution__isnull=False
                    ).select_related("original_contribution__user"),
                    to_attr="viewer_partner_contributions",
                ),
            )
        return qs

    def list(self, request, *args, **kwargs):
        # children_levels' per-level/per-role colors need, per multi_events
        # event on the page, how many PAYED/ACCEPTED contributions exist
        # per (level, role) — one bulk query for the whole page instead of
        # a query per event, so the list endpoint stays O(1) queries.
        from booking.models import Contribution, ContributionStatus

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        objects = page if page is not None else queryset

        multi_ids = [e.id for e in objects if e.multi_events and not e.free]
        if multi_ids:
            counts = {}
            rows = Contribution.objects.filter(
                events__id__in=multi_ids,
                status__in=[ContributionStatus.PAYED, ContributionStatus.ACCEPTED],
            ).values("events__id", "level_id", "role__name").annotate(n=Count("id"))
            for row in rows:
                counts.setdefault(row["events__id"], {}).setdefault(
                    row["level_id"], {},
                )[row["role__name"]] = row["n"]
            for event in objects:
                if event.id in multi_ids:
                    event.prefetched_level_counts = counts.get(event.id, {})

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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


class EventAdminListView(ListAPIView):
    """
    GET /api/events/admin/ — flat, read-only event list for the admin table.

    Unlike EventViewSet.list, this skips every nested relation (memberships,
    styles, genres, children, viewer bookings) and serves only the columns
    the table shows, so a full page costs a handful of queries.
    """
    serializer_class = EventAdminListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = EventPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = EventFilter

    def get_queryset(self):
        from booking.models import ContributionStatus

        return (
            Event.objects
            .select_related("event_type", "room__location")
            .prefetch_related(
                Prefetch("artists", queryset=Artist.objects.select_related("user")),
            )
            .annotate(
                occupied_count=Count(
                    "contributions",
                    filter=Q(contributions__status__in=[ContributionStatus.PAYED, ContributionStatus.ACCEPTED]),
                    distinct=True,
                ),
            )
            .order_by("start_date")
        )


class EventRegisterView(APIView):
    """
    GET  /api/events/register/<event_id>/ — attendee grid for an event
         (see booking.register.build_register for the row semantics).
    POST /api/events/register/<event_id>/ — consolidate the event: its
         bookings (always up to date) are replicated onto all its
         children, whose previous bookings are deleted first. Any
         request body is ignored.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, event_id):
        from booking.register import build_register

        event = get_object_or_404(Event, pk=event_id)
        return Response(build_register(event))

    def post(self, request, event_id):
        from booking.register import consolidate_register

        event = get_object_or_404(Event, pk=event_id)
        created, deleted = consolidate_register(event)
        return Response({"event_id": event.id, "created": created, "deleted": deleted})
