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

export const SKILL_OPTIONS = ["Groceries", "Fix something", "Phone/computer help"];

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
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupAge, setSignupAge] = useState("");
  const [isDisability, setIsDisability] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [otp, setOtp] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Quick Demo logins
  const DEMO_PROFILES = [
    { id: "resident-1", name: "Jane Doe", role: `${t("resident")} (Approved)`, phoneNumber: "+91 90000 00001" },
    { id: "volunteer-1", name: "Alice Green", role: `${t("volunteer")} (Approved)`, phoneNumber: "+91 90000 00002" },
    { id: "admin-1", name: "Admin Control", role: t("operations"), phoneNumber: "+91 90000 00000" }
  ];

  const handleDemoLogin = async (userId) => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer mock-${userId}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to load demo profile.");
      }

      const data = await response.json();
      if (data.user) {
        localStorage.setItem("session_id", data.user.id);
        onAuthSuccess(data.user);
      } else {
        throw new Error("Demo profile data missing.");
      }
    } catch (err) {
      setLoginError(err.message || "Could not login with demo profile.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginPhone.trim()) {
      setLoginError("Phone number is required.");
      return;
    }
    if (loginOtp !== "1234") {
      setLoginError("Please verify your phone number with the OTP (1234).");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: loginPhone.trim(), password: "123456" })
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
    if (otp !== "1234") {
      setSignupError("Please verify your phone number with the OTP (1234).");
      return;
    }

    const role = isVolunteer ? "volunteer" : "resident";

    // Enforce age > 58 ONLY for senior residents
    let ageNum = null;
    if (role === "resident") {
      if (!signupAge.trim()) {
        setSignupError("Please enter your age.");
        return;
      }
      ageNum = parseInt(signupAge, 10);
      if (!isDisability && (isNaN(ageNum) || ageNum <= 58)) {
        setSignupError(t("notEligibleAge"));
        return;
      }
    } else if (signupAge.trim()) {
      ageNum = parseInt(signupAge, 10);
    }

    setIsSigningUp(true);
    setSignupError("");

    const customId = "custom-" + Math.random().toString(36).substr(2, 9);

    try {
      const payload = {
        id: customId,
        name: signupName.trim(),
        phoneNumber: signupPhone.trim(),
        password: "123456",
        role,
        age: ageNum,
        hasDisability: isDisability,
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:text-indigo-600 hover:border-indigo-200 shadow-xs transition-all cursor-pointer"
            id="back-to-home-btn"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
        </div>
      )}
      {!isEmbedded && <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <HeartHandshake size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-950 tracking-tight font-sans">
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
              "border-indigo-600 text-indigo-600" :
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
              "border-indigo-600 text-indigo-600" :
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
                    {t("phone")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone size={18} />
                    </div>
                    <input
                      id="login-phone"
                      type="tel"
                      required
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 font-medium transition-all"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-700" htmlFor="login-otp">
                      OTP Verification <span className="text-red-500">*</span>
                    </label>
                    {loginOtp === "1234" ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Code Verified
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">
                        Demo OTP: <strong className="text-indigo-600 font-mono">1234</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <input
                      id="login-otp"
                      type="text"
                      maxLength="4"
                      required
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className={`block w-full px-4 py-3 border rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 font-mono tracking-widest text-center transition-all ${
                        loginOtp === "1234"
                          ? "border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500/30"
                          : "border-gray-300 focus:ring-indigo-500/30 focus:border-indigo-600"
                      }`}
                      placeholder="1234"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{isLoggingIn ? t("loggingIn") : t("loginTab")}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              {/* Quick Switch / Demo Evaluation accounts */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-3 bg-white text-gray-500 font-bold tracking-wider">
                    Demo Profiles
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEMO_PROFILES.map((profile) =>
              <button
                key={profile.id}
                onClick={() => handleDemoLogin(profile.id)}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/40 text-center transition-all group">
                    <span className="text-xs font-black text-gray-900 group-hover:text-indigo-600">
                      {profile.name}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 font-semibold">
                      {profile.role}
                    </span>
                  </button>
              )}
              </div>
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
                {/* 1. Role Selection Cards at top */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    1. Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVolunteer(false);
                        if (signupError) setSignupError("");
                      }}
                      className={`p-4 rounded-2xl border-2 font-bold text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        !isVolunteer
                          ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-2xl">🏠</span>
                        {!isVolunteer && <CheckCircle2 className="text-indigo-600" size={18} />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900">{t("resident")}</div>
                        <div className="text-[11px] font-medium text-gray-500 mt-0.5">Senior Resident (58+)</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsVolunteer(true);
                        if (signupError) setSignupError("");
                      }}
                      className={`p-4 rounded-2xl border-2 font-bold text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isVolunteer
                          ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-2xl">🤝</span>
                        {isVolunteer && <CheckCircle2 className="text-indigo-600" size={18} />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900">{t("volunteer")}</div>
                        <div className="text-[11px] font-medium text-gray-500 mt-0.5">Open for all ages</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Full Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="signup-name">
                    Full Name <span className="text-red-500">*</span>
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
                      className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 font-medium transition-all"
                      placeholder="e.g. Grandma Rose"
                    />
                  </div>
                </div>

                {/* 3. Phone Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" htmlFor="signup-phone">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone size={18} />
                    </div>
                    <input
                      id="signup-phone"
                      type="tel"
                      required
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 font-medium transition-all"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                {/* 4. OTP Verification */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-700" htmlFor="signup-otp">
                      OTP Verification <span className="text-red-500">*</span>
                    </label>
                    {otp === "1234" ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Code Verified
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">
                        Demo OTP: <strong className="text-indigo-600 font-mono">1234</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <input
                      id="signup-otp"
                      type="text"
                      maxLength="4"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className={`block w-full px-4 py-3 border rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 font-mono tracking-widest text-center transition-all ${
                        otp === "1234"
                          ? "border-emerald-500 bg-emerald-50/20 focus:ring-emerald-500/30"
                          : "border-gray-300 focus:ring-indigo-500/30 focus:border-indigo-600"
                      }`}
                      placeholder="1234"
                    />
                  </div>
                </div>

                {/* 5. Age field - required for Senior Residents */}
                {!isVolunteer && (
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-gray-800" htmlFor="signup-age">
                        Senior Age Verification <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
                        Must be 58+
                      </span>
                    </div>

                    <input
                      id="signup-age"
                      type="number"
                      min="1"
                      max="120"
                      required={!isVolunteer}
                      value={signupAge}
                      onChange={(e) => {
                        setSignupAge(e.target.value);
                        if (signupError) setSignupError("");
                      }}
                      className={`block w-full px-4 py-3 border rounded-xl text-base text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 font-medium bg-white transition-all ${
                        signupAge !== "" && !isDisability && parseInt(signupAge, 10) <= 58
                          ? "border-red-500 bg-red-50/30 focus:ring-red-500/30"
                          : "border-gray-300 focus:ring-indigo-500/30 focus:border-indigo-600"
                      }`}
                      placeholder="e.g. 60"
                    />

                    {/* Person with Disability Toggle */}
                    <div className="p-3 bg-white border border-gray-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
                      <input
                        id="signup-disability"
                        type="checkbox"
                        checked={isDisability}
                        onChange={(e) => {
                          setIsDisability(e.target.checked);
                          if (signupError) setSignupError("");
                        }}
                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="signup-disability" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                        ♿ Person with Disability <span className="text-gray-500 font-normal">(Age restriction waived)</span>
                      </label>
                    </div>

                    {signupAge !== "" && !isDisability && parseInt(signupAge, 10) <= 58 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>{t("notEligibleAge")}</span>
                      </div>
                    )}
                    {signupAge !== "" && isDisability && parseInt(signupAge, 10) <= 58 && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <span>✅</span>
                        <span>Age restriction waived for Person with Disability.</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSigningUp ? t("registering") : "Create Account & Continue"}</span>
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
