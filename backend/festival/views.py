from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import FestivalDay, FesivalRoom
from .serializers import FestivalDaySerializer, FestivalRoomSerializer


class FestivalDayViewSet(viewsets.ModelViewSet):
    serializer_class = FestivalDaySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        return FestivalDay.objects.select_related('event').prefetch_related('fesivalroom_set__room__location')


class FestivalRoomViewSet(viewsets.ModelViewSet):
    serializer_class = FestivalRoomSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        return FesivalRoom.objects.select_related('room__location', 'festival_day')
