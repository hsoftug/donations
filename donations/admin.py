# donations/admin.py
from django.contrib import admin
from .models import Donation

@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ("id", "order_id", "name", "email", "amount", "currency", "status", "created_at", "completed_at")
    list_filter = ("status", "currency", "created_at")
    search_fields = ("name", "email", "order_id", "order_tracking_id")
    readonly_fields = ("created_at", "updated_at", "completed_at", "order_tracking_id")
