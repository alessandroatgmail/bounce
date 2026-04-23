from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from event.models import Event
from .models import Contribution
from .serializers import ContributionSerializer, UserContributionSerializer, _sync_bookings, _validate_membership_events


class ContributionViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Contribution.objects.select_related('user', 'membership').prefetch_related('events')
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
            .select_related('membership')
            .prefetch_related('events', 'membership__membershiprule_set__event_type')
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
        _sync_bookings(contribution.user, added_events=[event], removed_events=[])
        return Response(self.get_serializer(contribution).data)
