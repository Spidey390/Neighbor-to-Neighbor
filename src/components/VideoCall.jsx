import React, { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, PhoneIncoming } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export default function VideoCall({ socket, taskId, userId, userName, remoteUserName, onClose }) {
  const { t } = useLanguage();
  const [callState, setCallState] = useState("idle"); // idle | calling | incoming | connected | ended
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callMode, setCallMode] = useState("video"); // video | audio
  const [incomingCallerName, setIncomingCallerName] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const timerRef = useRef(null);

  // Format call duration
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Process queued ICE candidates after setRemoteDescription
  const processPendingCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type && pendingCandidatesRef.current.length > 0) {
      console.log(`[WebRTC] Flushing ${pendingCandidatesRef.current.length} queued ICE candidates`);
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }
    }
  };

  // Clean up everything
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  // Sync streams to video/audio elements whenever state or mode updates
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
    if (remoteStreamRef.current) {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [callState, callMode]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("ice-candidate", {
          taskId,
          candidate: event.candidate,
          senderId: userId
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received:", event.track.kind);
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setCallState("connected");
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.log("[WebRTC] Connection state failed/disconnected, terminating call");
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, taskId, userId]);

  // Ensure we are in the task room
  useEffect(() => {
    if (socket && taskId) {
      socket.emit("join-task", { taskId });
      console.log(`[VideoCall] Ensuring joined task room: task-${taskId}`);
    }
  }, [socket, taskId]);

  // Start outgoing call
  const startCall = async (mode = "video") => {
    setCallMode(mode);
    setCallState("calling");
    setCallDuration(0);

    try {
      const constraints = {
        audio: true,
        video: mode === "video"
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log(`[WebRTC] Sending call-offer for task ${taskId}`);
      socket.emit("call-offer", {
        taskId,
        offer,
        callerId: userId,
        callerName: userName,
        mode
      });
    } catch (err) {
      console.error("Error starting call:", err);
      setCallState("idle");
      cleanup();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    const offer = pendingOfferRef.current;
    const mode = callMode || "video";

    if (!offer) {
      console.error("[WebRTC] No pending offer to accept");
      setCallState("idle");
      return;
    }

    setCallState("connected");
    setCallDuration(0);

    try {
      const constraints = {
        audio: true,
        video: mode === "video"
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log(`[WebRTC] Sending call-answer for task ${taskId}`);
      socket.emit("call-answer", {
        taskId,
        answer,
        answererId: userId
      });
    } catch (err) {
      console.error("Error accepting call:", err);
      setCallState("idle");
      cleanup();
    }
  };

  // Decline incoming call
  const declineCall = useCallback(() => {
    if (socket) {
      socket.emit("call-end", { taskId, senderId: userId });
    }
    pendingOfferRef.current = null;
    setCallState("idle");
  }, [socket, taskId, userId]);

  // End active call
  const endCall = useCallback(() => {
    if (socket) {
      socket.emit("call-end", { taskId, senderId: userId });
    }
    cleanup();
    setCallState("ended");
    setTimeout(() => {
      setCallState("idle");
      if (onClose) onClose();
    }, 1500);
  }, [socket, taskId, userId, cleanup, onClose]);

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Socket event listeners — single source of truth for this task's call events
  useEffect(() => {
    if (!socket || !taskId) return;

    const handleIncomingCall = ({ offer, callerName, callerId, mode }) => {
      // Don't handle our own call offers (shouldn't happen with socket.to(), but just in case)
      if (callerId === userId) return;
      // Don't interrupt an active call
      if (callState === "calling" || callState === "connected") return;

      console.log(`[WebRTC] Incoming call from ${callerName} (${callerId}) for task ${taskId}`);
      pendingOfferRef.current = offer;
      setIncomingCallerName(callerName || remoteUserName || "Neighbor");
      setCallMode(mode || "video");
      setCallState("incoming");
    };

    const handleCallAnswer = async ({ answer }) => {
      console.log(`[WebRTC] Received call-answer for task ${taskId}`);
      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          await processPendingCandidates();
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleCallEnd = () => {
      console.log(`[WebRTC] Remote side ended call for task ${taskId}`);
      cleanup();
      setCallState("ended");
      setTimeout(() => {
        setCallState("idle");
        if (onClose) onClose();
      }, 1500);
    };

    socket.on(`call-offer-${taskId}`, handleIncomingCall);
    socket.on(`call-answer-${taskId}`, handleCallAnswer);
    socket.on(`ice-candidate-${taskId}`, handleIceCandidate);
    socket.on(`call-end-${taskId}`, handleCallEnd);

    console.log(`[VideoCall] Listeners registered for task ${taskId}`);

    return () => {
      socket.off(`call-offer-${taskId}`, handleIncomingCall);
      socket.off(`call-answer-${taskId}`, handleCallAnswer);
      socket.off(`ice-candidate-${taskId}`, handleIceCandidate);
      socket.off(`call-end-${taskId}`, handleCallEnd);
      console.log(`[VideoCall] Listeners removed for task ${taskId}`);
    };
  }, [socket, taskId, userId, remoteUserName, callState, cleanup, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ===== INCOMING CALL STATE — Show Accept/Decline =====
  if (callState === "incoming") {
    return (
      <div className="call-overlay" id="incoming-call-overlay" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "white", maxWidth: 400 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "linear-gradient(135deg, #059669, #10b981)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 44, fontWeight: 900,
              boxShadow: "0 0 0 8px rgba(16,185,129,0.3), 0 0 0 16px rgba(16,185,129,0.15)",
              animation: "pulse 1.5s ease-in-out infinite"
            }}>
              {(incomingCallerName || remoteUserName || "N")[0].toUpperCase()}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>
              {incomingCallerName || remoteUserName || "Neighbor"}
            </h2>
            <p style={{ fontSize: 16, opacity: 0.8, margin: 0 }}>
              Incoming {callMode === "video" ? "Video" : "Voice"} Call...
            </p>
          </div>

          <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
            <button
              type="button"
              onClick={acceptCall}
              style={{
                background: "#059669", border: "none", color: "white",
                padding: "16px 32px", borderRadius: 50, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 16, fontWeight: 700,
                boxShadow: "0 4px 15px rgba(5,150,105,0.5)",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            >
              <PhoneIncoming size={24} />
              Accept
            </button>
            <button
              type="button"
              onClick={declineCall}
              style={{
                background: "#dc2626", border: "none", color: "white",
                padding: "16px 32px", borderRadius: 50, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 16, fontWeight: 700,
                boxShadow: "0 4px 15px rgba(220,38,38,0.5)"
              }}
            >
              <PhoneOff size={24} />
              Decline
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.85; }
          }
        `}</style>
      </div>
    );
  }

  // ===== IDLE STATE — Show call buttons =====
  if (callState === "idle") {
    return (
      <div className="call-buttons-row" id="call-buttons">
        <button
          type="button"
          className="call-btn call-btn-audio"
          onClick={() => startCall("audio")}
        >
          <Phone size={18} />
          <span>{t("startVoiceCall")}</span>
        </button>
        <button
          type="button"
          className="call-btn call-btn-video"
          onClick={() => startCall("video")}
        >
          <Video size={18} />
          <span>{t("startVideoCall")}</span>
        </button>
      </div>
    );
  }

  // ===== ACTIVE CALL OVERLAY (calling / connected / ended) =====
  return (
    <div className="call-overlay" id="active-call-overlay">
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      <div className="call-fullscreen">
        <div className="call-remote-video-wrap">
          {callMode === "video" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="call-remote-video"
            />
          ) : (
            <div className="call-audio-avatar">
              <div className="call-audio-avatar-circle">
                <span>{((incomingCallerName || remoteUserName || "N")[0]).toUpperCase()}</span>
              </div>
              <p className="call-audio-name">{incomingCallerName || remoteUserName || "Neighbor"}</p>
            </div>
          )}
        </div>

        {callMode === "video" && (
          <div className="call-local-video-wrap">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="call-local-video"
            />
          </div>
        )}

        <div className="call-status-bar">
          {callState === "calling" && (
            <span className="call-status-text call-status-calling">
              <span className="call-pulse-dot"></span>
              {t("calling")} {remoteUserName || "neighbor"}...
            </span>
          )}
          {callState === "connected" && (
            <span className="call-status-text call-status-connected">
              <span className="call-connected-dot"></span>
              {formatDuration(callDuration)}
            </span>
          )}
          {callState === "ended" && (
            <span className="call-status-text call-status-ended">
              {t("endCall")}
            </span>
          )}
        </div>

        <div className="call-controls">
          <button
            type="button"
            className={`call-control-btn ${isMuted ? "call-control-active" : ""}`}
            onClick={toggleMute}
            aria-label={isMuted ? t("unmuteMic") : t("muteMic")}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {callMode === "video" && (
            <button
              type="button"
              className={`call-control-btn ${isVideoOff ? "call-control-active" : ""}`}
              onClick={toggleVideo}
              aria-label={t("toggleCamera")}
            >
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          <button
            type="button"
            className="call-control-btn call-control-end"
            onClick={endCall}
            aria-label={t("endCall")}
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
