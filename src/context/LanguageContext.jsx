import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations.js";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem("app_lang") || "en";
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem("app_lang", lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key, params = {}) => {
    let dict = translations[language] || translations.en;
    let template = dict[key] || translations.en[key] || key;

    if (typeof template === "string" && typeof params === "object") {
      Object.keys(params).forEach((paramKey) => {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), params[paramKey]);
      });
    }
    return template;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
