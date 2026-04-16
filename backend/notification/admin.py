from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "event_type", "is_read", "created_at", "read_at")
    list_filter = ("event_type", "read_at")
    search_fields = ("recipient__email", "event_type")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "read_at", "is_read")
