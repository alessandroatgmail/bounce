import datetime

from dateutil.relativedelta import relativedelta
from django.db.models import OuterRef, Prefetch, Q, Subquery
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings
from config.models import SiteSettings
from event.models import Event
from membership.models import Membership
from .models import Booking, Contribution, ContributionStatus, ExtraItem
from .serializers import AcsiExtraItemSerializer, BookingSerializer, ContributionAdminListSerializer, ContributionOverviewSerializer, ContributionSerializer, ExtraItemSerializer, FestivalContributionSerializer, FreeFestivalContributionSerializer, UserBookingSerializer, UserContributionSerializer, _validate_membership_events
from .utils import sync_bookings
from utils.tasks import send_email


class AcsiExtraItemPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ExtraItemViewSet(viewsets.ModelViewSet):
    serializer_class = ExtraItemSerializer
    queryset = ExtraItem.objects.all()
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'], url_path='acsi')
    def acsi(self, request):
        """Contributions carrying the ACSI Membership extra item — who needs
        their card checked/renewed, soonest event first."""
        self.pagination_class = AcsiExtraItemPagination
        earliest_event = Event.objects.filter(contributions=OuterRef('pk')).order_by('start_date')
        qs = (
            Contribution.objects
            # .filter(extra_items__name='ACSI Membership')
            .filter(extra_items__name__icontains='ACSI')
            .exclude(status=ContributionStatus.CANCELLED)
            .select_related('user')
            .annotate(
                event_start_date=Subquery(earliest_event.values('start_date')[:1]),
                event_name=Subquery(earliest_event.values('name')[:1]),
            )
            .order_by('event_start_date', 'user__last_name', 'user__first_name')
        )
        user_id = request.query_params.get('user', '').strip()
        if user_id:
            qs = qs.filter(user_id=user_id)
        page = self.paginate_queryset(qs)
        serializer = AcsiExtraItemSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


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


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Booking.objects.select_related(
            'user', 'event', 'role', 'partner', 'partner_role', 'contribution',
        )
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        event_id = self.request.query_params.get('event')
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs


class ContributionViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Contribution.objects.select_related('user', 'membership').prefetch_related('events', 'discounts')
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class ContributionOverviewViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ContributionOverviewSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = (
            Contribution.objects
            .select_related('user', 'role', 'original_contribution__user', 'original_contribution__role')
            .prefetch_related(
                Prefetch('twin_contributions', queryset=Contribution.objects.select_related('user', 'role')),
            )
            .order_by('-date')
        )
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        event_id = self.request.query_params.get('event')
        if event_id:
            qs = qs.filter(events=event_id)
        return qs


class ContributionAdminListPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _filter_contributions_admin(qs, query_params):
    """Applies the name/event/plan/status/date filters shared by
    ContributionAdminListView and ContributionAdminIdsView."""
    name = query_params.get('name', '').strip()
    if name:
        qs = qs.filter(
            Q(user__first_name__icontains=name)
            | Q(user__last_name__icontains=name)
            | Q(user__email__icontains=name)
        )

    event_id = query_params.get('event', '').strip()
    if event_id:
        qs = qs.filter(events__id=event_id)

    plan_id = query_params.get('plan', '').strip()
    if plan_id:
        qs = qs.filter(membership_id=plan_id)

    status_param = query_params.get('status', '').strip()
    if status_param:
        qs = qs.filter(status=status_param)

    date_from = query_params.get('date_from', '').strip()
    if date_from:
        qs = qs.filter(date__date__gte=date_from)

    date_to = query_params.get('date_to', '').strip()
    if date_to:
        qs = qs.filter(date__date__lte=date_to)

    return qs.distinct()


class ContributionAdminListView(ListAPIView):
    """Admin-wide, one-row-per-contribution table — mirrors UserListView's
    pattern. Deliberately separate from ContributionViewSet (unpaginated,
    consumed by useContributions.ts for a single user's own contributions)
    and ContributionOverviewViewSet (single-event registration list), so
    this new filter/pagination set can't regress either of those."""
    serializer_class = ContributionAdminListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = ContributionAdminListPagination

    def get_queryset(self):
        qs = (
            Contribution.objects
            .select_related('user', 'membership')
            .prefetch_related('events')
            .order_by('-date')
        )
        return _filter_contributions_admin(qs, self.request.query_params)


class ContributionAdminIdsView(APIView):
    """Every contribution id (and the distinct user ids) matching the same
    filters as ContributionAdminListView, unpaginated — lets the admin
    contributions table resolve "select all" across every page."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _filter_contributions_admin(Contribution.objects.all(), request.query_params)
        ids = list(qs.order_by('-date').values_list('id', flat=True))
        user_ids = list(qs.order_by('user__last_name', 'user__first_name').values_list('user_id', flat=True).distinct())
        return Response({'ids': ids, 'user_ids': user_ids, 'count': len(ids)})


class UserContributionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
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

    @action(detail=False, methods=['post'], url_path='book-festival')
    def book_festival(self, request):
        """Case 3 — festival, fixed choice: level_id is mandatory and the
        event must be a multi_events, non-free festival (see
        FestivalContributionSerializer)."""
        serializer = FestivalContributionSerializer(
            data=request.data, context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        contribution = serializer.save(user=request.user)
        return Response(
            self.get_serializer(contribution).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='book-free-festival')
    def book_free_festival(self, request):
        """Case 4 — festival, free choice: event_ids is mandatory and the
        event must be a multi_events, free festival (see
        FreeFestivalContributionSerializer)."""
        serializer = FreeFestivalContributionSerializer(
            data=request.data, context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        contribution = serializer.save(user=request.user)
        return Response(
            self.get_serializer(contribution).data, status=status.HTTP_201_CREATED,
        )

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

    def perform_destroy(self, instance):
        if instance.status == ContributionStatus.PAYED:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Paid contributions cannot be cancelled.')
        instance.status = ContributionStatus.CANCELLED
        instance.save(update_fields=['status'])
        first_event = instance.events.first()
        send_email.delay(
            instance.user.id,
            template='cancellation_email',
            context={
                'first_name': instance.user.first_name,
                'event_name': first_event.name if first_event else (instance.membership.name if instance.membership else '—'),
                'url': settings.FRONTEND_URL + '/contacts',
            },
        )
