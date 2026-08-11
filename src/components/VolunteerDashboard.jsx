import React, { useState, useEffect } from "react";
import CompleteProfileForm from "./CompleteProfileForm";
import { Star, ShieldAlert, Phone, CheckCircle2, Compass, MapPin, Search, Check, RefreshCw, MessageCircle, Video } from "lucide-react";
import { SKILL_OPTIONS } from "./RegisterModal.jsx";
import VideoCall from "./VideoCall.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";




export default function VolunteerDashboard({ user, onReload, socket }) {
  const { t } = useLanguage();

    if (user.verificationStatus === "incomplete") {
    return <CompleteProfileForm user={user} onComplete={(updatedUser) => window.location.reload()} />;
  }

  const [feed, setFeed] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("feed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Profile preferences state
  const [selectedSkills, setSelectedSkills] = useState(user.skillTags || []);
  const [radius, setRadius] = useState(String(user.location?.radiusPreference || "10"));
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  // Rating state
  const [ratingTaskId, setRatingTaskId] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Detail view modal
  const [selectedTask, setSelectedTask] = useState(null);

  // Communication states
  const [chatOpenTaskId, setChatOpenTaskId] = useState(null);

  // Join task rooms for claimed tasks
  useEffect(() => {
    if (!socket || !myTasks || myTasks.length === 0) return;

    const joinRooms = () => {
      myTasks.forEach((task) => {
        if (task.status === "Assigned") {
          socket.emit("join-task", { taskId: task.id });
        }
      });
    };

    joinRooms();
    socket.on("connect", joinRooms);

    return () => {
      socket.off("connect", joinRooms);
      myTasks.forEach((task) => {
        if (task.status === "Assigned") {
          socket.emit("leave-task", { taskId: task.id });
        }
      });
    };
  }, [socket, myTasks]);

  const fetchFeedAndClaims = async () => {
    if (user.verificationStatus !== "approved") return;
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Feed
      const feedRes = await fetch("/api/tasks/feed", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const feedData = await feedRes.json();
      if (feedRes.ok) {
        setFeed(feedData.feed || []);
      } else {
        setError(feedData.error || "Failed to load feed");
      }

      // 2. Fetch My Claimed Tasks
      const myRes = await fetch("/api/tasks/my-tasks", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const myData = await myRes.json();
      if (myRes.ok) {
        setMyTasks(myData.tasks || []);
      }
    } catch (err) {
      setError("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedAndClaims();

    if (!socket) return;
    const handleRefresh = () => {
      fetchFeedAndClaims();
    };

    socket.on("task-released", handleRefresh);
    socket.on("task-claimed", handleRefresh);

    return () => {
      socket.off("task-released", handleRefresh);
      socket.off("task-claimed", handleRefresh);
    };
  }, [user.id, socket]);

  const handleClaimTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to claim this task? Please ensure you are available to assist now.")) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });

      const data = await response.json();
      if (response.ok) {
        alert("Task claimed successfully!");
        setSelectedTask(null);
        fetchFeedAndClaims();
        onReload();
        if (socket) {
          socket.emit("task-claimed", { taskId });
        }
      } else {
        alert(data.error || "Failed to claim task");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleReleaseTask = async (taskId) => {
    if (!window.confirm(t("confirmReleaseTask") || "Emergency: Are you sure you want to cancel this claim? The task will be redirected to surrounding nearby volunteers.")) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/release`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("Non-JSON response:", text);
      }

      if (response.ok) {
        alert(t("taskReleasedSuccess") || "Claim cancelled. Request redirected to surrounding volunteers!");
        fetchFeedAndClaims();
        onReload();
        if (socket) {
          socket.emit("task-released", { taskId });
        }
      } else {
        alert(data.error || "Failed to release task. Please restart the backend server.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleCompleteTask = async (taskId) => {
    if (!window.confirm("Mark this task as fully completed?")) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      if (response.ok) {
        alert("Task marked completed successfully!");
        fetchFeedAndClaims();
        onReload();
        // Trigger rating modal
        setRatingTaskId(taskId);
        setRatingSubmitted(false);
        setRatingComment("");
        setRatingScore(5);
        setActiveTab("my-tasks");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to complete task");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlagTask = async (taskId) => {
    const reason = window.prompt("Reason for flagging this request/resident:");
    if (!reason) return;
    try {
      const response = await fetch("/api/admin/flags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({ targetType: "task", targetId: String(taskId), reason })
      });
      if (response.ok) {
        alert("Thank you. Admins have been notified and are reviewing this request.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/ratings/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({
          skillTags: selectedSkills,
          radiusPreference: parseFloat(radius)
        })
      });

      if (response.ok) {
        setProfileMessage("✅ Preferences saved successfully!");
        fetchFeedAndClaims();
        onReload();
      } else {
        const data = await response.json();
        setProfileMessage("❌ Error: " + data.error);
      }
    } catch (err) {
      setProfileMessage("❌ Error: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!ratingTaskId) return;

    setSubmittingRating(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({
          taskId: ratingTaskId,
          score: ratingScore,
          comment: ratingComment
        })
      });

      if (response.ok) {
        setRatingSubmitted(true);
        setRatingTaskId(null);
        fetchFeedAndClaims();
        alert("Thank you! Rating submitted successfully.");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit rating");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="bg-white min-h-[600px] rounded-2xl shadow-lg border border-gray-100 overflow-hidden" id="volunteer-dashboard">
      {/* 1. Header Banner */}
      <div className="bg-emerald-700 px-6 py-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black font-sans leading-tight">{t("volunteerDashboardTitle")}</h2>
          <p className="text-emerald-100 text-lg font-medium">{t("volunteerDashboardSubtitle")}</p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
          {/* Trust rating indicator */}
          <div className="flex items-center gap-1.5 bg-emerald-800 text-white font-bold px-3 py-2 rounded-xl text-sm border border-emerald-600/50">
            <Star className="fill-yellow-400 text-yellow-400" size={16} />
            <span>{t("rating")}: {user.ratingAvg ? `${Number(user.ratingAvg).toFixed(1)} / 5.0` : t("newHelper")}</span>
          </div>
          <div className="bg-emerald-800/50 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-600/30 text-center">
            {t("statusLabel")}: {user.verificationStatus === "approved" ? t("verified") : t("unverified")}
          </div>
        </div>
      </div>

      {user.verificationStatus !== "approved" ?
      <div className="p-8 text-center max-w-xl mx-auto space-y-4 my-12 bg-amber-50 rounded-2xl border border-amber-200">
          <h3 className="text-2xl font-bold text-amber-950">{t("unverified")}</h3>
          <p className="text-base text-amber-900 leading-relaxed font-medium">
            To ensure the absolute safety and comfort of our community's senior citizens, 
            every volunteer must be manually verified by a coordinator before unlocking access to localized requests.
          </p>
        </div> :

      <>
          {/* 2. Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50/50 px-6 pt-3 gap-2">
            <button
            onClick={() => setActiveTab("feed")}
            className={`py-3 px-4 font-black text-base border-b-4 transition-all flex items-center gap-2 ${
            activeTab === "feed" ?
            "border-emerald-600 text-emerald-950" :
            "border-transparent text-gray-500 hover:text-gray-900"}`
            }>
              <Compass size={18} />
              <span>{t("availableTasks")} ({feed.length})</span>
            </button>

            <button
            onClick={() => setActiveTab("my-tasks")}
            className={`py-3 px-4 font-black text-base border-b-4 transition-all flex items-center gap-2 ${
            activeTab === "my-tasks" ?
            "border-emerald-600 text-emerald-950" :
            "border-transparent text-gray-500 hover:text-gray-900"}`
            }>
              <CheckCircle2 size={18} />
              <span>{t("myAcceptedTasks")} ({myTasks.length})</span>
            </button>

            <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 px-4 font-black text-base border-b-4 transition-all flex items-center gap-2 ${
            activeTab === "profile" ?
            "border-emerald-600 text-emerald-950" :
            "border-transparent text-gray-500 hover:text-gray-900"}`
            }>
              {t("preferences")}
            </button>

            <button
            onClick={fetchFeedAndClaims}
            disabled={loading}
            className="ml-auto py-2 px-3 bg-white border border-gray-200 text-gray-700 hover:text-emerald-800 rounded-lg hover:border-emerald-300 transition-colors flex items-center gap-1 text-sm font-bold self-center mb-2 shadow-sm"
            aria-label={t("refresh")}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>{t("refresh")}</span>
            </button>
          </div>

          <div className="p-6 md:p-8">
            {/* TAB 1: FEED OF AVAILABLE REQUESTS */}
            {activeTab === "feed" &&
          <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <p className="text-emerald-950 text-sm font-bold">
                    {t("radiusFeedMsg", { radius })}
                  </p>
                  <p className="text-xs text-emerald-800 font-medium">
                    {t("privatePrivacyMsg")}
                  </p>
                </div>

                {feed.length === 0 ?
            <div className="text-center py-16 text-gray-400 font-bold text-lg space-y-2 bg-gray-50 border border-dashed rounded-2xl">
                    <p>{t("noAvailableTasks")}</p>
                  </div> :

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feed.map((task) =>
              <div
                key={task.id}
                className={`bg-white border-2 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative ${
                task.isSkillMatch ? "border-emerald-500/40" : "border-gray-200"}`
                }>
                
                        {task.isSkillMatch &&
                <span className="absolute top-3 right-3 bg-emerald-100 text-emerald-950 font-black text-xs py-1 px-2.5 rounded-full uppercase border border-emerald-300 tracking-wider">
                            ⭐ {t("skillMatch")}
                          </span>
                }

                        <div className="space-y-1">
                          <span className="inline-block bg-gray-100 text-gray-800 font-extrabold px-2.5 py-0.5 rounded text-xs uppercase">
                            {task.category === "Groceries" ? t("catGroceries") : task.category === "Medicine & Pharmacy" ? t("catMedicine") : task.category === "Transportation" ? t("catTransportation") : task.category === "Household Help" ? t("catHousehold") : task.category === "Tech Support" ? t("catTech") : task.category === "Companionship" ? t("catCompanionship") : task.category}
                          </span>
                          <h4 className="text-lg font-black text-gray-950">{task.description}</h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold border-t border-gray-100 pt-3 text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin size={15} className="text-emerald-600" />
                            <strong>{t("awayKm", { dist: task.distance })}</strong>
                          </span>
                          <span>{t("urgency")}: <strong className={task.urgency === "High" ? "text-red-700 font-bold" : "text-gray-950"}>{task.urgency === "High" ? t("urgencyHigh") : task.urgency === "Medium" ? t("urgencyMedium") : t("urgencyLow")}</strong></span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                    onClick={() => setSelectedTask(task)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all">
                            {t("viewDetails")}
                          </button>
                          <button
                    onClick={() => handleClaimTask(task.id)}
                    className="flex-1 py-3 px-4 bg-white hover:bg-gray-100 text-emerald-950 border border-emerald-600 font-black text-sm rounded-xl transition-all">
                            {t("quickClaim")}
                          </button>
                        </div>
                      </div>
              )}
                  </div>
            }
              </div>
          }

            {/* TAB 2: MY CLAIMED TASKS */}
            <div style={{ display: activeTab === "my-tasks" ? "block" : "none" }} className="space-y-6">
                {myTasks.length === 0 ?
            <div className="text-center py-16 text-gray-400 font-bold text-lg bg-gray-50 border border-dashed rounded-2xl">
                    You have no active claims. Go to the "Available Tasks Nearby" tab to claim!
                  </div> :

            <div className="space-y-4">
                    {myTasks.map((task) =>
              <div key={task.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                          <div className="space-y-1">
                            <span className="bg-emerald-100 text-emerald-950 font-extrabold px-2.5 py-0.5 rounded text-xs uppercase">
                              {task.category === "Groceries" ? t("catGroceries") : task.category === "Medicine & Pharmacy" ? t("catMedicine") : task.category === "Transportation" ? t("catTransportation") : task.category === "Household Help" ? t("catHousehold") : task.category === "Tech Support" ? t("catTech") : task.category === "Companionship" ? t("catCompanionship") : task.category}
                            </span>
                            <h4 className="text-xl font-bold text-gray-950">{t("myAcceptedTasks")}</h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${
                    task.status === "Assigned" ? "bg-amber-100 text-amber-950 border-amber-300 font-extrabold" :
                    task.status === "Completed" ? "bg-green-100 text-green-950 border-green-300" :
                    "bg-gray-100 text-gray-600"}`
                    }>
                              {task.status === "Assigned" ? t("inProgressStatus") : task.status === "Completed" ? t("completedStatus") : task.status}
                            </span>
                            <span className="bg-gray-200 text-gray-800 text-xs font-bold px-2.5 py-0.5 rounded">
                              {t("urgency")}: {task.urgency === "High" ? t("urgencyHigh") : task.urgency === "Medium" ? t("urgencyMedium") : t("urgencyLow")}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="block text-xs font-bold text-gray-500 uppercase">{t("descriptionLabel")}</span>
                          <p className="text-gray-950 text-base font-medium leading-relaxed bg-white border border-gray-100 p-4 rounded-xl">
                            "{task.description}"
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                            <span className="block text-xs font-bold text-gray-500 uppercase">{t("resident")}</span>
                            <strong className="text-base text-gray-950 block">{task.residentName || t("resident")}</strong>
                          </div>

                          {task.status === "Assigned" &&
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 flex flex-col justify-center">
                              <span className="block text-xs font-bold text-emerald-800 uppercase">{t("phone")}</span>
                              <div className="flex items-center gap-2">
                                <Phone size={18} className="text-emerald-800" />
                                <strong className="text-lg font-black text-emerald-950">{task.maskedChannel?.proxyPhone || "+1 (555) 019-4829"}</strong>
                              </div>
                            </div>
                  }
                        </div>

                        {/* Resident Home Map Location & Google Maps Navigation Link */}
                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
                                <MapPin size={18} className="text-emerald-700 shrink-0" />
                                <span>{t("residentHomeLocation")}</span>
                              </div>
                              {task.location?.address && (
                                <p className="text-xs text-emerald-900 font-medium mt-0.5 ml-6">{task.location.address}</p>
                              )}
                            </div>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude || task.location?.latitude || 12.9716},${task.longitude || task.location?.longitude || 77.5946}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition-all shrink-0 hover:scale-[1.02] cursor-pointer"
                              id={`google-maps-btn-${task.id}`}
                            >
                              <Compass size={16} />
                              <span>{t("openInGoogleMaps")}</span>
                            </a>
                          </div>

                          {/* Interactive / Clickable Map Preview */}
                          <div 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${task.latitude || task.location?.latitude || 12.9716},${task.longitude || task.location?.longitude || 77.5946}`, '_blank')}
                            className="relative h-44 w-full rounded-xl overflow-hidden border border-emerald-300 shadow-inner group cursor-pointer"
                            title={t("clickMapToNavigate")}
                          >
                            <iframe
                              title={`Map location for ${task.residentName || 'Resident'}`}
                              width="100%"
                              height="100%"
                              frameBorder="0"
                              scrolling="no"
                              src={`https://maps.google.com/maps?q=${task.latitude || task.location?.latitude || 12.9716},${task.longitude || task.location?.longitude || 77.5946}&z=15&output=embed`}
                              className="pointer-events-none w-full h-full"
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors flex items-end p-2.5 bg-gradient-to-t from-black/70 via-transparent to-transparent">
                              <span className="text-white text-xs font-bold flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-xs shadow group-hover:bg-emerald-700 transition-colors">
                                <Compass size={14} className="text-emerald-400" />
                                <span>{t("clickMapToNavigate")}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Communication: Call & Chat buttons for assigned tasks */}
                        {task.status === "Assigned" &&
                <div className="communication-actions-row border-t border-gray-200 pt-4">
                            <VideoCall
                              socket={socket}
                              taskId={task.id}
                              userId={user.id}
                              userName={user.name}
                              remoteUserName={task.residentName || t("resident")}
                              onClose={() => {}}
                            />
                            <ChatPanel
                              socket={socket}
                              taskId={task.id}
                              userId={user.id}
                              userName={user.name}
                              userRole="volunteer"
                              remoteUserName={task.residentName || t("resident")}
                              isOpen={chatOpenTaskId === task.id}
                              onToggle={() => setChatOpenTaskId(chatOpenTaskId === task.id ? null : task.id)}
                            />
                          </div>
                }

                        {task.status === "Assigned" &&
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-200">
                            <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-xl shadow transition-all flex items-center justify-center gap-2">
                              <CheckCircle2 size={18} />
                              <span>{t("markCompleted")}</span>
                            </button>

                            <button
                    onClick={() => handleReleaseTask(task.id)}
                    className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm">
                              <ShieldAlert size={16} />
                              <span>{t("cancelClaim")}</span>
                            </button>
                          </div>
                }
                      </div>
              )}
                  </div>
            }
              </div>
          </div>

            {/* TAB 3: VOLUNTEER PREFERENCES PROFILE SETUP */}
            {activeTab === "profile" &&
          <form onSubmit={handleSaveProfile} className="max-w-xl mx-auto space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-gray-950">{t("preferences")}</h3>
                </div>

                {profileMessage &&
            <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-950 p-4 rounded text-base font-bold">
                    {profileMessage}
                  </div>
            }

                {/* Preferences Field 1: Skills tags multi-select */}
                <div className="space-y-2">
                  <span className="block text-base font-bold text-gray-800">{t("preferences")}</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SKILL_OPTIONS.map((skill) => {
                  const active = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`py-3 px-5 rounded-xl border-2 font-black text-base transition-all flex items-center gap-1.5 ${
                      active ?
                      "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm" :
                      "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"}`
                      }>
                          {active && <Check size={18} className="text-emerald-700" strokeWidth={3} />}
                          <span>{skill === "Groceries" ? t("catGroceries") : skill === "Medicine & Pharmacy" ? t("catMedicine") : skill === "Transportation" ? t("catTransportation") : skill === "Household Help" ? t("catHousehold") : skill === "Tech Support" ? t("catTech") : skill === "Companionship" ? t("catCompanionship") : skill}</span>
                        </button>);

                })}
                  </div>
                </div>

                {/* Preferences Field 2: Radius filter preference */}
                <div className="space-y-2 pt-2">
                  <label className="block text-base font-bold text-gray-800" htmlFor="pref-radius">
                    {t("radiusFeedMsg", { radius })}
                  </label>
                  <input
                id="pref-radius"
                type="range"
                min="1"
                max="15"
                step="0.5"
                className="w-full accent-emerald-600 mt-2 cursor-pointer"
                value={radius}
                onChange={(e) => setRadius(e.target.value)} />
              
                  <div className="flex justify-between text-xs font-mono text-gray-500">
                    <span>1 km</span>
                    <span>15 km</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-xl shadow transition-all disabled:opacity-50">
                  {profileSaving ? t("saving") : t("saveProfile")}
                </button>
              </form>
            }
          </>
        }

      {/* 3. Detailed Modal overlay */}
      {selectedTask &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-fade-in my-8 border border-gray-100">
            <div className="bg-emerald-700 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="text-lg font-black">{selectedTask.category === "Groceries" ? t("catGroceries") : selectedTask.category === "Medicine & Pharmacy" ? t("catMedicine") : selectedTask.category === "Transportation" ? t("catTransportation") : selectedTask.category === "Household Help" ? t("catHousehold") : selectedTask.category === "Tech Support" ? t("catTech") : selectedTask.category === "Companionship" ? t("catCompanionship") : selectedTask.category}</h3>
              <button
              onClick={() => setSelectedTask(null)}
              className="text-white/80 hover:text-white transition-colors text-2xl font-bold focus:outline-none">
                ×
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <span className="block text-xs font-bold text-gray-400 uppercase">{t("descriptionLabel")}</span>
                <p className="text-lg text-gray-950 font-medium leading-relaxed">
                  "{selectedTask.description}"
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500 font-semibold">{t("urgency")}:</span>
                  <span className="text-gray-900 font-bold">{selectedTask.urgency === "High" ? t("urgencyHigh") : selectedTask.urgency === "Medium" ? t("urgencyMedium") : t("urgencyLow")}</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500 font-semibold">{t("locationLabel")}:</span>
                  <span className="text-gray-900 font-bold">{t("awayKm", { dist: selectedTask.distance })}</span>
                </div>

                {/* Google Maps Location Preview & Link */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 space-y-2.5 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                      <MapPin size={16} className="text-emerald-700" />
                      <span>{t("residentHomeLocation")}</span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.latitude || selectedTask.location?.latitude || 12.9716},${selectedTask.longitude || selectedTask.location?.longitude || 77.5946}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-lg shadow-sm"
                    >
                      <Compass size={14} />
                      <span>{t("openInGoogleMaps")}</span>
                    </a>
                  </div>
                  <div 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.latitude || selectedTask.location?.latitude || 12.9716},${selectedTask.longitude || selectedTask.location?.longitude || 77.5946}`, '_blank')}
                    className="relative h-36 w-full rounded-lg overflow-hidden border border-emerald-300 shadow-inner group cursor-pointer"
                    title={t("clickMapToNavigate")}
                  >
                    <iframe
                      title={`Map location preview`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://maps.google.com/maps?q=${selectedTask.latitude || selectedTask.location?.latitude || 12.9716},${selectedTask.longitude || selectedTask.location?.longitude || 77.5946}&z=15&output=embed`}
                      className="pointer-events-none w-full h-full"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors flex items-end p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <span className="text-white text-[11px] font-bold flex items-center gap-1 bg-black/60 px-2 py-1 rounded">
                        🧭 {t("clickMapToNavigate")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                onClick={() => setSelectedTask(null)}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-xl transition-all">
                  {t("close")}
                </button>
                <button
                onClick={() => handleClaimTask(selectedTask.id)}
                className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all">
                  {t("acceptTask")}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      {/* 4. Complete-Task rating overlay */}
      {ratingTaskId &&
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in p-6 space-y-4">
            <h4 className="text-xl font-black text-emerald-950 flex items-center gap-2">
              🌟 {t("rating")}
            </h4>
            <div className="flex gap-2 pt-2">
              <button
              type="button"
              onClick={() => setRatingTaskId(null)}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-xl">
                {t("close")}
              </button>
              <button
              type="submit"
              disabled={submittingRating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl py-2.5 px-4 shadow transition-all disabled:opacity-50">
                {t("send")}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}
