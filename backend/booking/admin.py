from django.contrib import admin

from .models import Booking, Contribution


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("user", "event")
    search_fields = (
        "user__first_name", "user__last_name",
        "event__name",
    )
    ordering = ("user__last_name", "user__first_name")
    autocomplete_fields = ("user", "event")


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ("user", "membership", "amount", "status", "date", "start_date", "end_date")
    search_fields = (
        "user__first_name", "user__last_name",
        "membership__name",
    )
    ordering = ("-date", "user__last_name", "user__first_name")
    list_filter = ("status", "membership")
    filter_horizontal = ("events", "discounts")
    autocomplete_fields = ("membership")
    readonly_fields = ("start_date", "end_date", "upgraded_from", "original_contribution")
    fieldsets = (
        (None, {"fields": ("user", "status", "amount", "date")}),
        ("Events & Membership", {"fields": ("events", "membership", "discounts")}),
        ("Partner", {"fields": ("role", "partner", "partner_email")}),
        ("System", {"fields": ("start_date", "end_date", "upgraded_from", "original_contribution")}),
    )
    raw_id_fields = ("user", "event", "partner")
