from django.contrib import admin
from .models import Membership, MembershipRule


class MembershipRuleInline(admin.TabularInline):
    model = MembershipRule
    extra = 1


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "contribution", "color")
    list_filter = ("type",)
    search_fields = ("name",)
    ordering = ("name",)
    inlines = [MembershipRuleInline]


@admin.register(MembershipRule)
class MembershipRuleAdmin(admin.ModelAdmin):
    list_display = ("membership", "event_type", "max_events")
    list_filter = ("membership", "event_type")
