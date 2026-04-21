from django.contrib import admin
from .models import FestivalDay, FesivalRoom


class FestivalRoomInline(admin.TabularInline):
    model = FesivalRoom
    extra = 1


@admin.register(FestivalDay)
class FestivalDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'event']
    list_filter = ['event']
    search_fields = ['event__name']
    inlines = [FestivalRoomInline]


@admin.register(FesivalRoom)
class FestivalRoomAdmin(admin.ModelAdmin):
    list_display = ['festival_day', 'room']
    list_filter = ['festival_day__event']
    search_fields = ['room__name', 'festival_day__event__name']
