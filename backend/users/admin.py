from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import City, Country, Region, User


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name", "iso")
    search_fields = ("name", "iso")
    ordering = ("name",)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "country")
    list_filter = ("country",)
    search_fields = ("name",)
    ordering = ("country", "name")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "country")
    list_filter = ("country", "region")
    search_fields = ("name",)
    ordering = ("country", "name")


@admin.register(User)
class BounceUserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "phone", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff", "acsi")
    search_fields = ("email", "first_name", "last_name", "phone", "ci")
    ordering = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone", "date_of_birth", "place_of_birth", "ci")}),
        ("Address", {"fields": ("address", "city", "postal_code", "country")}),
        ("ACSI", {"fields": ("acsi", "acsi_number", "acsi_expiration_date")}),
        ("Consents", {"fields": ("privacy_consent", "marketing_consent")}),
        ("Role & access", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "first_name", "last_name", "role", "phone"),
        }),
    )
