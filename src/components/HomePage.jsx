import React, { useState } from "react";
import AuthPage from "./AuthPage.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Users
} from "lucide-react";

export default function HomePage({ onAuthSuccess }) {
  const [authTab, setAuthTab] = useState("login");
  const { t } = useLanguage();

  const openAuth = (tab) => {
    setAuthTab(tab);
    document.querySelector("#member-access")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="landing-shell min-h-screen text-stone-900" id="home-page">
      <header className="landing-nav">
        <div className="brand-mark">
          <span className="brand-icon"><HeartHandshake size={19} strokeWidth={2.25} /></span>
          <span>{t("appName")}</span>
        </div>

        <nav className="landing-links flex items-center gap-4" aria-label="Primary navigation">
          <a href="#member-access">{t("signIn")}</a>
          <a href="#how-it-works">{t("howItWorks")}</a>
          <a href="#safety">{t("safety")}</a>
          <LanguageToggle />
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> {t("heroEyebrow")}</p>
            <h1 className="whitespace-pre-line">{t("heroTitle")}</h1>
            <p className="hero-description">
              {t("heroDesc")}
            </p>
            <div className="hero-actions">
              <button type="button" className="button-primary" onClick={() => openAuth("register")}>
                {t("getStarted")} <ArrowRight size={17} />
              </button>
              <button type="button" className="button-link" onClick={() => document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                {t("seeHowItWorks")}
              </button>
            </div>
            <div className="hero-proof">
              <span><ShieldCheck size={16} /> {t("verifiedVolunteers")}</span>
              <span><Clock3 size={16} /> {t("neighborsNearby")}</span>
            </div>

            <div className="community-signal" aria-label="How community support comes together">
              <div className="community-signal-head">
                <span><i /> {t("littleHelp")}</span>
                <span>{t("threeSteps")}</span>
              </div>
              <div className="community-signal-body">
                <div className="signal-icon"><PackageCheck size={19} /></div>
                <div className="signal-copy">
                  <strong>{t("groceryMatch")}</strong>
                  <span><MapPin size={13} /> {t("localPrivateEasy")}</span>
                </div>
                <CheckCircle2 className="signal-check" size={20} aria-hidden="true" />
              </div>
              <div className="signal-steps" aria-hidden="true">
                <span>{t("requestShared")}</span><i /><span>{t("neighborMatched")}</span><i /><span>{t("helpDelivered")}</span>
              </div>
            </div>
          </div>

          <aside className="request-panel" id="member-access" aria-label="Sign in to Neighbor-to-Neighbor">
            <div className="inline-auth">
              <div className="inline-auth-head">
                <div>
                  <p className="eyebrow"><span /> {t("memberAccess")}</p>
                  <h2>{authTab === "login" ? t("welcomeBack") : t("joinNeighborhood")}</h2>
                </div>
              </div>
              <AuthPage isEmbedded initialTab={authTab} onAuthSuccess={onAuthSuccess} />
            </div>
          </aside>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-intro">
            <p className="eyebrow"><span /> {t("gentlerWay")}</p>
            <h2>{t("simpleFirstHello")}</h2>
          </div>
          <div className="step-grid">
            <article><b>01</b><h3>{t("step1Title")}</h3><p>{t("step1Desc")}</p></article>
            <article><b>02</b><h3>{t("step2Title")}</h3><p>{t("step2Desc")}</p></article>
            <article><b>03</b><h3>{t("step3Title")}</h3><p>{t("step3Desc")}</p></article>
          </div>
        </section>

        <section className="safety-section" id="safety">
          <div className="section-intro">
            <p className="eyebrow"><span /> {t("safety")}</p>
            <h2>{t("builtAroundCare")}</h2>
            <p className="hero-description">
              {t("safetyDesc")}
            </p>
          </div>

          <div className="trust-strip">
            <div><ShieldCheck size={20} /><span><strong>{t("designedForTrustTitle")}</strong> {t("designedForTrustDesc")}</span></div>
            <div><Users size={20} /><span><strong>{t("madeForNeighborsTitle")}</strong> {t("madeForNeighborsDesc")}</span></div>
            <div><CheckCircle2 size={20} /><span><strong>{t("clearEveryStepTitle")}</strong> {t("clearEveryStepDesc")}</span></div>
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <p className="eyebrow"><span /> {t("careStartsNearby")}</p>
            <h2>{t("oneConnection")}</h2>
          </div>
          <button type="button" className="button-primary" onClick={() => openAuth("register")}>{t("joinNetwork")} <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer className="landing-footer">
        <span>{t("copyright")}</span>
        <span>{t("appSubhead")}</span>
      </footer>
    </div>
  );
}
