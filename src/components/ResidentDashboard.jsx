import React, { useState, useEffect } from "react";
import CompleteProfileForm from "./CompleteProfileForm";
import { Home, Plus, ArrowLeft, Send, CheckCircle2, Phone, Star, ShieldAlert, MessageCircle, Video, Mic } from "lucide-react";
import VideoCall from "./VideoCall.jsx";
import ChatPanel from "./ChatPanel.jsx";
import VoiceRequest from "./VoiceRequest.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function ResidentDashboard({ user, tasks, onReload, onLogout, socket }) {
  const { t } = useLanguage();
  if (user.verificationStatus === "incomplete") {
    return <CompleteProfileForm user={user} onComplete={(updatedUser) => window.location.reload()} />;
  }

  const [view, setView] = useState("home");
  const [selectedTask, setSelectedTask] = useState(null);

  // Form states (exactly 3 fields)
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("Medium");

  // Rating states
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [error, setError] = useState("");

  // Communication states
  const [showCall, setShowCall] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Join task rooms for assigned tasks
  useEffect(() => {
    if (!socket || !tasks || tasks.length === 0) return;

    const joinRooms = () => {
      tasks.forEach((task) => {
        if (task.status === "Assigned") {
          socket.emit("join-task", { taskId: task.id });
        }
      });
    };

    joinRooms();
    socket.on("connect", joinRooms);

    return () => {
      socket.off("connect", joinRooms);
      tasks.forEach((task) => {
        if (task.status === "Assigned") {
          socket.emit("leave-task", { taskId: task.id });
        }
      });
    };
  }, [socket, tasks]);

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    setView("create_step2");
  };

  const handleNextToUrgency = () => {
    if (!description.trim()) {
      setError("Please describe what you need help with.");
      return;
    }
    setError("");
    setView("create_step3");
  };

  const handleCreateTask = async () => {
    setSubmittingTask(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({ category, description, urgency })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      // Reset states
      setCategory("");
      setDescription("");
      setUrgency("Medium");
      setView("confirm");
      onReload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleCancelTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to cancel this request?")) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      if (response.ok) {
        setView("home");
        onReload();
      }
    } catch (err) {
      console.error(err);
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
        onReload();
        // Update selectedTask local view
        setSelectedTask((prev) => prev ? { ...prev, status: "Completed" } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlagTask = async (taskId) => {
    const reason = window.prompt("Reason for flagging this request/volunteer:");
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
        alert("Thank you. Admins have been notified and are reviewing this task.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    setSubmittingRating(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({
          taskId: selectedTask.id,
          score: ratingScore,
          comment: ratingComment
        })
      });

      if (response.ok) {
        setRatingSubmitted(true);
        setRatingComment("");
        setRatingScore(5);
        onReload();
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

  // Helper to determine urgency colors
  const getUrgencyBadgeClass = (urg) => {
    switch (urg) {
      case "High":
        return "bg-red-100 text-red-950 border border-red-300 font-bold px-3 py-1 rounded-full text-base";
      case "Medium":
        return "bg-orange-100 text-orange-950 border border-orange-300 font-bold px-3 py-1 rounded-full text-base";
      default:
        return "bg-green-100 text-green-950 border border-green-300 font-bold px-3 py-1 rounded-full text-base";
    }
  };

  return (
    <div className="bg-white min-h-[600px] rounded-2xl shadow-lg border border-gray-100 overflow-hidden" id="resident-dashboard">
      {/* 1. Header Banner */}
      <div className="bg-amber-600 px-6 py-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black font-sans leading-tight">{t("welcomeResident", { name: user.name })}</h2>
          <p className="text-amber-100 text-lg font-medium">{t("residentDashboardTitle")}</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-700/50 px-4 py-2 rounded-xl text-sm font-bold border border-amber-500/30">
          {t("statusLabel")}: {user.verificationStatus === "approved" ? t("verified") : t("unverified")}
        </div>
      </div>

      {/* 2. Main Area */}
      <div className="p-6 md:p-8">
        {/* VIEW A: HOME SCREEN */}
        {view === "home" &&
          <div className="space-y-8 animate-fade-in" id="res-view-home">
            {/* Primary Action Button */}
            <div className="flex justify-center py-4">
              {user.verificationStatus !== "approved" ?
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center max-w-xl space-y-3 shadow-inner">
                  <h3 className="text-xl font-bold text-amber-950">{t("unverified")}</h3>
                  <p className="text-base text-amber-900 font-medium">
                    Our local neighborhood team is verifying your details to protect community safety.
                  </p>
                </div> :

                <button
                  onClick={() => {
                    setError("");
                    setCategory("");
                    setDescription("");
                    setView("create_step1");
                  }}
                  className="w-full max-w-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-xl rounded-2xl py-6 px-8 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer min-h-[70px]"
                  id="btn-ask-help">

                  <Plus size={28} strokeWidth={3} />
                  <span>{t("createRequestBtn")}</span>
                </button>
              }
            </div>

            {/* List of Requests */}
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-gray-950 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-2">
                {t("myRequests")}
              </h3>

              {tasks.length === 0 ?
                <div className="text-center py-12 text-gray-500 text-lg font-bold">
                  {t("noRequestsYet")} {t("noRequestsDesc")}
                </div> :

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tasks.map((task) =>
                    <div key={task.id} className="space-y-2">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setRatingSubmitted(false);
                          setShowCall(false);
                          setChatOpen(false);
                          setView("details");
                        }}
                        className="w-full text-left bg-gray-50 hover:bg-amber-50/40 border border-gray-200 hover:border-amber-400 rounded-xl p-5 transition-all flex justify-between items-start gap-4 shadow-sm cursor-pointer">

                        <div className="space-y-2">
                          <span className="inline-block bg-amber-100 text-amber-950 font-bold px-3 py-0.5 rounded text-sm">
                            {task.category === "Groceries" ? t("catGroceries") : task.category === "Medicine & Pharmacy" ? t("catMedicine") : task.category === "Transportation" ? t("catTransportation") : task.category === "Household Help" ? t("catHousehold") : task.category === "Tech Support" ? t("catTech") : task.category === "Companionship" ? t("catCompanionship") : task.category}
                          </span>
                          <h4 className="text-lg font-bold text-gray-950 line-clamp-1">{task.description}</h4>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${task.status === "Pending" ? "bg-blue-50 text-blue-950 border-blue-200" :
                              task.status === "Assigned" ? "bg-amber-100 text-amber-950 border-amber-300 font-extrabold" :
                                task.status === "Completed" ? "bg-green-100 text-green-950 border-green-300" :
                                  "bg-gray-100 text-gray-600 border-gray-200"}`
                          }>
                            {task.status === "Pending" ? t("pendingStatus") :
                              task.status === "Assigned" ? t("inProgressStatus") :
                                task.status === "Completed" ? t("completedStatus") : task.status}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">{t("urgency")}: <strong className="text-gray-900">{task.urgency === "High" ? t("urgencyHigh") : task.urgency === "Medium" ? t("urgencyMedium") : t("urgencyLow")}</strong></span>
                        </div>
                      </button>

                      {task.status === "Assigned" && (
                        <div className="pt-1 flex items-center justify-end gap-2">
                          <VideoCall
                            socket={socket}
                            taskId={task.id}
                            userId={user.id}
                            userName={user.name}
                            remoteUserName={task.volunteerName || "Volunteer"}
                            onClose={() => {}}
                          />
                          <ChatPanel
                            socket={socket}
                            taskId={task.id}
                            userId={user.id}
                            userName={user.name}
                            userRole="resident"
                            remoteUserName={task.volunteerName || "Volunteer"}
                            isOpen={chatOpen}
                            onToggle={() => setChatOpen(!chatOpen)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            </div>
          </div>
        }

        {/* WIZARD STEP 1: CHOOSE CATEGORY */}
        {view === "create_step1" &&
          <div className="space-y-6 animate-fade-in" id="res-view-step1">
            <button
              onClick={() => setView("home")}
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-black text-lg focus:outline-none">

              <ArrowLeft size={22} strokeWidth={2.5} />
              <span>Go Back</span>
            </button>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-950">Step 1 of 3: What do you need help with?</h3>
              <p className="text-gray-600 text-lg">Tap on one of the large categories below:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <button
                onClick={() => handleSelectCategory("Groceries")}
                className="p-6 bg-amber-50 hover:bg-amber-100 text-amber-950 border-2 border-amber-200 hover:border-amber-400 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[120px]">

                <span className="text-3xl">🛒</span>
                <span className="text-xl font-bold">Groceries</span>
                <span className="text-sm font-medium text-amber-900">Buying food, medicine, or supplies</span>
              </button>

              <button
                onClick={() => handleSelectCategory("Fix something")}
                className="p-6 bg-amber-50 hover:bg-amber-100 text-amber-950 border-2 border-amber-200 hover:border-amber-400 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[120px]">

                <span className="text-3xl">💡</span>
                <span className="text-xl font-bold">Fix something</span>
                <span className="text-sm font-medium text-amber-900">Lightbulb, dripping tap, basic repairs</span>
              </button>

              <button
                onClick={() => handleSelectCategory("Phone/computer help")}
                className="p-6 bg-amber-50 hover:bg-amber-100 text-amber-950 border-2 border-amber-200 hover:border-amber-400 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[120px]">

                <span className="text-3xl">📱</span>
                <span className="text-xl font-bold">Phone/computer help</span>
                <span className="text-sm font-medium text-amber-900">Tech support, video calls, setting apps</span>
              </button>
            </div>
          </div>
        }

        {/* WIZARD STEP 2: ENTER DESCRIPTION — Now with Voice Request! */}
        {view === "create_step2" &&
          <div className="space-y-6 animate-fade-in" id="res-view-step2">
            <button
              onClick={() => setView("create_step1")}
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-black text-lg focus:outline-none">

              <ArrowLeft size={22} strokeWidth={2.5} />
              <span>Go Back</span>
            </button>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-950">Step 2 of 3: Describe what you need</h3>
              <p className="text-gray-600 text-lg">
                Type in simple words what we should fetch or fix for you, or use your voice:
              </p>
            </div>

            {error &&
              <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded text-base font-bold">
                ⚠️ {error}
              </div>
            }

            <div className="space-y-4 pt-2">
              {/* Voice Request Component */}
              <VoiceRequest
                onTranscript={(text) => setDescription(text)}
                currentText={description}
              />

              <textarea
                className="w-full border-2 border-gray-300 rounded-2xl p-5 text-lg font-medium text-gray-950 placeholder-gray-400 focus:border-amber-500 focus:outline-none min-h-[150px]"
                placeholder="e.g., 'Need help getting 2 liters of milk and a packet of bread from the corner store. I can pay by cash.'"
                value={description}
                onChange={(e) => setDescription(e.target.value)} />


              <button
                onClick={handleNextToUrgency}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xl rounded-2xl py-5 px-6 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[56px]">

                <span>CONTINUE</span>
              </button>
            </div>
          </div>
        }

        {/* WIZARD STEP 3: SELECT URGENCY */}
        {view === "create_step3" &&
          <div className="space-y-6 animate-fade-in" id="res-view-step3">
            <button
              onClick={() => setView("create_step2")}
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-black text-lg focus:outline-none">

              <ArrowLeft size={22} strokeWidth={2.5} />
              <span>Go Back</span>
            </button>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-950">Step 3 of 3: How urgent is this request?</h3>
              <p className="text-gray-600 text-lg">Choose the urgency level of your request:</p>
            </div>

            {error &&
              <div className="bg-red-50 border-l-4 border-red-500 text-red-950 p-4 rounded text-base font-bold">
                ⚠️ {error}
              </div>
            }

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setUrgency("Low")}
                className={`p-6 rounded-2xl border-2 font-black text-lg transition-all ${urgency === "Low" ?
                    "border-green-600 bg-green-50 text-green-950 shadow-sm" :
                    "border-gray-200 hover:border-gray-300 text-gray-700"}`
                }>

                🟢 Low Urgency
                <span className="block text-xs font-normal text-gray-500 mt-1">Can wait a few days</span>
              </button>

              <button
                type="button"
                onClick={() => setUrgency("Medium")}
                className={`p-6 rounded-2xl border-2 font-black text-lg transition-all ${urgency === "Medium" ?
                    "border-amber-600 bg-amber-50 text-amber-950 shadow-sm" :
                    "border-gray-200 hover:border-gray-300 text-gray-700"}`
                }>

                🟡 Medium Urgency
                <span className="block text-xs font-normal text-gray-500 mt-1">Needed within 24 hours</span>
              </button>

              <button
                type="button"
                onClick={() => setUrgency("High")}
                className={`p-6 rounded-2xl border-2 font-black text-lg transition-all ${urgency === "High" ?
                    "border-red-600 bg-red-50 text-red-950 shadow-sm" :
                    "border-gray-200 hover:border-gray-300 text-gray-700"}`
                }>

                🔴 High Urgency
                <span className="block text-xs font-normal text-gray-500 mt-1">Needed immediately today</span>
              </button>
            </div>

            <div className="pt-4">
              <button
                onClick={handleCreateTask}
                disabled={submittingTask}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xl rounded-2xl py-5 px-6 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[56px] disabled:opacity-50">

                <Send size={22} strokeWidth={2.5} />
                <span>{submittingTask ? "SENDING REQUEST..." : "SUBMIT MY REQUEST"}</span>
              </button>
            </div>
          </div>
        }

        {/* CONFIRMATION SCREEN */}
        {view === "confirm" &&
          <div className="text-center py-12 max-w-xl mx-auto space-y-6 animate-fade-in animate-scale-up" id="res-view-confirm">
            <div className="flex justify-center">
              <CheckCircle2 size={96} className="text-green-600" strokeWidth={1.5} />
            </div>
            <h3 className="text-3xl font-black text-gray-950 leading-tight">Request Sent Successfully!</h3>
            <p className="text-gray-700 text-lg leading-relaxed">
              Your request was broadcast to all volunteers nearby in our community.
              <strong> A nearby verified volunteer will claim it soon and call you on your phone.</strong>
            </p>
            <div className="pt-4">
              <button
                onClick={() => setView("home")}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-lg rounded-2xl py-5 px-8 shadow-sm transition-all cursor-pointer min-h-[56px]">

                RETURN HOME
              </button>
            </div>
          </div>
        }

        {/* VIEW: DETAILS PANEL */}
        {view === "details" && selectedTask &&
          <div className="space-y-6 animate-fade-in" id="res-view-details">
            <button
              onClick={() => {
                setSelectedTask(null);
                setShowCall(false);
                setChatOpen(false);
                setView("home");
              }}
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-black text-lg focus:outline-none">

              <ArrowLeft size={22} strokeWidth={2.5} />
              <span>Go Back to List</span>
            </button>

            <div className="border border-gray-200 rounded-2xl p-6 bg-gray-50/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-4">
                <div className="space-y-1">
                  <span className="bg-amber-100 text-amber-950 font-black px-3 py-1 rounded text-sm uppercase">
                    {selectedTask.category}
                  </span>
                  <h3 className="text-2xl font-black text-gray-950 pt-1">Task Help Request</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-black border ${selectedTask.status === "Pending" ? "bg-blue-50 text-blue-900 border-blue-200" :
                      selectedTask.status === "Assigned" ? "bg-amber-100 text-amber-950 border-amber-300" :
                        selectedTask.status === "Completed" ? "bg-green-100 text-green-950 border-green-300" :
                          "bg-gray-100 text-gray-600 border-gray-200"}`
                  }>
                    Status: {selectedTask.status}
                  </span>
                  <span className={getUrgencyBadgeClass(selectedTask.urgency)}>
                    Urgency: {selectedTask.urgency}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-bold text-gray-500 uppercase tracking-wider">What you requested:</span>
                <p className="text-gray-950 text-xl font-medium leading-relaxed bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                  {selectedTask.description}
                </p>
              </div>

              {/* Assigned volunteer details */}
              {selectedTask.status === "Assigned" &&
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 space-y-3">
                  <h4 className="text-xl font-black text-amber-950 flex items-center gap-2">
                    🤝 Neighbor Assigned to Help
                  </h4>
                  <p className="text-lg text-amber-900 font-medium">
                    Our neighborhood volunteer <strong>{selectedTask.volunteerName || "Alice Green"}</strong> is on the way!
                  </p>

                  {/* Trust indicator (FR-6.1 / FR-6.4) */}
                  <div className="flex items-center gap-1.5 text-amber-800 text-base font-bold bg-amber-100/50 py-1.5 px-3 rounded-lg w-fit">
                    <Star className="fill-amber-500 text-amber-500" size={18} />
                    <span>Volunteer Rating: {selectedTask.volunteerRatingAvg ? `${Number(selectedTask.volunteerRatingAvg).toFixed(1)} / 5.0` : "Verified New Helper"}</span>
                  </div>

                  {/* Communication buttons — Call & Chat */}
                  <div className="communication-actions-row">
                    {!showCall ? (
                      <VideoCall
                        socket={socket}
                        taskId={selectedTask.id}
                        userId={user.id}
                        userName={user.name}
                        remoteUserName={selectedTask.volunteerName || "Volunteer"}
                        onClose={() => setShowCall(false)}
                      />
                    ) : null}

                    <ChatPanel
                      socket={socket}
                      taskId={selectedTask.id}
                      userId={user.id}
                      userName={user.name}
                      userRole="resident"
                      remoteUserName={selectedTask.volunteerName || "Volunteer"}
                      isOpen={chatOpen}
                      onToggle={() => setChatOpen(!chatOpen)}
                    />
                  </div>

                  <div className="bg-white border border-amber-200 rounded-lg p-3.5 flex items-center gap-3 mt-2 shadow-sm">
                    <div className="bg-amber-100 text-amber-800 p-2.5 rounded-full">
                      <Phone size={24} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-500 uppercase">Neighbor's Proxy Phone Number</span>
                      <strong className="text-xl font-black text-amber-950 block">{selectedTask.maskedChannel?.proxyPhone || "+1 (555) 019-2849"}</strong>
                      <span className="text-sm text-gray-500 font-medium leading-tight block mt-0.5">Call this number to connect safely. Your real phone numbers are masked.</span>
                    </div>
                  </div>
                </div>
              }

              {/* Completed Rating Form (FR-6.1) */}
              {selectedTask.status === "Completed" &&
                <div className="bg-green-50/50 border-2 border-green-200 rounded-xl p-6 space-y-4">
                  <h4 className="text-xl font-black text-green-950 flex items-center gap-2">
                    🌟 Rate Your Helper neighbor
                  </h4>
                  {ratingSubmitted ?
                    <div className="bg-green-100 text-green-950 border border-green-300 p-4 rounded-xl text-base font-bold text-center">
                      Thank you! Your rating has been submitted to update your neighbor's trust rating.
                    </div> :

                    <form onSubmit={handleSubmitRating} className="space-y-4">
                      <p className="text-gray-700 text-base font-semibold">
                        How would you rate the volunteer who assisted you?
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((val) => {
                          const labels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
                          const active = ratingScore === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setRatingScore(val)}
                              className={`py-2 px-4 rounded-xl border-2 font-bold text-base transition-all flex items-center gap-1 ${active ?
                                  "border-green-600 bg-green-50 text-green-950 shadow-sm" :
                                  "border-gray-200 hover:border-gray-300 text-gray-700"}`
                              }>

                              <Star className={active ? "fill-green-600 text-green-600" : "text-gray-400"} size={18} />
                              <span>{val} ({labels[val - 1]})</span>
                            </button>);

                        })}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-sm font-bold text-gray-700" htmlFor="rater-comment">Optional comment:</label>
                        <textarea
                          id="rater-comment"
                          className="w-full border-2 border-gray-300 bg-white rounded-xl p-3 text-base text-gray-950 focus:border-green-500 focus:outline-none"
                          placeholder="e.g. Alice was extremely polite and brought the groceries very fast!"
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)} />

                      </div>

                      <button
                        type="submit"
                        disabled={submittingRating}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-base rounded-xl py-3 px-6 shadow transition-all disabled:opacity-50">

                        {submittingRating ? "Submitting..." : "Submit Rating"}
                      </button>
                    </form>
                  }
                </div>
              }

              {/* Actions Footer */}
              <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-200">
                {selectedTask.status === "Assigned" &&
                  <button
                    onClick={() => handleCompleteTask(selectedTask.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black text-xl rounded-2xl py-5 px-6 shadow transition-all flex items-center justify-center gap-2 min-h-[56px]">

                    <CheckCircle2 size={24} />
                    <span>MARK AS FULLY COMPLETED</span>
                  </button>
                }

                {(selectedTask.status === "Pending" || selectedTask.status === "Assigned") &&
                  <button
                    onClick={() => handleCancelTask(selectedTask.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 hover:border-red-400 font-bold text-lg rounded-2xl py-4 px-6 transition-all min-h-[56px]">

                    Cancel My Request
                  </button>
                }

                {/* Flag Content (Moderation) */}
                <button
                  onClick={() => handleFlagTask(selectedTask.id)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-red-600 font-bold hover:underline py-2 px-3 border border-dashed border-gray-200 hover:border-red-200 rounded-lg ml-auto">

                  <ShieldAlert size={14} />
                  <span>Report/Flag Issue</span>
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>);

}
