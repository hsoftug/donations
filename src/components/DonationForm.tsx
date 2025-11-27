import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface DonationFormData {
  name: string;
  email: string;
  amount: string;
  phone_number: string;
  currency: string;
}

interface DonationResponse {
  success: boolean;
  message: string;
  data: {
    donation_id: string;
    order_id: string;
    amount: number;
    currency: string;
    redirect_url: string;
    order_tracking_id: string;
  };
  error?: string;
}

const DonationForm = () => {
  const [formData, setFormData] = useState<DonationFormData>({
    name: "",
    email: "",
    amount: "",
    phone_number: "",
    currency: "UGX",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  // Predefined donation amounts
  const quickAmounts = [5000, 10000, 25000, 50000, 100000];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear errors when user starts typing
    if (error) setError(null);
  };

  const handleQuickAmount = (amount: number) => {
    setFormData((prev) => ({
      ...prev,
      amount: amount.toString(),
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Please enter your name");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    const amount = Number(formData.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return false;
    }

    if (formData.currency === "UGX" && amount < 1000) {
      setError("Minimum donation amount is UGX 1,000");
      return false;
    }

    if (formData.currency === "USD" && amount < 1) {
      setError("Minimum donation amount is USD 1");
      return false;
    }

    if (formData.phone_number && !formData.phone_number.startsWith("+")) {
      setError("Phone number must start with country code (e.g., +256)");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/donations/donate/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
        }),
      });

      const data: DonationResponse = await response.json();

      if (response.ok && data.success) {
        setSuccess("Redirecting to payment gateway...");

        // Store donation info in localStorage for tracking
        localStorage.setItem(
          "pending_donation",
          JSON.stringify({
            donation_id: data.data.donation_id,
            order_id: data.data.order_id,
            amount: data.data.amount,
            currency: data.data.currency,
            timestamp: new Date().toISOString(),
          })
        );

        // Redirect to Pesapal payment page in the same window
        // This is better than window.open for mobile compatibility
        window.location.href = data.data.redirect_url;

        // Alternative: Open in new tab (uncomment if preferred)
        // window.open(data.data.redirect_url, "_blank");
        // setTimeout(() => {
        //   navigate(`/donation-status/${data.data.order_id}`);
        // }, 2000);
      } else {
        setError(data.error || data.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Donation error:", err);
      setError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Make a Donation
          </h1>
          <p className="text-gray-600">
            Your contribution makes a difference
          </p>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Phone Number Field */}
            <div>
              <label
                htmlFor="phone_number"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="+256700000000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="mt-1 text-xs text-gray-500">
                Include country code (e.g., +256 for Uganda)
              </p>
            </div>

            {/* Currency Selection */}
            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="UGX">🇺🇬 Ugandan Shilling (UGX)</option>
                <option value="USD">🇺🇸 US Dollar (USD)</option>
                <option value="KES">🇰🇪 Kenyan Shilling (KES)</option>
                <option value="TZS">🇹🇿 Tanzanian Shilling (TZS)</option>
              </select>
            </div>

            {/* Quick Amount Buttons */}
            {formData.currency === "UGX" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Select Amount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleQuickAmount(amount)}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        formData.amount === amount.toString()
                          ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                          : "border-gray-300 hover:border-blue-300 text-gray-700"
                      }`}
                    >
                      {formatCurrency(amount, "UGX")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Field */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Donation Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-2 text-gray-500 font-medium">
                  {formData.currency}
                </span>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="1"
                  step="any"
                  placeholder="Enter amount"
                  className="w-full pl-16 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formData.currency === "UGX"
                  ? "Minimum: UGX 1,000"
                  : "Minimum: USD 1"}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Proceed to Payment"
              )}
            </button>
          </form>

          {/* Success Message */}
          {success && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-green-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-green-800 font-medium">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              🔒 Secure payment powered by Pesapal. Your payment information is
              encrypted and secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationForm;