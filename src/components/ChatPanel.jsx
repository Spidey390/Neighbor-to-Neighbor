import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function ChatPanel({ socket, taskId, userId, userName, userRole, remoteUserName, isOpen, onToggle }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Fetch chat history
  useEffect(() => {
    if (!taskId) return;

    let isSubscribed = true;

    const fetchMessages = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`/api/chat/${taskId}/messages`, {
          headers: { Authorization: `Bearer mock-${userId}` }
        });
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setMessages((prev) => {
            const fetched = data.messages || [];
            const optimistic = prev.filter((m) => m.id.toString().startsWith("temp-"));
            const merged = [...fetched];
            optimistic.forEach((opt) => {
              if (!merged.some((m) => m.text === opt.text)) {
                merged.push(opt);
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.error("Error fetching chat:", err);
      } finally {
        if (showLoading && isSubscribed) setLoading(false);
      }
    };

    fetchMessages(true);

    const pollInterval = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [taskId, userId]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, scrollToBottom]);

  // Socket listener for real-time messages & typing indicators
  useEffect(() => {
    if (!socket || !taskId) return;

    const handleMessage = (data) => {
      if (data.taskId === taskId) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === data.id)) return prev;
          // Replace temp message if exists
          const filtered = prev.filter((m) => !(m.id.toString().startsWith("temp-") && m.text === data.text));
          return [...filtered, data];
        });

        if (!isOpen && data.senderId !== userId) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    };

    const handleTyping = (data) => {
      if (data.taskId === taskId && data.userId !== userId) {
        setIsTyping(data.isTyping);
      }
    };

    socket.on("chat-message", handleMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("chat-message", handleMessage);
      socket.off("typing", handleTyping);
    };
  }, [socket, taskId, userId, isOpen]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (socket && taskId) {
      socket.emit("typing", { taskId, userId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", { taskId, userId, isTyping: false });
      }, 2000);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !taskId) return;

    setInputText("");

    if (socket && taskId) {
      socket.emit("typing", { taskId, userId, isTyping: false });
    }

    // Optimistic UI addition
    const tempId = "temp-" + Date.now();
    const newMsg = {
      id: tempId,
      taskId,
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      text,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      const res = await fetch(`/api/chat/${taskId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${userId}`
        },
        body: JSON.stringify({ text })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? data.message : m))
          );
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  // Group messages by date
  const getDateLabel = (isoString) => {
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  };

  return (
    <>
      <button
        type="button"
        className="chat-toggle-btn"
        onClick={onToggle}
        id="chat-toggle"
      >
        <MessageCircle size={20} />
        <span>Chat</span>
        {unreadCount > 0 && (
          <span className="chat-unread-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="chat-panel" id="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-header-info">
              <MessageCircle size={18} />
              <div>
                <h4 className="chat-panel-title">{t("chatTitle", { name: remoteUserName || "neighbor" })}</h4>
              </div>
            </div>
            <button
              type="button"
              className="chat-panel-close"
              onClick={onToggle}
              aria-label={t("close")}
            >
              <X size={18} />
            </button>
          </div>

          <div className="chat-messages-area">
            {loading ? (
              <div className="chat-loading">
                <span className="chat-loading-dot"></span>
                <span className="chat-loading-dot"></span>
                <span className="chat-loading-dot"></span>
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty">
                <MessageCircle size={40} className="chat-empty-icon" />
                <p>No messages yet</p>
                <span>Send a message to start the conversation</span>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isMine = msg.senderId === userId;
                  const showDate = idx === 0 ||
                    getDateLabel(msg.createdAt) !== getDateLabel(messages[idx - 1].createdAt);

                  return (
                    <React.Fragment key={msg.id || idx}>
                      {showDate && (
                        <div className="chat-date-divider">
                          <span>{getDateLabel(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`chat-bubble-wrap ${isMine ? "chat-bubble-mine" : "chat-bubble-theirs"}`}>
                        {!isMine && (
                          <div className="chat-bubble-avatar">
                            {(msg.senderName || "N")[0].toUpperCase()}
                          </div>
                        )}
                        <div className={`chat-bubble ${isMine ? "chat-bubble-sent" : "chat-bubble-received"}`}>
                          {!isMine && (
                            <span className="chat-bubble-sender">{msg.senderName}</span>
                          )}
                          <p className="chat-bubble-text">{msg.text}</p>
                          <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </>
            )}

            {isTyping && (
              <div className="chat-typing-indicator">
                <span className="chat-typing-dot"></span>
                <span className="chat-typing-dot"></span>
                <span className="chat-typing-dot"></span>
                <span className="chat-typing-label">{remoteUserName || "Neighbor"} is typing</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={t("typeMessage")}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!inputText.trim()}
              aria-label={t("send")}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
