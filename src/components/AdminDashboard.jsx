import React, { useState } from "react";

// --- Type Definitions ---
type Currency = "UGX" | "USD" | "KES" | "TZS";

interface DonationFormData {
  name: string;
  email: string;
  amount: string;
  phone_prefix: string;
  phone_number: string;
  currency: Currency;
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

// --- Constants ---
const DEFAULT_PROJECT_ID = "general";

const COUNTRY_CODES = [
  { code: "+256", name: "🇺🇬 Uganda" },
  { code: "+254", name: "🇰🇪 Kenya" },
  { code: "+255", name: "🇹🇿 Tanzania" },
  { code: "+27", name: "🇿🇦 South Africa" },
  { code: "+1", name: "🇺🇸 USA/Canada" },
  { code: "+44", name: "🇬🇧 UK" },
];

const useQuickAmounts = () => ({
  UGX: [5000, 10000, 25000, 50000, 100000],
  USD: [5, 10, 25, 50, 100],
  KES: [100, 500, 1000, 2500, 5000],
  TZS: [2000, 5000, 10000, 25000, 50000],
});

const DonationForm = () => {
  const quickAmountsMap = useQuickAmounts();
  const PRIMARY_BLUE = "#157EC2";

  const [formData, setFormData] = useState<DonationFormData>({
    name: "",
    email: "",
    amount: "",
    phone_prefix: "+256",
    phone_number: "",
    currency: "UGX",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currencySymbols: Record<Currency, string> = {
    UGX: "UGX",
    USD: "$",
    KES: "KES",
    TZS: "TZS",
  };

  // --- Format with commas ---
  const formatWithCommas = (value: string) => {
    const num = value.replace(/,/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Format amount with commas
    if (name === "amount") {
      const formatted = value.replace(/[^\d]/g, "");
      setFormData((prev) => ({ ...prev, amount: formatWithCommas(formatted) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (error) setError(null);
  };

  const handleQuickAmount = (amount: number) => {
    setFormData((prev) => ({
      ...prev,
      amount: formatWithCommas(amount.toString()),
    }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const amount = Number(formData.amount.replace(/,/g, ""));
    if (!formData.name.trim()) {
      setError("Please enter your name");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) return;

    setLoading(true);

    const fullPhoneNumber = formData.phone_number.trim()
      ? `${formData.phone_prefix}${formData.phone_number.trim()}`
      : "";

    try {
      const response = await fetch(
        "https://api.hifitechsolns.com/api/donations/donate/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            amount: Number(formData.amount.replace(/,/g, "")),
            currency: formData.currency,
            phone_number: fullPhoneNumber,
            project_id: DEFAULT_PROJECT_ID,
          }),
        }
      );

      const data: DonationResponse = await response.json();

      if (response.ok && data.success) {
        setSuccess("Redirecting to secure payment gateway...");
        localStorage.setItem("pending_donation", JSON.stringify(data.data));
        window.location.href = data.data.redirect_url;
      } else {
        setError(data.error || data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const quickAmounts = quickAmountsMap[formData.currency] || [];
  const currentSymbol = currencySymbols[formData.currency];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 mb-4 flex items-center justify-center border-3 border-gray-100 overflow-hidden">
            <img
              src="/charity.jpg"
              alt="Charity Organization Logo"
              className="w-full h-full object-contain p-2"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2" style={{ color: PRIMARY_BLUE }}>
            Secure Donation
          </h1>
          <p className="text-gray-600 text-base">
            Your contribution goes directly to the LA CHARITY ORG.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white shadow-2xl ring-1 ring-gray-100 rounded-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Amount & Currency */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Choose Amount</h3>
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                  Currency <span className="text-red-500">*</span>
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white appearance-none transition-all duration-200 shadow-sm focus:ring-2 focus:ring-[#157EC2] focus:border-[#157EC2] text-base hover:border-gray-400"
                >
                  <option value="UGX">Ugandan Shilling (UGX)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="KES">Kenyan Shilling (KES)</option>
                  <option value="TZS">Tanzanian Shilling (TZS)</option>
                </select>
              </div>

              {/* Quick Select */}
                        <div className="grid grid-cols-3 gap-3">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className={`
                  px-3 py-2 rounded-xl border-2 font-semibold transition-all duration-200 text-sm
                  whitespace-nowrap overflow-hidden text-ellipsis text-center
                  ${
                    formData.amount.replace(/,/g, "") === amount.toString()
                      ? "border-[#157EC2] text-white shadow-md transform scale-[1.02]"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-[#4B9CD7] transform hover:scale-[1.01]"
                  }
                `}
                style={{
                  backgroundColor:
                    formData.amount.replace(/,/g, "") === amount.toString() ? PRIMARY_BLUE : "white",
                  minWidth: "0", // allows button to shrink if needed
                  flex: "1 1 auto", // lets button expand evenly across row
                }}
              >
                {formatCurrency(amount, formData.currency)}
              </button>
            ))}
          </div>

              {/* Custom Amount */}
              <div className="mt-6">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-gray-400 transition-colors duration-200">
                    {currentSymbol}
                  </span>
                  <input
                    style={{ color: PRIMARY_BLUE }}
                    type="text"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                    placeholder="0.00"
                    className="w-full pl-20 pr-4 py-3 text-3xl font-semibold border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-[#157EC2] focus:border-[#157EC2] transition-all duration-300 shadow-inner"
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Donor Info */}
            <div className="space-y-4 pt-1">
              <h3 className="text-xl font-semibold text-gray-800">Your Contact Details</h3>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#157EC2] focus:border-[#157EC2] transition duration-200 shadow-sm text-base"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="youremail@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#157EC2] focus:border-[#157EC2] transition duration-200 shadow-sm text-base"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="flex space-x-2">
                  <select
                    id="phone_prefix"
                    name="phone_prefix"
                    value={formData.phone_prefix}
                    onChange={handleChange}
                    className="flex-shrink-0 w-1/3 sm:w-1/4 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#157EC2] focus:border-[#157EC2] transition duration-200 shadow-sm text-base"
                  >
                    {COUNTRY_CODES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} {country.name.split(" ")[0]}
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="e.g., 700123456"
                    className="w-2/3 sm:w-3/4 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#157EC2] focus:border-[#157EC2] transition duration-200 shadow-sm text-base"
                  />
                </div>
              </div>
            </div>

            {/* Feedback */}
            {success && (
              <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 font-medium flex items-center shadow-inner animate-pulse">
                <p>{success}</p>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 font-medium flex items-center shadow-inner">
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: loading ? "#4B9CD7" : PRIMARY_BLUE }}
              className={`w-full py-3 px-4 rounded-lg font-bold text-xl text-white transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#157EC2] focus:ring-opacity-50 ${
                loading
                  ? "cursor-not-allowed"
                  : "shadow-lg hover:shadow-2xl transform hover:-translate-y-1 hover:bg-blue-600"
              }`}
            >
              {loading
                ? "Processing..."
                : `Proceed to Donate ${
                    formData.amount ? formatCurrency(Number(formData.amount.replace(/,/g, "")), formData.currency) : ""
                  }`}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center flex items-center justify-center">
              **100% Secure Transaction**. Payment is processed via Pesapal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationForm;
