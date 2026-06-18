import datetime

from dateutil.relativedelta import relativedelta
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from config.models import SiteSettings
from event.models import Event
from membership.models import Membership
from .models import Booking, Contribution, ContributionStatus
from .serializers import ContributionSerializer, UserBookingSerializer, UserContributionSerializer, _validate_membership_events
from .utils import sync_bookings


class UserBookingViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = UserBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Booking.objects
            .filter(user=self.request.user)
            .select_related(
                'event', 'event__event_type', 'event__level',
                'event__room', 'event__room__location', 'event__room__location__city',
            )
            .prefetch_related('event__styles', 'event__genres', 'event__artists', 'event__events')
            .order_by('event__start_date')
        )


class ContributionViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Contribution.objects.select_related('user', 'membership').prefetch_related('events', 'discounts')
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class UserContributionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = UserContributionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Contribution.objects
            .filter(user=self.request.user)
            .select_related(
                'membership', 'role',
                'original_contribution__membership',
                'original_contribution__role',
            )
            .prefetch_related(
                'events', 'discounts',
                'original_contribution__events',
                'original_contribution__discounts',
                'twin_contributions',
                'twin_contributions__events',
                'twin_contributions__discounts',
                'twin_contributions__membership',
                'twin_contributions__role',
                'membership__membershiprule_set__event_type',
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='add-event')
    def add_event(self, request, pk=None):
        contribution = self.get_object()
        event_id = request.data.get('event_id')
        if not event_id:
            return Response({'event_id': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'event_id': 'Event not found.'}, status=status.HTTP_400_BAD_REQUEST)

        if contribution.membership:
            current_events = list(contribution.events.all()) + [event]
            try:
                _validate_membership_events(contribution.membership, current_events)
            except Exception as exc:
                return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        contribution.events.add(event)
        if contribution.status == ContributionStatus.CONFIRMED:
            sync_bookings(contribution.user, added_events=[event], removed_events=[])
        return Response(self.get_serializer(contribution).data)

    @action(detail=True, methods=['post'], url_path='upgrade')
    def upgrade(self, request, pk=None):
        old_contribution = self.get_object()
        membership_id = request.data.get('membership_id')

        if not membership_id:
            return Response({'membership_id': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_membership = Membership.objects.get(pk=membership_id)
        except Membership.DoesNotExist:
            return Response({'membership_id': 'Membership not found.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        season_end = SiteSettings.load().season_end

        # Close the old contribution at this moment
        old_contribution.end_date = now
        old_contribution.save(update_fields=['end_date'])

        # New end_date: season end if configured, otherwise membership duration
        if season_end:
            new_end_date = timezone.make_aware(
                datetime.datetime.combine(season_end, datetime.time.max),
                timezone.get_current_timezone(),
            )
        elif new_membership.duration:
            new_end_date = now + relativedelta(months=new_membership.duration)
        else:
            new_end_date = None

        new_contribution = Contribution.objects.create(
            user=request.user,
            membership=new_membership,
            amount=new_membership.contribution,
            end_date=new_end_date,
            upgraded_from=old_contribution,
        )
        new_contribution.events.set(old_contribution.events.all())

        return Response(self.get_serializer(new_contribution).data, status=status.HTTP_201_CREATED)
