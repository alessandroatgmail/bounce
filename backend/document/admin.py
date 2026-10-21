from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("user", "document_type", "emission_date", "date")
    list_filter = ("document_type", "user")
    search_fields = ("user__first_name", "user__last_name", "user__email")
    ordering = ("-date",)
    autocomplete_fields = ("user",)
    readonly_fields = ("date",)
