from django.contrib.auth import get_user_model
from rest_framework import serializers
from users.models import City
from .models import EventType, Type, Location, Room, Style, Genre, ArtistType, Artist, Level, Event, Status, PartnerRole
from django.db.models import Count


class PartnerRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerRole
        fields = ["id", "name"]


class EventTypeSerializer(serializers.ModelSerializer):
    partner_roles = serializers.StringRelatedField(many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, source="partner_roles", queryset=PartnerRole.objects.all(),
        required=False
    )
    class Meta:
        model = EventType
        fields = ["id", "name", "frequency", "partners", "role_ids", "partner_roles"]

    def validate(self, data):
        # In partial updates (PATCH), skip validation if neither field is provided.
        # self.partial is True when the serializer is initialized with partial=True.
        if self.partial and "partners" not in data and "partner_roles" not in data:
            return data

        partners = data.get("partners", getattr(self.instance, "partners", None))
        role_ids = data.get("partner_roles", None)

        if partners and role_ids:
            if partners != len(role_ids):
                raise serializers.ValidationError("Wrong number of roles")
        else:
            if not (partners == 0 and not role_ids):
                raise serializers.ValidationError("Wrong number of roles")

        return data

    def create(self, validated_data):
        roles = validated_data.pop("partner_roles", [])
        event_type = EventType.objects.create(**validated_data)
        event_type.partner_roles.set(roles)
        return event_type

    def update(self, instance, validated_data):
        roles = validated_data.pop("partner_roles", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if roles:
            instance.partner_roles.set(roles)
        return instance


class CitySerializer(serializers.ModelSerializer):
    country = serializers.StringRelatedField()

    class Meta:
        model = City
        fields = ["id", "name", "country"]


class LocationSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)
    city_id = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), source="city", write_only=True
    )

    class Meta:
        model = Location
        fields = ["id", "name", "address", "city", "city_id"]


class RoomSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), source="location", write_only=True
    )

    class Meta:
        model = Room
        fields = ["id", "name", "capacity", "location", "location_id"]


class StyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Style
        fields = ["id", "name"]


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ["id", "name"]


class ArtistTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtistType
        fields = ["id", "name"]


class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ["id", "name"]


class ArtistSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    types = ArtistTypeSerializer(many=True, read_only=True)
    styles = StyleSerializer(many=True, read_only=True)
    genres = GenreSerializer(many=True, read_only=True)
    type_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=ArtistType.objects.all(), source="types", write_only=True, required=False
    )
    style_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Style.objects.all(), source="styles", write_only=True, required=False
    )
    genre_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Genre.objects.all(), source="genres", write_only=True, required=False
    )

    class Meta:
        model = Artist
        fields = [
            "id", "full_name", "user",
            "first_name", "last_name",
            "types", "type_ids",
            "styles", "style_ids",
            "genres", "genre_ids",
        ]

    def get_full_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return f"{obj.first_name} {obj.last_name}"

    def validate(self, data):
        instance = self.instance
        if self.partial and instance:
            user = data.get("user", getattr(instance, "user", None))
            first_name = data.get("first_name", getattr(instance, "first_name", None)) or None
            last_name = data.get("last_name", getattr(instance, "last_name", None)) or None
        else:
            user = data.get("user")
            first_name = data.get("first_name") or None
            last_name = data.get("last_name") or None
        if not user and not (first_name and last_name):
            raise serializers.ValidationError(
                "Provide either a user or both first_name and last_name."
            )
        return data

    def create(self, validated_data):
        types = validated_data.pop("types", [])
        styles = validated_data.pop("styles", [])
        genres = validated_data.pop("genres", [])
        artist = Artist.objects.create(**validated_data)
        artist.types.set(types)
        artist.styles.set(styles)
        artist.genres.set(genres)
        return artist

    def update(self, instance, validated_data):
        types = validated_data.pop("types", None)
        styles = validated_data.pop("styles", None)
        genres = validated_data.pop("genres", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if types is not None:
            instance.types.set(types)
        if styles is not None:
            instance.styles.set(styles)
        if genres is not None:
            instance.genres.set(genres)
        return instance


class EventSerializer(serializers.ModelSerializer):
    event_type = EventTypeSerializer(read_only=True)
    event_type_id = serializers.PrimaryKeyRelatedField(
        queryset=EventType.objects.all(), source="event_type", write_only=True
    )
    type = serializers.ChoiceField(choices=Type.choices)
    level = LevelSerializer(read_only=True)
    level_id = serializers.PrimaryKeyRelatedField(
        queryset=Level.objects.all(), source="level", write_only=True, required=False, allow_null=True
    )
    room = RoomSerializer(read_only=True)
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), source="room", write_only=True
    )
    styles = StyleSerializer(many=True, read_only=True)
    style_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Style.objects.all(), source="styles", write_only=True, required=False
    )
    genres = GenreSerializer(many=True, read_only=True)
    genre_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Genre.objects.all(), source="genres", write_only=True, required=False
    )
    artists = ArtistSerializer(many=True, read_only=True)
    artist_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Artist.objects.all(), source="artists", write_only=True, required=False
    )
    events = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    event_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Event.objects.all(), source="events", write_only=True, required=False
    )
    effective_image = serializers.SerializerMethodField()
    already_booked = serializers.SerializerMethodField()


    class Meta:
        model = Event
        fields = [
            "id", "name", "status",
            "event_type", "event_type_id",
            "type",
            "level", "level_id",
            "start_date", "end_date", "duration",
            "room", "room_id",
            "capacity",
            "styles", "style_ids",
            "genres", "genre_ids",
            "artists", "artist_ids",
            "events", "event_ids",
            "info", "color",
            "image", "effective_image",
            "already_booked",
        ]

    def get_effective_image(self, obj):
        img = obj.effective_image
        if not img:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(img.url)
        return img.url

    def get_already_booked(self, obj):
        request = self.context.get("request")
        if request:
            user = request.user
        else:
            return False
        if user.is_authenticated:
            return obj.contributions.filter(events=obj, user=user).annotate(events_count=Count('events')
            ).filter(events_count=0).count() > 0
        return False

    def validate(self, data):
        start = data.get("start_date", getattr(self.instance, "start_date", None))
        end = data.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and start >= end:
            raise serializers.ValidationError("end_date must be after start_date.")
        partners = data.get("partners", None)
        if partners:
            if len(data.get("role_ids", None)) != int(partners):
                raise serializers.ValidationError("wrong numbers of partners.")
        return data

    def create(self, validated_data):
        styles = validated_data.pop("styles", [])
        genres = validated_data.pop("genres", [])
        artists = validated_data.pop("artists", [])
        events = validated_data.pop("events", [])
        roles = validated_data.pop("partner_roles", None)
        event = Event.objects.create(**validated_data)
        event.styles.set(styles)
        event.genres.set(genres)
        event.artists.set(artists)
        event.events.set(events)
        return event

    def update(self, instance, validated_data):
        styles = validated_data.pop("styles", None)
        genres = validated_data.pop("genres", None)
        artists = validated_data.pop("artists", None)
        events = validated_data.pop("events", None)
        roles = validated_data.pop("partner_roles", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if styles is not None:
            instance.styles.set(styles)
        if genres is not None:
            instance.genres.set(genres)
        if artists is not None:
            instance.artists.set(artists)
        if events is not None:
            instance.events.set(events)
        return instance
