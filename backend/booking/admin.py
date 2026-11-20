from django.contrib import admin

from .models import AccommodationRoom, AccommodationType, Booking, Contribution, ExtraItem, RegistrationLog


@admin.register(ExtraItem)
class StyleAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)

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
    autocomplete_fields = ("membership", )
    readonly_fields = ("start_date", "end_date", "upgraded_from", "original_contribution")
    fieldsets = (
        (None, {"fields": ("user", "status", "amount", "date", "notes")}),
        ("Events & Membership", {"fields": ("events", "membership", "discounts")}),
        ("Partner", {"fields": ("role", "partner", "partner_email")}),
        ("System", {"fields": ("start_date", "end_date", "upgraded_from", "original_contribution")}),
    )
    raw_id_fields = ("user", "partner")


@admin.register(AccommodationType)
class AccommodationTypeAdmin(admin.ModelAdmin):
    list_display = ("extra_item", "location", "occupants_per_room", "available_rooms")
    search_fields = ("extra_item__name", "location__name")
    list_filter = ("location",)
    ordering = ("location__name", "extra_item__name")
    autocomplete_fields = ("extra_item", "location")


@admin.register(AccommodationRoom)
class AccommodationRoomAdmin(admin.ModelAdmin):
    list_display = ("extra_item", "event", "type", "occupant_count")
    search_fields = (
        "extra_item__name", "event__name",
        "users__first_name", "users__last_name", "users__email",
    )
    list_filter = ("type", "extra_item")
    ordering = ("event__start_date", "extra_item__name")
    autocomplete_fields = ("extra_item", "event")
    filter_horizontal = ("users",)

    def occupant_count(self, obj):
        return obj.users.count()


@admin.register(RegistrationLog)
class RegistrationLogAdmin(admin.ModelAdmin):
    list_display = ("endpoint", "user", "created_at")
    search_fields = ("user__first_name", "user__last_name", "user__email")
    list_filter = ("endpoint",)
    ordering = ("-created_at",)
    raw_id_fields = ("user",)
    readonly_fields = ("user", "endpoint", "body", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
