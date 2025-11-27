import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface PaymentData {
  success: boolean;
  message: string;
  data: {
    donation_id: string;
    order_id: string;
    amount: number;
    status: string;
    currency: string;
  };
}

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const orderTrackingId = searchParams.get("OrderTrackingId");
        const merchantReference = searchParams.get("OrderMerchantReference");

        if (!orderTrackingId || !merchantReference) {
          setError("Invalid payment callback. Missing required parameters.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `http://127.0.0.1:8000/api/donations/callback/?OrderTrackingId=${orderTrackingId}&OrderMerchantReference=${merchantReference}`
        );

        const data: PaymentData = await response.json();

        if (response.ok && data.success) {
          setPaymentData(data);
          localStorage.removeItem("pending_donation");
        } else {
          setError(data.message || "Payment verification failed");
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        setError("Failed to verify payment. Please contact support.");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  const downloadReceipt = () => {
    if (!paymentData) return;

    const receiptContent = `
DONATION RECEIPT
================

Order ID: ${paymentData.data.order_id}
Donation ID: ${paymentData.data.donation_id}
Amount: ${paymentData.data.currency}: ${paymentData.data.amount}
Status: ${paymentData.data.status}
Date: ${new Date().toLocaleString()}

Thank you for your generous donation!
    `;

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${paymentData.data.order_id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Verifying Payment...
          </h2>
          <p className="text-gray-600">Please wait while we confirm your donation</p>
        </div>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Payment Verification Failed
            </h2>
            <p className="text-gray-600">{error}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/")}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Return to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
        {/* Success Icon with Animation */}
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4 animate-bounce">
            <svg
              className="h-12 w-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600 text-lg">
            Thank you for your generous donation
          </p>
        </div>

        {/* Payment Details Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Transaction Details
          </h3>

          <div className="space-y-3">
            {/* amount */}
            <div className="flex justify-between items-center py-3 border-b border-blue-200">
              <span className="text-gray-600 font-medium">amount</span>
              <span className="text-2xl font-bold text-green-600">
                {paymentData.data.currency}: {paymentData.data.amount}
              </span>
            </div>

            {/* Order ID */}
            <div className="flex justify-between items-center py-3 border-b border-blue-200">
              <span className="text-gray-600 font-medium">Order ID</span>
              <span className="text-gray-800 font-mono text-sm">
                {paymentData.data.order_id}
              </span>
            </div>

            {/* Donation ID */}
            <div className="flex justify-between items-center py-3 border-b border-blue-200">
              <span className="text-gray-600 font-medium">Donation ID</span>
              <span className="text-gray-800 font-mono text-xs">
                {paymentData.data.donation_id}
              </span>
            </div>

            {/* Status */}
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600 font-medium">Status</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                {paymentData.data.status}
              </span>
            </div>

            {/* Date */}
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600 font-medium">Date</span>
              <span className="text-gray-800">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Impact Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <span className="text-2xl mr-3"></span>
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">
                Your Impact
              </h4>
              <p className="text-sm text-gray-600">
                Your donation will help us continue our mission to make a
                positive difference in the community. A receipt has been sent to
                your email.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={downloadReceipt}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg"
          >
            Download Receipt
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full bg-gray-100 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
          >
            Return to Home
          </button>

          <button
            onClick={() => navigate("/donate")}
            className="w-full border-2 border-blue-600 text-blue-600 py-3 px-4 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-200"
          >
            Make Another Donation
          </button>
        </div>

        {/* Social Share (unchanged) */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-3">
            Share your good deed
          </p>
          {/* social buttons here */}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
