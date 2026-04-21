from rest_framework import serializers
from event.models import Event, Room
from event.serializers import EventSerializer, RoomSerializer
from .models import FestivalDay, FesivalRoom


class FestivalRoomSerializer(serializers.ModelSerializer):
    room = RoomSerializer(read_only=True)
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(),
        source='room', write_only=True,
    )

    class Meta:
        model = FesivalRoom
        fields = ['id', 'festival_day', 'room', 'room_id']


class FestivalDaySerializer(serializers.ModelSerializer):
    rooms = FestivalRoomSerializer(many=True, read_only=True, source='fesivalroom_set')
    event = EventSerializer(read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.filter(event_type__name='Festival'),
        source='event', write_only=True,
    )

    class Meta:
        model = FestivalDay
        fields = ['id', 'date', 'event', 'event_id', 'rooms']
