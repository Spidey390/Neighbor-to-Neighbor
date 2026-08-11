import React, { useState, useEffect } from "react";
import LocationPickerMap from "./LocationPickerMap.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  Upload,
  FileCheck2,
  ArrowLeft,
  HeartHandshake,
  ArrowRight,
  Sparkles,
  MapPin,
  CheckCircle2,
  Shield,
  HelpCircle,
  Home } from
"lucide-react";

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

export default function AuthPage({ onAuthSuccess, onBackToHome, initialTab = "login", isEmbedded = false }) {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(initialTab === "login");

  useEffect(() => {
    setIsLogin(initialTab === "login");
  }, [initialTab]);

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginTwilioWarning, setLoginTwilioWarning] = useState("");
  const [loginFallbackOtp, setLoginFallbackOtp] = useState("");
  const [sendingLoginOtp, setSendingLoginOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [otp, setOtp] = useState("");
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupTwilioWarning, setSignupTwilioWarning] = useState("");
  const [signupFallbackOtp, setSignupFallbackOtp] = useState("");
  const [sendingSignupOtp, setSendingSignupOtp] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleSendLoginOtp = async () => {
    if (!loginPhone.trim()) {
      setLoginError("Please enter your phone number first.");
      return;
    }
    setSendingLoginOtp(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: loginPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }
      setLoginOtpSent(true);
      if (data.twilioWarning && data.otpCode) {
        setLoginTwilioWarning(data.twilioWarning);
        setLoginFallbackOtp(data.otpCode);
      } else {
        setLoginTwilioWarning("");
        setLoginFallbackOtp("");
      }
      setLoginOtp("");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setSendingLoginOtp(false);
    }
  };

  const handleSendSignupOtp = async () => {
    if (!signupPhone.trim()) {
      setSignupError("Please enter your phone number first.");
      return;
    }
    setSendingSignupOtp(true);
    setSignupError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: signupPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }
      setSignupOtpSent(true);
      if (data.twilioWarning && data.otpCode) {
        setSignupTwilioWarning(data.twilioWarning);
        setSignupFallbackOtp(data.otpCode);
      } else {
        setSignupTwilioWarning("");
        setSignupFallbackOtp("");
      }
      setOtp("");
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setSendingSignupOtp(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginPhone.trim()) {
      setLoginError("Phone number is required.");
      return;
    }
    if (!loginOtp.trim()) {
      setLoginError("Please enter the 6-digit OTP code.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      // 1. Real 6-Digit OTP Verification
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: loginPhone.trim(), otpCode: loginOtp.trim() })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "OTP verification failed.");
      }

      // 2. Perform Login
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: loginPhone.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("invalidCredentials"));
      }

      localStorage.setItem("session_id", data.user.id);
      onAuthSuccess(data.user);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setSignupError("Please enter your name.");
      return;
    }
    if (!signupPhone.trim()) {
      setSignupError("Please enter your phone number.");
      return;
    }
    if (!otp.trim()) {
      setSignupError("Please enter the 6-digit OTP code.");
      return;
    }

    const role = isVolunteer ? "volunteer" : "resident";
    setIsSigningUp(true);
    setSignupError("");

    try {
      // 1. Real 6-Digit OTP Verification
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: signupPhone.trim(), otpCode: otp.trim() })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "OTP verification failed.");
      }

      // 2. Perform Registration
      const customId = "custom-" + Math.random().toString(36).substr(2, 9);
      const payload = {
        id: customId,
        name: signupName.trim(),
        phoneNumber: signupPhone.trim(),
        role,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to register profile.");
      }

      localStorage.setItem("session_id", data.user.id);
      onAuthSuccess(data.user);
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className={`auth-page ${isEmbedded ? "auth-embedded" : "auth-standalone"}`} id="auth-page">
      {onBackToHome && (
        <div className="max-w-xl mx-auto w-full mb-4">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:text-emerald-800 hover:border-emerald-200 shadow-xs transition-all cursor-pointer"
            id="back-to-home-btn"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
        </div>
      )}
      {!isEmbedded && <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-[#263c2e] flex items-center justify-center text-white shadow-lg shadow-emerald-100">
          <HeartHandshake size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-950 tracking-tight font-serif">
            {t("appName")}
          </h2>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mt-1">
            {t("appSubhead")}
          </p>
        </div>
      </div>}

      <div className={`${isEmbedded ? "mt-0" : "mt-8"} sm:mx-auto sm:w-full sm:max-w-xl`}>
        <div className={`bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-xl border border-gray-100 space-y-6 ${isEmbedded ? "max-h-[65vh]" : "max-h-[85vh]"} overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
          {/* Header tabs toggle */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setIsLogin(true);
                setLoginError("");
              }}
              className={`w-1/2 pb-4 text-center font-bold text-base border-b-2 transition-all ${
              isLogin ?
              "border-[#263c2e] text-[#263c2e]" :
              "border-transparent text-gray-400 hover:text-gray-600"}`
              }>
              {t("loginTab")}
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setSignupError("");
              }}
              className={`w-1/2 pb-4 text-center font-bold text-base border-b-2 transition-all ${
              !isLogin ?
              "border-[#263c2e] text-[#263c2e]" :
              "border-transparent text-gray-400 hover:text-gray-600"}`
              }>
              {t("registerTab")}
            </button>
          </div>

          {/* SIGN IN VIEW */}
          {isLogin ?
          <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  {t("welcomeBack")}! {t("signIn")}
                </p>
              </div>

              {loginError &&
                <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded-r-xl text-sm font-semibold">
                  ⚠️ {loginError}
                </div>
              }
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="login-phone">
                    {t("phone")}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative rounded-xl shadow-sm flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Phone size={18} />
                      </div>
                      <input
                        id="login-phone"
                        type="tel"
                        required
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] font-medium transition-all"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendLoginOtp}
                      disabled={sendingLoginOtp || !loginPhone.trim()}
                      className="px-4 py-3 bg-[#263c2e] hover:bg-[#1c2e23] text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer shrink-0 disabled:opacity-50 transition-all"
                    >
                      {sendingLoginOtp ? "Sending..." : loginOtpSent ? "Resend OTP" : "Send 6-Digit OTP"}
                    </button>
                  </div>
                </div>

                {loginOtpSent && (
                  <div className="bg-[#edf3ed] border border-[#263c2e]/30 text-[#263c2e] p-3.5 rounded-xl text-xs font-bold space-y-1.5 shadow-2xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
                      <span>📱 6-Digit Verification Code Generated for <strong>{loginPhone}</strong></span>
                    </div>
                    {loginTwilioWarning ? (
                      <div className="text-xs font-normal text-amber-950 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 mt-1 space-y-1">
                        <p>ℹ️ <strong>Twilio Trial Note:</strong> Twilio Trial accounts only deliver live SMS to numbers verified in your Twilio Console.</p>
                        <p className="font-bold text-gray-900 pt-0.5">
                          Verification Code: <span className="font-mono text-sm tracking-widest text-[#263c2e] bg-white px-2 py-0.5 rounded border border-emerald-300">{loginFallbackOtp}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium text-emerald-800">
                        ✓ SMS dispatched to your mobile phone. Please check your messages.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-700" htmlFor="login-otp">
                      Enter 6-Digit OTP Code
                    </label>
                    {loginOtpSent && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Ready
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <input
                      id="login-otp"
                      type="text"
                      maxLength="6"
                      required
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] font-mono tracking-widest text-center transition-all"
                      placeholder="Enter 6-Digit Code"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-md text-base font-bold text-white bg-[#263c2e] hover:bg-[#172b1e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-800 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{isLoggingIn ? t("loggingIn") : "Verify OTP & Log In"}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div> : (

          /* SIGN UP VIEW */
          <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <p className="text-sm text-gray-500 font-medium">
                  {t("joinNeighborhood")}
                </p>
              </div>

              {signupError &&
                <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded-r-xl text-sm font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{signupError}</span>
                </div>
              }

              <form onSubmit={handleSignupSubmit} className="space-y-5">
                {/* 1. Full Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="signup-name">
                    Full Name
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <UserIcon size={18} />
                    </div>
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] font-medium transition-all"
                      placeholder="e.g. Grandma Rose"
                    />
                  </div>
                </div>

                {/* 2. Phone Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="signup-phone">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative rounded-xl shadow-sm flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Phone size={18} />
                      </div>
                      <input
                        id="signup-phone"
                        type="tel"
                        required
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] font-medium transition-all"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendSignupOtp}
                      disabled={sendingSignupOtp || !signupPhone.trim()}
                      className="px-4 py-3 bg-[#263c2e] hover:bg-[#1c2e23] text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer shrink-0 disabled:opacity-50 transition-all"
                    >
                      {sendingSignupOtp ? "Sending..." : signupOtpSent ? "Resend OTP" : "Send 6-Digit OTP"}
                    </button>
                  </div>
                </div>

                {signupOtpSent && (
                  <div className="bg-[#edf3ed] border border-[#263c2e]/30 text-[#263c2e] p-3.5 rounded-xl text-xs font-bold space-y-1.5 shadow-2xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
                      <span>📱 6-Digit Verification Code Generated for <strong>{signupPhone}</strong></span>
                    </div>
                    {signupTwilioWarning ? (
                      <div className="text-xs font-normal text-amber-950 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 mt-1 space-y-1">
                        <p>ℹ️ <strong>Twilio Trial Note:</strong> Twilio Trial accounts only deliver live SMS to numbers verified in your Twilio Console.</p>
                        <p className="font-bold text-gray-900 pt-0.5">
                          Verification Code: <span className="font-mono text-sm tracking-widest text-[#263c2e] bg-white px-2 py-0.5 rounded border border-emerald-300">{signupFallbackOtp}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium text-emerald-800">
                        ✓ SMS dispatched to your mobile phone. Please check your messages.
                      </p>
                    )}
                  </div>
                )}

                {/* 3. Select Role Cards */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVolunteer(false);
                        if (signupError) setSignupError("");
                      }}
                      className={`px-4 py-3.5 rounded-xl border font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                        !isVolunteer
                          ? "border-[#263c2e] bg-[#edf3ed] text-[#17211d] shadow-2xs ring-1 ring-[#263c2e]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${
                          !isVolunteer ? "bg-[#263c2e] text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          <Home size={18} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{t("resident")}</span>
                      </div>
                      {!isVolunteer && <CheckCircle2 className="text-[#263c2e]" size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsVolunteer(true);
                        if (signupError) setSignupError("");
                      }}
                      className={`px-4 py-3.5 rounded-xl border font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                        isVolunteer
                          ? "border-[#263c2e] bg-[#edf3ed] text-[#17211d] shadow-2xs ring-1 ring-[#263c2e]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${
                          isVolunteer ? "bg-[#263c2e] text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          <HeartHandshake size={18} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{t("volunteer")}</span>
                      </div>
                      {isVolunteer && <CheckCircle2 className="text-[#263c2e]" size={18} />}
                    </button>
                  </div>
                </div>

                {/* 4. OTP Verification */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-700" htmlFor="signup-otp">
                      Enter 6-Digit OTP Code
                    </label>
                    {signupOtpSent && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ OTP Generated & Ready
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <input
                      id="signup-otp"
                      type="text"
                      maxLength="6"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-[#263c2e] font-mono tracking-widest text-center transition-all"
                      placeholder="6-Digit OTP"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-md text-base font-bold text-white bg-[#263c2e] hover:bg-[#172b1e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-800 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSigningUp ? t("registering") : "Verify OTP & Create Account"}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>)
          }
        </div>
      </div>
    </div>
  );
}
