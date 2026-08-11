import React, { useState } from "react";

export const SKILL_OPTIONS = ["Groceries", "Fix something", "Phone/computer help"];

export default function RegisterModal({ onClose, onRegisterSuccess }) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [age, setAge] = useState("");
  const [isDisability, setIsDisability] = useState(false);
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState("resident");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (otp !== "1234") {
      setError("Please verify your phone number with the OTP (1234).");
      return;
    }

    let ageNum = null;
    if (role === "resident") {
      if (!age.trim()) {
        setError("Please enter your age.");
        return;
      }
      ageNum = parseInt(age, 10);
      if (!isDisability && (isNaN(ageNum) || ageNum <= 58)) {
        setError("Not eligible: Senior Resident registration is allowed for individuals above 58 years of age only.");
        return;
      }
    } else if (age.trim()) {
      ageNum = parseInt(age, 10);
    }

    setIsSubmitting(true);
    setError("");

    const randomId = "custom-" + Math.random().toString(36).substr(2, 9);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: randomId,
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          password: "123456",
          role,
          age: ageNum,
          hasDisability: isDisability,
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
        <div className="bg-amber-600 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="text-xl font-bold font-sans">Register Custom Community Profile</h3>
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

          {/* 1. Role Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">1. Select Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("resident")}
                className={`p-4 rounded-2xl border-2 font-bold text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  role === "resident"
                    ? "border-amber-600 bg-amber-50/70 text-amber-950 shadow-sm ring-2 ring-amber-500/20"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                }`}>
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-2xl">🏠</span>
                  {role === "resident" && <span className="text-amber-600 font-bold text-lg">✓</span>}
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900">Senior Resident</div>
                  <div className="text-[11px] font-medium text-gray-500 mt-0.5">58+ years old</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("volunteer")}
                className={`p-4 rounded-2xl border-2 font-bold text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  role === "volunteer"
                    ? "border-amber-600 bg-amber-50/70 text-amber-950 shadow-sm ring-2 ring-amber-500/20"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                }`}>
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-2xl">🤝</span>
                  {role === "volunteer" && <span className="text-amber-600 font-bold text-lg">✓</span>}
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900">Volunteer</div>
                  <div className="text-[11px] font-medium text-gray-500 mt-0.5">Open to all ages</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Full Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="reg-name">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:outline-none transition-all"
              placeholder="e.g. Grandma Rose"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required />
          </div>

          {/* 3. Phone Number */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="reg-phone">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:outline-none transition-all"
              placeholder="e.g. +91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required />
          </div>

          {/* 4. OTP Verification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-gray-700" htmlFor="reg-otp">
                OTP Verification <span className="text-red-500">*</span>
              </label>
              {otp === "1234" ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Verified
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  Demo OTP: <strong className="text-amber-700 font-mono">1234</strong>
                </span>
              )}
            </div>
            <input
              id="reg-otp"
              type="text"
              maxLength="4"
              className={`w-full border rounded-xl px-4 py-3 text-base text-gray-900 font-mono tracking-widest text-center focus:ring-2 focus:outline-none transition-all ${
                otp === "1234"
                  ? "border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500/30"
                  : "border-gray-300 focus:ring-amber-500/30 focus:border-amber-600"
              }`}
              placeholder="1234"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              required />
          </div>

          {/* 5. Age field for Senior Resident */}
          {role === "resident" && (
            <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-800" htmlFor="reg-age">
                  Senior Age Verification <span className="text-red-500">*</span>
                </label>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  Must be 58+
                </span>
              </div>
              <input
                id="reg-age"
                type="number"
                min="1"
                max="120"
                className={`w-full border rounded-xl px-4 py-3 text-base text-gray-900 font-medium bg-white focus:ring-2 focus:outline-none transition-all ${
                  age !== "" && !isDisability && parseInt(age, 10) <= 58 ? "border-red-500 bg-red-50/30 focus:ring-red-500/30" : "border-gray-300 focus:ring-amber-500/30 focus:border-amber-600"
                }`}
                placeholder="e.g. 60"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required />

              <div className="p-3 bg-white border border-gray-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
                <input
                  id="reg-disability"
                  type="checkbox"
                  checked={isDisability}
                  onChange={(e) => setIsDisability(e.target.checked)}
                  className="h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="reg-disability" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                  ♿ Person with Disability <span className="text-gray-500 font-normal">(Age restriction waived)</span>
                </label>
              </div>

              {age !== "" && !isDisability && parseInt(age, 10) <= 58 && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Not eligible: Registration is allowed for individuals above 58 years of age only.</span>
                </div>
              )}
            </div>
          )}

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
              className="flex-1 py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer">
              {isSubmitting ? "Registering..." : "Submit Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

