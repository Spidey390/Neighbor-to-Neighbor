import React, { useState } from "react";
import LocationPickerMap from "./LocationPickerMap";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  ArrowRight,
  Check,
  Compass,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Upload,
  User,
  UsersRound
} from "lucide-react";

export default function CompleteProfileForm({ user, onComplete }) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isVolunteer = user.role === "volunteer";

  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [isDisability, setIsDisability] = useState(user.hasDisability || false);
  const [mobileNumber, setMobileNumber] = useState(user.phoneNumber || "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  const fetchLiveLocation = () => {
    setGeoLoading(true);
    setGeoError("");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(4));
          setLng(position.coords.longitude.toFixed(4));
          setGeoLoading(false);
        },
        (locationError) => {
          setGeoError(
            locationError.code === 1
              ? "Location permission is off. You can choose your neighborhood by clicking the map instead."
              : "Unable to retrieve your location. Please choose your neighborhood by clicking the map."
          );
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setGeoError("Geolocation is not supported by your browser.");
      setGeoLoading(false);
    }
  };

  const [radius, setRadius] = useState("5");
  const [selectedSkills, setSelectedSkills] = useState(["Groceries"]);

  const [identityProofType, setIdentityProofType] = useState("");
  const [identityProof, setIdentityProof] = useState(null);
  const [idProofSource, setIdProofSource] = useState("file");
  const [driveUrl, setDriveUrl] = useState("");

  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mobileNumber || !address || !city || !postalCode) {
      setError("Please fill in all personal details.");
      return;
    }
    
    let ageNum = age ? parseInt(age, 10) : null;
    if (!isVolunteer) {
      if (!age) {
        setError("Please enter your age.");
        return;
      }
      if (!isDisability && (isNaN(ageNum) || ageNum <= 58)) {
        setError("Not eligible: Senior Resident registration is allowed for individuals above 58 years of age only.");
        return;
      }
    }

    if (!isVolunteer && (!emergencyContactName || !emergencyContactPhone)) {
      setError("Please provide emergency contact info.");
      return;
    }
    if (!identityProofType) {
      setError("Please select an identity proof type.");
      return;
    }
    if (idProofSource === "file" && !identityProof) {
      setError("Please upload an identity proof file.");
      return;
    }
    if (idProofSource === "drive" && !driveUrl) {
      setError("Please enter a Google Drive link.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let response;
      if (idProofSource === "file" && identityProof) {
        const formData = new FormData();
        formData.append("id", user.id);
        formData.append("personalDetails", JSON.stringify({
          age: ageNum || 25,
          hasDisability: isVolunteer ? true : isDisability,
          mobileNumber: mobileNumber || user.phoneNumber || "",
          address,
          city,
          postalCode,
          identityProofType,
          emergencyContactName: isVolunteer ? undefined : emergencyContactName,
          emergencyContactPhone: isVolunteer ? undefined : emergencyContactPhone
        }));
        formData.append("latitude", lat);
        formData.append("longitude", lng);
        if (isVolunteer) {
          formData.append("skillTags", JSON.stringify(selectedSkills));
          formData.append("radiusPreference", radius);
        }
        formData.append("identityProof", identityProof);

        response = await fetch("/api/auth/complete-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer mock-${user.id}`
          },
          body: formData
        });
      } else {
        const payload = {
          id: user.id,
          personalDetails: JSON.stringify({
            age: ageNum || 25,
            hasDisability: isVolunteer ? true : isDisability,
            mobileNumber: mobileNumber || user.phoneNumber || "",
            address,
            city,
            postalCode,
            identityProofType,
            emergencyContactName: isVolunteer ? undefined : emergencyContactName,
            emergencyContactPhone: isVolunteer ? undefined : emergencyContactPhone
          }),
          age: ageNum || 25,
          hasDisability: isVolunteer ? true : isDisability,
          mobileNumber: mobileNumber || user.phoneNumber || "",
          address,
          city,
          postalCode,
          identityProofType,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          emergencyContact: isVolunteer ? undefined : { name: emergencyContactName, phone: emergencyContactPhone },
          skillTags: isVolunteer ? selectedSkills : undefined,
          radiusPreference: isVolunteer ? parseFloat(radius) : undefined,
          driveUrl: driveUrl || undefined,
          identityProofUrl: driveUrl || "uploaded-file-mock-url"
        };

        response = await fetch("/api/auth/complete-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer mock-${user.id}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();
      if (response.ok) {
        onComplete(data.user);
      } else {
        setError(data.error || "Failed to submit profile.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Header Nav */}
      <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
            <ShieldCheck size={22} />
          </div>
          <span>{t("appName")}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isVolunteer
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-indigo-50 text-indigo-700 border-indigo-200"
          }`}>
            {isVolunteer ? "🤝 Volunteer Profile" : "🏠 Senior Resident Profile"}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* Hero Title Container */}
        <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-full blur-2xl -z-10"></div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {t("completeProfileTitle")}
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-2 max-w-xl mx-auto">
            {t("completeProfileDesc")}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 shadow-xs">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 01: PERSONAL DETAILS */}
          <section className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold">
                <User size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase">
                  01 · Personal Details
                </span>
                <h2 className="text-lg font-black text-gray-900">Basic Information</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  {t("fullName")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.name}
                    disabled
                    readOnly
                    className="block w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 bg-gray-50/80 cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Check size={16} />
                  </div>
                </div>
              </div>

              {/* Age Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Age (Years) <span className="text-red-500">*</span>
                  </label>
                  {isVolunteer ? (
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                      Open to all ages
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold">
                      Must be 58+
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max="110"
                  required={!isVolunteer}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={isVolunteer ? "e.g. 23" : "e.g. 60"}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                />

                {/* Disability Toggle for Senior Residents */}
                {!isVolunteer && (
                  <div className="space-y-2 mt-2.5">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2.5">
                      <input
                        id="comp-disability"
                        type="checkbox"
                        checked={isDisability}
                        onChange={(e) => setIsDisability(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="comp-disability" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                        ♿ {t("personWithDisability")} <span className="text-gray-500 font-normal">(Age restriction waived)</span>
                      </label>
                    </div>

                    {age !== "" && !isDisability && parseInt(age, 10) <= 58 && (
                      <p className="text-xs text-red-600 font-bold mt-1">⚠️ Not eligible: Age must be above 58 years for Senior Residents.</p>
                    )}
                    {age !== "" && isDisability && parseInt(age, 10) <= 58 && (
                      <p className="text-xs text-emerald-700 font-bold mt-1">✅ Age restriction waived for Person with Disability.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Phone Number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  {t("phone")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Full Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. #42 3rd Main Street, Indiranagar"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bangalore"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Postal Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 560038"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                />
              </div>

              {/* Emergency Contact Info for Senior Residents */}
              {!isVolunteer && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Emergency Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="e.g. Son / Relative Name"
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      {t("emergencyContact")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="e.g. +91 98765 00000"
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all bg-white"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* SECTION 02: VOLUNTEER PREFERENCES */}
          {isVolunteer && (
            <section className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl font-bold">
                  <Compass size={20} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">
                    02 · Volunteer Preferences
                  </span>
                  <h2 className="text-lg font-black text-gray-900">Skills & Service Radius</h2>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase">
                      Preferred Travel Radius
                    </label>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                      Current: {radius} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400 font-semibold mt-1">
                    <span>1 km</span>
                    <span>5 km</span>
                    <span>10 km</span>
                    <span>15 km</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-3">
                    Assisted Skills & Services
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {["Groceries", "Fix something", "Phone/computer help", "Companionship", "Medical transport", "Gardening"].map((skill) => {
                      const active = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            active
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                              : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                          }`}
                        >
                          {active ? `✓ ${skill}` : `+ ${skill}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 03 / 02: NEIGHBORHOOD LOCATION */}
          <section className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold">
                <MapPin size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase">
                  {isVolunteer ? "03" : "02"} · Neighborhood Location
                </span>
                <h2 className="text-lg font-black text-gray-900">Pin Your Area</h2>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-inner bg-slate-50">
              <LocationPickerMap
                lat={lat}
                lng={lng}
                onLocationChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
                fetchLiveLocation={fetchLiveLocation}
                geoLoading={geoLoading}
                geoError={geoError}
              />
            </div>
          </section>

          {/* SECTION 04 / 03: IDENTITY PROOF DOCUMENT */}
          <section className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold">
                <FileCheck2 size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase">
                  {isVolunteer ? "04" : "03"} · Verification
                </span>
                <h2 className="text-lg font-black text-gray-900">Identity Proof Document</h2>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-3">
                  Select Document Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["Aadhaar Card", "Voter ID", "Passport", "Driving License"].map((type) => {
                    const active = identityProofType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setIdentityProofType(type);
                          if (error) setError("");
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-xs font-bold transition-all text-center cursor-pointer ${
                          active
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs ring-2 ring-indigo-500/20"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {identityProofType && (
                <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-4 animate-fade-in">
                  <label className="block text-xs font-bold text-gray-800 uppercase">
                    Provide Document ({identityProofType})
                  </label>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                      <input
                        type="radio"
                        name="idProofSource"
                        value="file"
                        checked={idProofSource === "file"}
                        onChange={() => setIdProofSource("file")}
                        className="accent-indigo-600"
                      />
                      <span>📁 Upload File (Image / PDF)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                      <input
                        type="radio"
                        name="idProofSource"
                        value="drive"
                        checked={idProofSource === "drive"}
                        onChange={() => setIdProofSource("drive")}
                        className="accent-indigo-600"
                      />
                      <span>🔗 Google Drive / Cloud Link</span>
                    </label>
                  </div>

                  {idProofSource === "file" ? (
                    <div>
                      <input
                        id="identity-file-input"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          setIdentityProof(e.target.files[0] || null);
                          if (error) setError("");
                        }}
                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer border border-gray-300 rounded-xl p-2 bg-white"
                      />
                      {identityProof && (
                        <p className="text-xs text-emerald-700 font-bold mt-2 flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                          <span>✓</span> Selected file: {identityProof.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        id="identity-drive-input"
                        type="url"
                        placeholder="https://drive.google.com/file/d/..."
                        value={driveUrl}
                        onChange={(e) => {
                          setDriveUrl(e.target.value);
                          if (error) setError("");
                        }}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 outline-none bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* SUBMIT BUTTON AREA */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <LockKeyhole size={16} className="text-emerald-600" />
              <span>Your profile details are stored securely and encrypted.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isSubmitting ? t("saving") : t("saveProfile")}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
