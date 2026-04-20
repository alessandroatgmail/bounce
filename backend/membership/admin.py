from django.contrib import admin
from .models import Membership


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "contribution", "max_courses", "max_parties", "color")
    list_filter = ("type",)
    search_fields = ("name",)
    ordering = ("name",)
    filter_horizontal = ("events",)
