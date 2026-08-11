import React, { useState } from "react";
import { CheckCircle2, HeartHandshake, Home } from "lucide-react";

export const SKILL_OPTIONS = [
  "Health & Medicine",
  "Shopping & Essentials",
  "Food & Meals",
  "Home Help",
  "Transportation",
  "Technology Help",
  "Companionship",
  "Urgent Help"
];

export default function RegisterModal({ onClose, onRegisterSuccess }) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState("resident");
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      setError("Please enter your phone number first.");
      return;
    }

    setSendingOtp(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }

      setOtpSent(true);
      setOtp("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!otp.trim()) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // 1. Verify Real 6-Digit OTP Code
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), otpCode: otp.trim() })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "OTP verification failed.");
      }

      // 2. Complete Profile Registration
      const randomId = "custom-" + Math.random().toString(36).substr(2, 9);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: randomId,
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          role,
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to register profile.");
      }

      onRegisterSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" id="register-modal">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-fade-in my-8">
        <div className="bg-[#263c2e] px-6 py-4 flex justify-between items-center text-white">
          <h3 className="text-xl font-bold font-serif">Register Custom Community Profile</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors text-2xl font-bold focus:outline-none"
            aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {error &&
            <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded-r-xl text-sm font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          }

          {/* 1. Full Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="reg-name">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-medium focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] focus:outline-none transition-all"
              placeholder="e.g. Grandma Rose"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required />
          </div>

          {/* 2. Phone Number */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="reg-phone">
              Phone Number
            </label>
            <div className="flex gap-2">
              <input
                id="reg-phone"
                type="tel"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-medium focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] focus:outline-none transition-all"
                placeholder="e.g. +91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || !phoneNumber.trim()}
                className="px-4 py-3 bg-[#263c2e] hover:bg-[#1c2e23] text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer shrink-0 disabled:opacity-50 transition-all"
              >
                {sendingOtp ? "Sending..." : otpSent ? "Resend OTP" : "Send 6-Digit OTP"}
              </button>
            </div>
          </div>

          {otpSent && (
            <div className="bg-emerald-50 border border-emerald-300 text-[#263c2e] p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-fade-in">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
              <span>📱 6-Digit OTP sent via Twilio SMS to <strong>{phoneNumber}</strong>. Please check your mobile phone!</span>
            </div>
          )}

          {/* 3. Role Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("resident")}
                className={`px-4 py-3.5 rounded-xl border font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                  role === "resident"
                    ? "border-[#263c2e] bg-[#edf3ed] text-[#17211d] shadow-2xs ring-1 ring-[#263c2e]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/60"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    role === "resident" ? "bg-[#263c2e] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Home size={18} />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Resident</span>
                </div>
                {role === "resident" && <CheckCircle2 className="text-[#263c2e]" size={18} />}
              </button>

              <button
                type="button"
                onClick={() => setRole("volunteer")}
                className={`px-4 py-3.5 rounded-xl border font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                  role === "volunteer"
                    ? "border-[#263c2e] bg-[#edf3ed] text-[#17211d] shadow-2xs ring-1 ring-[#263c2e]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/60"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    role === "volunteer" ? "bg-[#263c2e] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    <HeartHandshake size={18} />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Volunteer</span>
                </div>
                {role === "volunteer" && <CheckCircle2 className="text-[#263c2e]" size={18} />}
              </button>
            </div>
          </div>

          {/* 4. OTP Verification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-gray-700" htmlFor="reg-otp">
                Enter 6-Digit OTP Code
              </label>
              {otpSent && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ OTP Generated & Ready
                </span>
              )}
            </div>
            <input
              id="reg-otp"
              type="text"
              maxLength="6"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] focus:outline-none transition-all"
              placeholder="6-Digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              required />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-base rounded-xl transition-all cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 px-4 bg-[#263c2e] hover:bg-[#172b1e] text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer">
              {isSubmitting ? "Registering..." : "Submit Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

