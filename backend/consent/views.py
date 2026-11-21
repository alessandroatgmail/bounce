from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import Communication, Consent
from .serializers import CommunicationSerializer, ConsentSerializer


class CommunicationViewSet(viewsets.ModelViewSet):
    serializer_class = CommunicationSerializer
    permission_classes = [IsAdminUser]
    queryset = Communication.objects.prefetch_related('events', 'extra_items', 'plans')

    @action(detail=False, methods=['get'], url_path='for-user', permission_classes=[IsAuthenticated])
    def for_user(self, request):
        """
        Communications a user needs to see/consent to for a given extra_item,
        event and/or plan — matched in an OR, not an AND: passing several
        filters returns the union of what each one would return on its own.
        """
        extra_item_id = request.query_params.get('extra_item', '').strip()
        event_id = request.query_params.get('event', '').strip()
        plan_id = request.query_params.get('plan', '').strip()

        filters = Q()
        if extra_item_id:
            filters |= Q(extra_items=extra_item_id)
        if event_id:
            filters |= Q(events=event_id)
        if plan_id:
            filters |= Q(plans=plan_id)

        if not filters:
            queryset = Communication.objects.none()
        else:
            queryset = self.get_queryset().filter(filters).distinct()

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ConsentViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = ConsentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Consent.objects.all()
