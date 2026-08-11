import React, { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Check, RotateCcw } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

// Check for browser support
const SpeechRecognition = typeof window !== "undefined" 
  ? (window.SpeechRecognition || window.webkitSpeechRecognition) 
  : null;

export default function VoiceRequest({ onTranscript, currentText }) {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);

  // Start listening
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError(language === "ta" ? "உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை." : "Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    setError("");
    setTranscript("");
    setInterimTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === "ta" ? "ta-IN" : "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      setTranscript(finalText);
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError(language === "ta" ? "மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது." : "Microphone access denied. Please allow microphone access in your browser settings.");
      } else if (event.error === "no-speech") {
        setError(language === "ta" ? "குரல் எதுவும் கேட்கவில்லை. மீண்டும் தெளிவாகப் பேசவும்." : "No speech detected. Please try again and speak clearly.");
      } else {
        setError(`${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Use transcribed text
  const useTranscript = () => {
    const fullText = (transcript + " " + interimTranscript).trim();
    if (fullText && onTranscript) {
      onTranscript(currentText ? currentText + " " + fullText : fullText);
    }
    setTranscript("");
    setInterimTranscript("");
  };

  // Reset
  const resetTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
    setError("");
  };

  const fullTranscript = (transcript + " " + interimTranscript).trim();

  // Unsupported browser
  if (!SpeechRecognition) {
    return (
      <div className="voice-unsupported" id="voice-request-unsupported">
        <Mic size={18} className="voice-unsupported-icon" />
        <span>{language === "ta" ? "குரல் உள்ளீட்டிற்கு Chrome அல்லது Edge உலாவி தேவை" : "Voice input requires Chrome or Edge browser"}</span>
      </div>
    );
  }

  return (
    <div className="voice-request-wrap" id="voice-request">
      {/* Main mic button */}
      <div className="voice-mic-row">
        <button
          type="button"
          className={`voice-mic-btn ${isListening ? "voice-mic-active" : ""}`}
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? t("stopRecording") : t("startRecording")}
        >
          <span className={`voice-mic-ripple ${isListening ? "voice-mic-ripple-active" : ""}`}></span>
          <span className={`voice-mic-ripple voice-mic-ripple-2 ${isListening ? "voice-mic-ripple-active" : ""}`}></span>
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <span className="voice-mic-label">
          {isListening ? (language === "ta" ? "கேட்கிறது... நிறுத்தத் தட்டவும்" : "Listening... Tap to stop") : (language === "ta" ? "உங்கள் கோரிக்கையைப் பேசத் தட்டவும்" : "Tap to speak your request")}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="voice-error">
          ⚠️ {error}
        </div>
      )}

      {/* Live transcript */}
      {(fullTranscript || isListening) && (
        <div className="voice-transcript-box">
          <div className="voice-transcript-header">
            <span className="voice-transcript-label">
              {isListening && <span className="voice-live-dot"></span>}
              {isListening ? (language === "ta" ? "நேரலை உரைமாற்றம்" : "Live Transcript") : t("voiceTranscribed")}
            </span>
          </div>

          <p className="voice-transcript-text">
            {transcript && <span>{transcript}</span>}
            {interimTranscript && (
              <span className="voice-interim">{interimTranscript}</span>
            )}
            {isListening && !fullTranscript && (
              <span className="voice-placeholder">{language === "ta" ? "இப்போது பேசுங்கள்..." : "Speak now..."}</span>
            )}
          </p>

          {!isListening && fullTranscript && (
            <div className="voice-transcript-actions">
              <button
                type="button"
                className="voice-action-btn voice-action-use"
                onClick={useTranscript}
              >
                <Check size={16} />
                <span>{t("confirmVoiceRequest")}</span>
              </button>
              <button
                type="button"
                className="voice-action-btn voice-action-reset"
                onClick={resetTranscript}
              >
                <RotateCcw size={16} />
                <span>{t("tryAgain")}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
