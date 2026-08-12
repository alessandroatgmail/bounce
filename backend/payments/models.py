from django.conf import settings
from django.db import models
from django.utils import timezone


class PaymentMethod(models.TextChoices):
    STRIPE = "stripe", "Stripe"
    CASH = "cash", "Cash"
    BANK = "bank", "Bank transfer"


class Transaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='transactions')
    contributions = models.ManyToManyField('booking.Contribution', blank=True, related_name='transactions')
    method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.STRIPE)
    stripe_session_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    receipt_number = models.CharField(max_length=100, blank=True)
    amount_total = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='eur')
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Transaction {self.get_method_display()} {self.amount_total} {self.currency}"
