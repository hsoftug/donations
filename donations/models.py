# donations/models.py
import uuid
from django.db import models

class Donation(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_FAILED = "FAILED"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.AutoField(primary_key=True)
    order_id = models.CharField(max_length=64, blank=True, null=True, help_text="Merchant order id")
    order_tracking_id = models.CharField(max_length=128, blank=True, null=True)
    pesapal_merchant_reference = models.CharField(max_length=128, blank=True, null=True)

    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    name = models.CharField(max_length=255, blank=True, help_text="Full name (optional)")
    email = models.EmailField()
    phone_number = models.CharField(max_length=30, blank=True, null=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="UGX")

    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    payment_method = models.CharField(max_length=50, blank=True, null=True)

    pesapal_redirect_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Donation"
        verbose_name_plural = "Donations"

    def __str__(self):
        return f"{self.name or self.first_name} — {self.amount} {self.currency}"

    def mark_completed(self):
        from django.utils import timezone
        self.status = self.STATUS_COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "updated_at"])

    def mark_failed(self):
        self.status = self.STATUS_FAILED
        self.save(update_fields=["status", "updated_at"])
