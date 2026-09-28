from django.contrib import admin

from .models import Log


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ("user", "event")
    search_fields = (
        "user__first_name", "user__last_name", "user__email",
        "event__name", "logs",
    )
    ordering = ("-id",)
    list_filter = ("event", "user")
    readonly_fields = ("user", "event", "logs")
