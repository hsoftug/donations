from django.urls import path
from . import views

app_name = "donations"

urlpatterns = [
    path("donate/", views.CreateDonationAPI.as_view(), name="create_donation"),
    path("callback/", views.PaymentCallbackAPI.as_view(), name="payment_callback"),
    path("ipn/", views.IPNListenerAPI.as_view(), name="ipn_listener"),
    path("admin_login/", views.AdminLoginAPIView.as_view(), name="admin-login"),
    path("status/<int:donation_id>/", views.DonationStatusAPI.as_view(), name="donation_status"),
    path("admin_dashboard/", views.AdminDashboardView.as_view(), name="admin_dashboard_create"),
]
