from django.contrib import admin

from .models import Artist, ArtistType, Event, EventType, Genre, Level, Location, Room, Style


@admin.register(Style)
class StyleAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(ArtistType)
class ArtistTypeAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    list_display = ("__str__", "user")
    list_filter = ("types", "styles", "genres")
    search_fields = ("first_name", "last_name", "user__first_name", "user__last_name", "user__email")
    filter_horizontal = ("types", "styles", "genres")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "address")
    list_filter = ("city__region__country",)
    search_fields = ("name", "address", "city__name")
    ordering = ("name",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "capacity")
    list_filter = ("location",)
    search_fields = ("name", "location__name")
    ordering = ("location", "name")


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "frequency", "partners")
    list_filter = ("frequency",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "event_type", "status", "type", "start_date", "end_date", "room", "capacity", "level")
    list_filter = ("status", "type", "event_type", "level", "styles", "genres")
    search_fields = ("name",)
    ordering = ("-start_date",)
    filter_horizontal = ("events", "styles", "genres", "artists")
    fieldsets = (
        (None,
        {"fields": ("name", "status", "event_type", "type", "level", "color", "image")}),
        ("Schedule", {"fields": ("start_date", "end_date", "duration")}),
        ("Venue", {"fields": ("room", "capacity")}),
        ("Details", {"fields": ("styles", "genres", "artists", "events")}),
    )
