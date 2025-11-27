# donations/views.py

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.urls import reverse
from .models import Donation
from .serializers import DonationSerializer
from .pesapal_client import PesapalClient
import uuid
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken


class CreateDonationAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data

        # --- Normalize Name ---
        name = data.get("name", "").strip()
        first_name = data.get("first_name")
        last_name = data.get("last_name")

        if not first_name and name:
            name_parts = name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

        # --- Serialize ---
        serializer = DonationSerializer(data={
            "first_name": first_name,
            "last_name": last_name,
            "name": name,
            "email": data.get("email"),
            "phone_number": data.get("phone_number"),
            "amount": float(data.get("amount")),
            "currency": data.get("currency", "UGX"),
        })

        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        donation = serializer.save()
        donation.order_id = f"DON-{uuid.uuid4().hex[:12].upper()}"
        donation.save()

        pesapal = PesapalClient()

        # Your FRONTEND handles redirecting after payment
        callback_url = settings.FRONTEND_URL + "/payment-success"

        order_payload = {
            "id": donation.order_id,
            "currency": donation.currency,
            "amount": float(donation.amount),
            "description": f"Donation {donation.order_id}",
            "callback_url": callback_url,
            "notification_id": None,
            "billing_address": {
                "email_address": donation.email or "example@mail.com",
                "first_name": donation.first_name or donation.name or "Guest",
                "last_name": donation.last_name or "",
                "phone_number": donation.phone_number or "000000000",
                "country_code": "UG",
            }
        }

        try:
            response = pesapal.submit_order(order_payload)

            redirect_url = (
                response.get("redirect_url") or
                response.get("checkout_url") or
                response.get("payment_url")
            )

            tracking_id = (
                response.get("order_tracking_id") or
                response.get("orderTrackingId")
            )

            donation.pesapal_redirect_url = redirect_url
            donation.order_tracking_id = tracking_id
            donation.pesapal_merchant_reference = response.get("merchant_reference")
            donation.save()

            if not redirect_url:
                return Response(
                    {"success": False, "message": "Pesapal did not return redirect URL."},
                    status=500
                )

            return Response({
                "success": True,
                "message": "Donation created successfully",
                "data": {
                    "donation_id": donation.id,
                    "order_id": donation.order_id,
                    "order_tracking_id": tracking_id,
                    "amount": float(donation.amount),
                    "currency": donation.currency,
                    "redirect_url": redirect_url
                }
            }, status=201)

        except Exception as e:
            return Response({
                "success": False,
                "message": "Pesapal payment initiation failed.",
                "error": str(e)
            }, status=500)


class PaymentCallbackAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        order_tracking_id = request.GET.get("OrderTrackingId")
        merchant_reference = request.GET.get("OrderMerchantReference")

        if not order_tracking_id or not merchant_reference:
            return Response(
                {"success": False, "message": "Missing tracking parameters"},
                status=400
            )

        donation = get_object_or_404(Donation, order_id=merchant_reference)
        pesapal = PesapalClient()

        try:
            status_data = pesapal.get_transaction_status(order_tracking_id)

            status_text = (
                status_data.get("payment_status_description") or
                status_data.get("payment_status") or
                status_data.get("status")
            )

            if status_text:
                s = status_text.upper()
                if "COMPLETED" in s or "PAID" in s:
                    donation.mark_completed()
                elif "FAILED" in s or "INVALID" in s:
                    donation.mark_failed()

            donation.order_tracking_id = order_tracking_id
            donation.save()

            return Response({
                "success": True,
                "message": "Payment verified",
                "data": {
                    "amount": float(donation.amount) if donation.amount is not None else 0.0,
                    "currency": donation.currency,
                    "order_id": donation.order_id,
                    "donation_id": donation.id,
                    "status": donation.status,
                    "redirect_url": donation.pesapal_redirect_url
                }
            })

        except Exception as e:
            return Response(
                {"success": False, "message": "Verification error", "error": str(e)},
                status=500
            )


class IPNListenerAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        order_tracking_id = request.data.get("OrderTrackingId")
        merchant_reference = request.data.get("OrderMerchantReference")

        if not order_tracking_id or not merchant_reference:
            return Response({"success": False, "message": "Invalid IPN"}, status=400)

        donation = get_object_or_404(Donation, order_id=merchant_reference)
        pesapal = PesapalClient()

        try:
            status_data = pesapal.get_transaction_status(order_tracking_id)
            status_text = (
                status_data.get("payment_status_description") or
                status_data.get("status")
            )

            if status_text:
                s = status_text.upper()
                if "COMPLETED" in s or "PAID" in s:
                    donation.mark_completed()
                elif "FAILED" in s or "INVALID" in s:
                    donation.mark_failed()

            donation.order_tracking_id = order_tracking_id
            donation.save()

            return Response({"success": True, "message": "IPN processed"})

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class DonationStatusAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, donation_id):
        donation = get_object_or_404(Donation, id=donation_id)
        serializer = DonationSerializer(donation)
        return Response({"success": True, "data": serializer.data})


class AdminDashboardView(generics.ListAPIView):
    queryset = Donation.objects.all().order_by('-created_at') 
    serializer_class = DonationSerializer
    permission_classes = [permissions.AllowAny] 

class AdminLoginAPIView(APIView):
    permission_classes = [AllowAny]  # <-- THIS FIXES THE 401 ERROR

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is not None and user.is_staff:
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "username": user.username
            })

        return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
