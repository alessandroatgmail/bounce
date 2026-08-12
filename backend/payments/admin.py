from django.contrib import admin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "method", "amount_total", "currency", "receipt_number", "date")
    search_fields = (
        "user__first_name", "user__last_name", "user__email",
        "receipt_number", "stripe_session_id",
    )
    ordering = ("-date",)
    list_filter = ("method", "currency")
    filter_horizontal = ("contributions",)
    autocomplete_fields = ("user",)
    readonly_fields = ("stripe_session_id", "stripe_payment_intent_id", "date")
    fieldsets = (
        (None, {"fields": ("user", "method", "amount_total", "currency", "date")}),
        ("Cash / bank", {"fields": ("receipt_number",)}),
        ("Stripe", {"fields": ("stripe_session_id", "stripe_payment_intent_id")}),
        ("Contributions", {"fields": ("contributions",)}),
    )
