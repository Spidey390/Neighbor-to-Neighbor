import React from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function LanguageToggle({ className = "" }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-medium ${className}`}>
      <Globe size={14} className="ml-2 text-stone-500" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
          language === "en"
            ? "bg-emerald-600 text-white shadow-xs font-semibold"
            : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
        }`}
        aria-pressed={language === "en"}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ta")}
        className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
          language === "ta"
            ? "bg-emerald-600 text-white shadow-xs font-semibold"
            : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
        }`}
        aria-pressed={language === "ta"}
      >
        தமிழ்
      </button>
    </div>
  );
}
