from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import serializers
from users.models import City
from .models import EventType, Type, Location, Room, Style, Genre, ArtistType, Artist, Level, Event, Status, PartnerRole, EventDescription
from membership.models import Membership


class PartnerRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerRole
        fields = ["id", "name"]


class EventTypeSerializer(serializers.ModelSerializer):
    partner_roles = PartnerRoleSerializer(many=True, read_only=True)
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


class EventAdminListSerializer(serializers.ModelSerializer):
    """Flat, read-only shape for the admin events table: no nested relations."""
    event_type_name = serializers.CharField(source="event_type.name", read_only=True)
    room = serializers.StringRelatedField(read_only=True)
    artists = serializers.SerializerMethodField()
    available_spot = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "name", "status", "event_type_name", "start_date",
            "room", "artists", "capacity", "available_spot",
        ]

    def get_artists(self, obj):
        return [str(artist) for artist in obj.artists.all()]

    def get_available_spot(self, obj):
        return obj.capacity - obj.occupied_count


def _level_counts_for(obj):
    """level_id -> {role_name: count} of PAYED/ACCEPTED contributions for
    this multi_events festival. EventViewSet.list bulk-computes this for
    every multi_events event on the page in one query (prefetched_level_counts);
    outside that path (e.g. retrieve) fall back to one direct grouped query."""
    counts = getattr(obj, 'prefetched_level_counts', None)
    if counts is not None:
        return counts

    from booking.models import ContributionStatus as CS

    rows = obj.contributions.filter(
        status__in=[CS.PAYED, CS.ACCEPTED],
    ).values('level_id', 'role__name').annotate(n=Count('id'))
    result = {}
    for row in rows:
        result.setdefault(row['level_id'], {})[row['role__name']] = row['n']
    return result


def _role_would_be_accepted(child_event, role, roles):
    """Would a new contribution for this role, at this level, land ACCEPTED
    (mirrors booking.service._check_role_accepted / _check_extras) rather
    than WAITING? An empty (or non-matching) accepted_roles set waits
    everyone, same as the real booking flow. `roles` is role_name -> count
    of currently accepted/payed contributions at this level."""
    if role not in child_event.accepted_roles.all():
        return False

    role_name = role.name
    if role_name not in roles:
        return True
    min_count = min(roles.values())
    max_count = max(roles.values())
    if roles[role_name] == min_count:
        return True
    return max_count < min_count + child_event.extras


