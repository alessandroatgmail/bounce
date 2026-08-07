from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated

from .models import FestivalDay, FesivalRoom
from .serializers import FestivalDaySerializer, FestivalRoomSerializer


class FestivalDayViewSet(viewsets.ModelViewSet):
    serializer_class = FestivalDaySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = FestivalDay.objects.select_related('event').prefetch_related('fesivalroom_set__room__location')
        event_id = self.request.query_params.get('event_id')
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs


class FestivalRoomViewSet(viewsets.ModelViewSet):
    serializer_class = FestivalRoomSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        return FesivalRoom.objects.select_related('room__location', 'festival_day')
