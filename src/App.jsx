import React, { useEffect, useState, useRef } from "react";
import { Bell, ChevronDown, HeartHandshake, LogOut } from "lucide-react";
import { io } from "socket.io-client";
import ResidentDashboard from "./components/ResidentDashboard.jsx";
import VolunteerDashboard from "./components/VolunteerDashboard.jsx";
import AdminConsole from "./components/AdminConsole.jsx";
import HomePage from "./components/HomePage.jsx";
import CompleteProfileForm from "./components/CompleteProfileForm.jsx";
import VideoCall from "./components/VideoCall.jsx";
import LanguageToggle from "./components/LanguageToggle.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";

export default function App() {
  const { t } = useLanguage();

  if (import.meta.env.DEV && window.location.search.includes("preview-profile")) {
    return <CompleteProfileForm user={{ id: "preview-user", name: "Maya", role: "volunteer", phoneNumber: "+91 98765 43210" }} onComplete={() => { }} />;
  }

  const [currentUser, setCurrentUser] = useState(null);
  const [residentTasks, setResidentTasks] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);

  // Global incoming call state
  const [incomingCall, setIncomingCall] = useState(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      autoConnect: true
    });

    socketInstance.on("connect", () => {
      console.log("[Socket.IO] Connected:", socketInstance.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("[Socket.IO] Disconnected");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Register user with socket when user changes
  useEffect(() => {
    if (socket && currentUser) {
      socket.emit("register", { userId: currentUser.id });
    }
  }, [socket, currentUser]);

  const fetchResidentTasks = async (userId) => {
    try {
      const response = await fetch("/api/tasks/my-tasks", {
        headers: { Authorization: `Bearer mock-${userId}` }
      });
      if (response.ok) {
        const data = await response.json();
        setResidentTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Error fetching resident tasks:", err);
    }
  };

  const fetchUserProfile = async (userId) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer mock-${userId}` }
      });
      if (!response.ok) throw new Error("We couldn't load your profile. Please try again.");

      const data = await response.json();
      setCurrentUser(data.user || null);
      if (data.user?.role === "resident") fetchResidentTasks(userId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUserId = localStorage.getItem("session_id");
    if (savedUserId) fetchUserProfile(savedUserId);
    else setLoading(false);
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === "resident") fetchResidentTasks(user.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("session_id");
    setShowProfileMenu(false);
    setCurrentUser(null);
    setResidentTasks([]);
    setError("");
    if (socket) {
      socket.disconnect();
    }
  };

  if (loading) {
    return (
      <div className="loading-screen" id="loading-spinner">
        <span className="loading-mark"><HeartHandshake size={24} /></span>
        <p>{t("loadingCommunity")}</p>
      </div>
    );
  }

  if (!currentUser) return <HomePage onAuthSuccess={handleAuthSuccess} />;

  const roleKey = currentUser.role === "admin" ? "operations" : currentUser.role === "volunteer" ? "volunteer" : "resident";
  const roleLabel = t(roleKey);

  return (
    <div className="app-shell" id="app-root">
      <header className="app-header">
        <div className="app-brand-wrap">
          <span className="app-brand-icon"><HeartHandshake size={18} /></span>
          <div className="app-brand">{t("appName")}</div>
          <span className="app-divider" />
          <span className="app-context">{t("spaceRole", { role: roleLabel })}</span>
        </div>

        <div className="app-user-actions">
          <LanguageToggle />
          <button type="button" className="header-icon" aria-label={t("notifications")}><Bell size={18} /></button>
          <div className="profile-control">
            <button
              type="button"
              className="profile-button"
              onClick={() => setShowProfileMenu((isOpen) => !isOpen)}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
            >
              <span className="profile-initial">{currentUser.name?.slice(0, 1)}</span>
              <span className="profile-name">{currentUser.name}</span>
              <ChevronDown size={15} />
            </button>
            {showProfileMenu && (
              <div className="profile-menu" role="menu">
                <p>{currentUser.email}</p>
                <button type="button" onClick={handleLogout} role="menuitem"><LogOut size={15} /> {t("signOut")}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-content">
        {error ? (
          <div className="connection-error">
            <h2>{t("unableToConnect")}</h2>
            <p>{error}</p>
            <button type="button" className="button-primary" onClick={() => fetchUserProfile(currentUser.id)}>{t("tryAgain")}</button>
          </div>
        ) : (
          <>
            {currentUser.role === "resident" && <ResidentDashboard user={currentUser} tasks={residentTasks} onReload={() => fetchResidentTasks(currentUser.id)} socket={socket} />}
            {currentUser.role === "volunteer" && <VolunteerDashboard user={currentUser} onReload={() => fetchUserProfile(currentUser.id)} socket={socket} />}
            {currentUser.role === "admin" && <AdminConsole user={currentUser} />}
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>{t("copyright")}</span>
        <span><i /> {t("secureCommunity")}</span>
      </footer>
    </div>
  );
}