def _level_colors(child_event, available_spot, roles_seen):
    """Per-partner-role availability color for a level's representative
    child event: red = capacity full, orange = this role would land on
    the waiting list (not an accepted role, or role imbalance beyond
    extras), yellow = bookable but at/under the warning threshold,
    green = plenty of room. Event types with no partner roles get a
    single 'default' color based on capacity alone."""
    partner_roles = list(child_event.event_type.partner_roles.all())
    roles = {r.name: 0 for r in partner_roles}
    roles.update(roles_seen)

    def color_for(role=None):
        if available_spot <= 0:
            return 'red'
        if role is not None and not _role_would_be_accepted(child_event, role, roles):
            return 'orange'
        if available_spot <= child_event.warning_threshold:
            return 'yellow'
        return 'green'

    if not partner_roles:
        return {'default': color_for()}
    return {role.name: color_for(role) for role in partner_roles}


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
    accepted_roles = PartnerRoleSerializer(many=True, read_only=True)
    accepted_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, source="accepted_roles",
        queryset=PartnerRole.objects.all(), required=False,
    )
    memberships = serializers.SerializerMethodField()
    membership_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, source="memberships",
        queryset=Membership.objects.all(), required=False,
    )
    effective_image = serializers.SerializerMethodField()
    already_booked = serializers.SerializerMethodField()
    booked_by = serializers.SerializerMethodField()
    children_levels = serializers.SerializerMethodField()
    available_spot = serializers.SerializerMethodField()

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
            "accepted_roles", "accepted_role_ids",
            "memberships", "membership_ids",
            "warning_threshold",
            "extras",
            "payment_days",
            "multi_events",
            "free",
            "already_booked", "booked_by", "available_spot",
            "children_levels",
        ]

    def get_memberships(self, obj):
        from membership.serializers import MembershipSerializer
        # Memberships are only ever those explicitly attached to this event
        # via membership_ids; admins attach them per event rather than
        # relying on the event_type's MembershipRule to imply them.
        request = self.context.get("request")
        is_staff = bool(request and request.user and request.user.is_staff)
        memberships = obj.memberships.all()
        if not is_staff:
            memberships = [m for m in memberships if m.is_available]
        return MembershipSerializer(memberships, many=True).data

    def get_children_levels(self, obj):
        # Availability colors only make sense for a fixed-choice festival
        # (multi_events, not free) — recurring weekly events also link
        # children via the same M2M, but there's no "level" being picked
        # there. This also has to match EventViewSet.list's bulk-precompute
        # gate exactly, or the events it skips fall back to a query each.
        if not (obj.multi_events and not obj.free):
            return []

        # Iterate the (possibly prefetched) children instead of issuing a
        # fresh filtered query per event. One representative child per
        # level is enough to compute level-wide availability, since
        # booking into a level books every one of its classes as a bundle.
        representative_by_level = {}
        for child in obj.events.all().order_by("level__name"):
            if child.level_id is not None and child.level_id not in representative_by_level:
                representative_by_level[child.level_id] = child
        if not representative_by_level:
            return []

        level_counts = _level_counts_for(obj)
        result = []
        for level_id, child in representative_by_level.items():
            roles_seen = level_counts.get(level_id, {})
            available_spot = child.capacity - sum(roles_seen.values())
            result.append({
                'id': level_id,
                'name': child.level.name,
                'colors': _level_colors(child, available_spot, roles_seen),
            })
        return result

    def get_available_spot(self, obj):
        occupied_count = getattr(obj, "occupied_count", None)
        if occupied_count is None:
            return obj.available_spot
        return obj.capacity - occupied_count

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
        if not (request and request.user.is_authenticated):
            return False
        user_has_booked = getattr(obj, "user_has_booked", None)
        if user_has_booked is not None:
            return user_has_booked
        return obj.contributions.filter(user=request.user).exists()

    def get_booked_by(self, obj):
        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            return None
        contributions = getattr(obj, "viewer_partner_contributions", None)
        if contributions is not None:
            contribution = contributions[0] if contributions else None
        else:
            contribution = (
                obj.contributions
                .filter(user=request.user, original_contribution__isnull=False)
                .select_related("original_contribution__user")
                .first()
            )
        if contribution:
            booker = contribution.original_contribution.user
            return f"{booker.first_name} {booker.last_name}"
        return None

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
        accepted_roles = validated_data.pop("accepted_roles", None)
        memberships = validated_data.pop("memberships", [])
        event = Event.objects.create(**validated_data)
        event.styles.set(styles)
        event.genres.set(genres)
        event.artists.set(artists)
        event.events.set(events)
        if accepted_roles is not None:
            event.accepted_roles.set(accepted_roles)
        event.memberships.set(memberships)
        return event

    def update(self, instance, validated_data):
        styles = validated_data.pop("styles", None)
        genres = validated_data.pop("genres", None)
        artists = validated_data.pop("artists", None)
        events = validated_data.pop("events", None)
        accepted_roles = validated_data.pop("accepted_roles", None)
        memberships = validated_data.pop("memberships", None)
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
        if accepted_roles is not None:
            instance.accepted_roles.set(accepted_roles)
        if memberships is not None:
            instance.memberships.set(memberships)
        return instance


class EventDescriptionSerializer(serializers.ModelSerializer):
    event = serializers.PrimaryKeyRelatedField(read_only=True)
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), source="event", write_only=True
    )

    class Meta:
        model = EventDescription
        fields = ["id", "event", "event_id", "language", "desc"]
