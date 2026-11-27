import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon, GraduationCapIcon,
  BookIcon, MenuIcon
} from "../shared/Icons";
import StageshowHeroDemo from "../stageshow/StageshowHeroDemo";
import StageshowBentoGrid from "../stageshow/StageshowBentoGrid";
import InteractiveModeDemos from "../stageshow/InteractiveModeDemos";
import AdSlot from "../shared/AdSlot";

export default function PublicWebsite({
  initialTab = "home",
  currentUser,
  currentOrg,
  onLogout,
  onLoginSuccess
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || "home"); // 'home', 'features', 'pricing', 'login', 'signup'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginRoleTab, setLoginRoleTab] = useState("creator"); // 'creator' | 'superadmin'

  // Dynamic Plans & Public Website Settings controlled by SuperAdmin
  const [plans, setPlans] = useState([]);
  const [siteSettings, setSiteSettings] = useState({
    announcement_active: false,
    announcement_text: "",
    announcement_link: "",
    site_headline: "All-in-one assessment engine with on-device anti-cheat",
    site_subtitle: "Conduct secure computer-based assessments, buzzer quick quizzes, and auto-graded evaluations with real-time video invigilation.",
    contact_email: "support@lunaris.com",
    support_phone: "+91 98765 43210",
    platform_status: "Operational"
  });
  const [publicStats, setPublicStats] = useState({
    total_exams: 0,
    total_attempts: 0,
    total_questions: 0,
    total_organizations: 0,
    uptime: "99.98%",
    proctor_accuracy: "99.4%"
  });

  // Selected Plan for Onboarding: 'free', 'creator_pro', 'institution'
  const [selectedPlan, setSelectedPlan] = useState("free");

  // Registration Mode: 'create_org' | 'join_org'
  const [regMode, setRegMode] = useState("create_org");
  const [authInviteCode, setAuthInviteCode] = useState("");

  // Auth Form State
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authOrgName, setAuthOrgName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Security CAPTCHA State (Login & Registration)
  const [loginCaptcha, setLoginCaptcha] = useState({ id: "", svg: "" });
  const [loginCaptchaInput, setLoginCaptchaInput] = useState("");
  const [regCaptcha, setRegCaptcha] = useState({ id: "", svg: "" });
  const [regCaptchaInput, setRegCaptchaInput] = useState("");

  // Email Verification OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Real Google Sign-In & Google Identity Services State
  const [googleClientId, setGoogleClientId] = useState(
    () => localStorage.getItem("lunaris_google_client_id") || import.meta.env.VITE_GOOGLE_CLIENT_ID || "539216233370-eca2ktq30qc3m74o04b17q7bp90sds0j.apps.googleusercontent.com"
  );

  async function loadLoginCaptcha() {
    try {
      const c = await api.getCaptcha();
      setLoginCaptcha({ id: c.captcha_id, svg: c.captcha_svg });
      setLoginCaptchaInput("");
    } catch (err) {
      console.warn("Failed to load login captcha:", err);
    }
  }

  async function loadRegCaptcha() {
    try {
      const c = await api.getCaptcha();
      setRegCaptcha({ id: c.captcha_id, svg: c.captcha_svg });
      setRegCaptchaInput("");
    } catch (err) {
      console.warn("Failed to load registration captcha:", err);
    }
  }

  async function loadGoogleConfig() {
    try {
      const res = await api.getGoogleConfig();
      if (res?.client_id && !googleClientId) {
        setGoogleClientId(res.client_id);
      }
    } catch (e) {
      console.warn("Could not fetch server Google client id:", e);
    }
  }

  async function loadPublicData() {
    try {
      const p = await api.getPlans();
      if (Array.isArray(p) && p.length > 0) {
        setPlans(p);
      }
    } catch (e) {
      console.warn("Could not load dynamic plans:", e);
    }
    try {
      const s = await api.getPublicSiteSettings();
      if (s) setSiteSettings(s);
    } catch (e) {
      console.warn("Could not load public site settings:", e);
    }
    try {
      const st = await api.getPublicStats();
      if (st) setPublicStats(st);
    } catch (e) {
      console.warn("Could not load public stats:", e);
    }
  }

  useEffect(() => {
    loadLoginCaptcha();
    loadRegCaptcha();
    loadGoogleConfig();
    loadPublicData();
    try {
      const params = new URLSearchParams(window.location.search);
      const joinParam = params.get("join");
      if (joinParam && joinParam.trim()) {
        const cleanJoin = joinParam.trim().toUpperCase();
        setAuthInviteCode(cleanJoin);
        setRegMode("join_org");
        setShowAuthModal(true);
      }
    } catch (e) {
      console.warn("Error reading URL search params:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "login") {
      loadLoginCaptcha();
    } else if (activeTab === "signup") {
      loadRegCaptcha();
    }
  }, [activeTab]);

  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Initialize Google Identity Services (GIS) when Google Script & Client ID are ready
  useEffect(() => {
    if (!googleClientId) return;
    if (window.__lunaris_gsi_initialized === googleClientId) return;

    function initGsi() {
      if (window.google?.accounts?.id) {
        if (window.__lunaris_gsi_initialized === googleClientId) return;
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false
          });
          window.__lunaris_gsi_initialized = googleClientId;
        } catch (e) {
          console.warn("Google GSI init notice:", e);
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGsi();
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [googleClientId]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  function changeRouteTab(tabName) {
    setActiveTab(tabName);
    setMobileMenuOpen(false);
    setOtpSent(false);
    setAuthError("");
    if (tabName === "home") navigate("/");
    else if (tabName === "features") navigate("/features");
    else if (tabName === "pricing") navigate("/pricing");
    else if (tabName === "login") navigate("/login");
    else if (tabName === "signup") navigate("/register");
  }

  function handleOpenSignupWithPlan(planCode) {
    if (currentUser) {
      navigate("/dashboard?tab=billing");
      return;
    }
    setRegMode("create_org");
    setSelectedPlan(planCode);
    setAuthError("");
    setOtpSent(false);
    setActiveTab("signup");
    setMobileMenuOpen(false);
    navigate("/register");
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (!loginCaptchaInput.trim()) {
      setAuthError("Please enter the security CAPTCHA code shown in the image.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.login(
        authEmail.trim(),
        authPassword,
        loginCaptcha.id,
        loginCaptchaInput.trim(),
        authInviteCode.trim().toUpperCase() || null
      );

      // Validate role expectation if logging in specifically through the SuperAdmin tab
      if (loginRoleTab === "superadmin" && !res.is_superadmin) {
        throw new Error("Access Denied: This account does not possess SuperAdmin privileges. Please use the Workspace Login tab.");
      }

      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      } else {
        if (res.is_superadmin) navigate("/admin");
        else navigate("/dashboard");
      }
    } catch (err) {
      setAuthError(err.message || "Failed to log in. Please check your credentials.");
      loadLoginCaptcha();
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleCredentialResponse(response) {
    if (!response?.credential) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.googleAuth({
        credential: response.credential,
        registration_type: activeTab === "signup" && regMode === "join_org" ? "join_org" : "create_org",
        invite_code: authInviteCode.trim().toUpperCase() || undefined,
        organization_name: authOrgName.trim() || undefined
      });

      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      } else {
        if (res.is_superadmin) navigate("/admin");
        else navigate("/dashboard");
      }
    } catch (err) {
      setAuthError(err.message || "Google authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  function triggerGoogleSignIn(mode = "signin") {
    setAuthError("");

    const activeCid = (googleClientId || "").trim() || localStorage.getItem("lunaris_google_client_id") || "539216233370-eca2ktq30qc3m74o04b17q7bp90sds0j.apps.googleusercontent.com";

    if (!window.google?.accounts?.oauth2) {
      setAuthError("Google Identity Services library is initializing. Please click again in 2 seconds.");
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: activeCid,
        scope: "email profile openid",
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            setAuthError("Google Sign-In was cancelled or failed: " + tokenResponse.error);
            return;
          }
          if (tokenResponse?.access_token) {
            setAuthLoading(true);
            try {
              const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const userInfo = await userInfoResp.json();
              const res = await api.googleAuth({
                access_token: tokenResponse.access_token,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                google_id: userInfo.sub,
                registration_type: mode === "signup" && regMode === "join_org" ? "join_org" : "create_org",
                invite_code: authInviteCode.trim().toUpperCase() || undefined,
                organization_name: authOrgName.trim() || undefined
              });

              localStorage.setItem("lunaris_token", res.access_token);
              localStorage.setItem("lunaris_user", JSON.stringify(res));
              if (onLoginSuccess) {
                onLoginSuccess(res);
              } else {
                if (res.is_superadmin) navigate("/admin");
                else navigate("/dashboard");
              }
            } catch (err) {
              setAuthError(err.message || "Failed to process Google sign-in response.");
            } finally {
              setAuthLoading(false);
            }
          }
        }
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      setAuthError("Could not launch Google Sign-In popup: " + err.message);
    }
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!regCaptchaInput.trim()) {
      setAuthError("Please enter the security CAPTCHA code shown in the image.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.sendVerificationOtp({
        email: authEmail.trim(),
        full_name: authFullName.trim(),
        registration_type: regMode,
        invite_code: regMode === "join_org" ? authInviteCode.trim().toUpperCase() : null,
        captcha_id: regCaptcha.id,
        captcha_solution: regCaptchaInput.trim()
      });

      setOtpSent(true);
      setOtpNotice(res.message || `Verification code sent to ${authEmail.trim()}. Please check your email.`);
      setOtpCountdown(60);
    } catch (err) {
      setAuthError(err.message || "Failed to send verification code. Please check your details.");
      loadRegCaptcha();
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendOtp() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.sendVerificationOtp({
        email: authEmail.trim(),
        full_name: authFullName.trim(),
        registration_type: regMode,
        invite_code: regMode === "join_org" ? authInviteCode.trim().toUpperCase() : null,
        is_resend: true
      });
      setOtpNotice(`New verification code sent to ${authEmail.trim()}.`);
      setOtpCountdown(60);
    } catch (err) {
      setAuthError(err.message || "Failed to resend code.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyAndRegister(e) {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setAuthError("Please enter the complete 6-digit verification code sent to your email.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = regMode === "join_org" ? {
        email: authEmail.trim(),
        password: authPassword,
        full_name: authFullName.trim(),
        registration_type: "join_org",
        invite_code: authInviteCode.trim().toUpperCase(),
        otp_code: otpCode.trim()
      } : {
        email: authEmail.trim(),
        password: authPassword,
        full_name: authFullName.trim(),
        organization_name: authOrgName.trim() || `${authFullName.trim()}'s Academy`,
        plan_id: selectedPlan,
        registration_type: "create_org",
        otp_code: otpCode.trim()
      };

      const res = await api.register(payload);
      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setAuthError(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Alias for backward compatibility if invoked anywhere
  const handleRegisterSubmit = handleRequestOtp;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)", overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
      {/* Dynamic Announcement Banner configured by SuperAdmin */}
      {siteSettings.announcement_active && siteSettings.announcement_text && (
        <div style={{
          background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 50%, #4338ca 100%)",
          color: "#ffffff",
          padding: "9px 18px",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "10px",
          zIndex: 60,
          position: "relative"
        }}>
          <MegaphoneIcon size={14} color="#ffffff" />
          <span>{siteSettings.announcement_text}</span>
          {siteSettings.announcement_link && (
            <a
              href={siteSettings.announcement_link}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#ffffff", textDecoration: "underline", marginLeft: "4px", fontWeight: "700" }}
            >
              Learn More ↗
            </a>
          )}
        </div>
      )}
      {/* Top Universal Public Navbar */}
      <header
        className="public-header"
        style={{
          height: "64px",
          background: "#ffffff",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
        }}
      >
        {/* Brand */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          onClick={() => changeRouteTab("home")}
        >
          <img
            src="/logo.png"
            alt="Lunaris"
            style={{
              width: "38px",
              height: "38px",
              objectFit: "contain",
              borderRadius: "50%",
              boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
            }}
          />
          <div>
            <div style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "0.5px", lineHeight: "1" }}>
              LUNARIS
            </div>
            <div style={{ fontSize: "11px", color: "var(--accent-blue)", fontWeight: "600", letterSpacing: "0.2px" }}>
              Assessment Platform
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links: Overview, Features & Modes, Pricing & Plans */}
        <nav className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <button
            type="button"
            onClick={() => changeRouteTab("home")}
            style={{
              background: "none",
              color: activeTab === "home" ? "var(--accent-blue)" : "var(--text-secondary)",
              fontWeight: activeTab === "home" ? "700" : "500",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("features")}
            style={{
              background: "none",
              color: activeTab === "features" ? "var(--accent-blue)" : "var(--text-secondary)",
              fontWeight: activeTab === "features" ? "700" : "500",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            Features & Modes
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("pricing")}
            style={{
              background: "none",
              color: activeTab === "pricing" ? "var(--accent-blue)" : "var(--text-secondary)",
              fontWeight: activeTab === "pricing" ? "700" : "500",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            Pricing & Plans
          </button>
        </nav>

        {/* Desktop Auth & Dashboard Action Buttons */}
        <div className="desktop-auth-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => navigate(currentUser.is_superadmin ? "/admin" : "/dashboard")}
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                {currentUser.is_superadmin ? "Go to Admin Portal →" : "Go to Dashboard →"}
              </button>
              <div style={{ textAlign: "right", fontSize: "12px", lineHeight: "1.2" }}>
                <strong style={{ color: "var(--text-primary)" }}>{currentUser.full_name || currentUser.email}</strong>
                <div style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "700", textTransform: "uppercase" }}>
                  {currentUser.is_superadmin ? "Platform SuperAdmin" : (currentUser.organization_name || "Workspace")}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="btn-secondary"
                style={{ padding: "7px 12px", fontSize: "12px" }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => changeRouteTab("login")}
                className="btn-secondary"
                style={{ padding: "8px 14px", fontSize: "13px" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleOpenSignupWithPlan("free")}
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Create Account
              </button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "18px",
            cursor: "pointer",
            color: "var(--text-primary)"
          }}
        >
          {mobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </header>

      {/* Mobile Collapsible Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-drawer"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            position: "sticky",
            top: "64px",
            zIndex: 49
          }}
        >
          <button
            type="button"
            onClick={() => changeRouteTab("home")}
            style={{
              background: "none",
              textAlign: "left",
              padding: "8px 0",
              fontSize: "15px",
              fontWeight: activeTab === "home" ? "700" : "500",
              color: activeTab === "home" ? "var(--accent-blue)" : "var(--text-primary)"
            }}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("features")}
            style={{
              background: "none",
              textAlign: "left",
              padding: "8px 0",
              fontSize: "15px",
              fontWeight: activeTab === "features" ? "700" : "500",
              color: activeTab === "features" ? "var(--accent-blue)" : "var(--text-primary)"
            }}
          >
            Features & Modes
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("pricing")}
            style={{
              background: "none",
              textAlign: "left",
              padding: "8px 0",
              fontSize: "15px",
              fontWeight: activeTab === "pricing" ? "700" : "500",
              color: activeTab === "pricing" ? "var(--accent-blue)" : "var(--text-primary)"
            }}
          >
            Pricing & Plans
          </button>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />

          {currentUser ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "13px" }}>
                Signed in as: <strong>{currentUser.full_name || currentUser.email}</strong>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(currentUser.is_superadmin ? "/admin" : "/dashboard");
                }}
                style={{ width: "100%", padding: "10px" }}
              >
                {currentUser.is_superadmin ? "Go to Admin Portal →" : "Go to Dashboard →"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                style={{ width: "100%", padding: "8px" }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => changeRouteTab("login")}
                style={{ width: "100%", padding: "10px" }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("free")}
                style={{ width: "100%", padding: "10px" }}
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hero Section */}
      {activeTab === "home" && (
        <div>
          <section
            className="hero-section"
            style={{
              padding: "60px 24px 40px",
              maxWidth: "1160px",
              margin: "0 auto",
              textAlign: "center"
            }}
          >
            {/* Taste Skill v2 Eyebrow: Plain language topic without slop */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--accent-blue-subtle)",
              color: "var(--accent-blue)",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "0.5px",
              marginBottom: "16px",
              border: "1px solid rgba(37, 99, 235, 0.15)"
            }}>
              LUNARIS ASSESSMENT PLATFORM
            </div>

            {/* Taste Skill v2 Headline: Max two lines on desktop */}
            <h1
              className="hero-headline"
              style={{
                fontSize: "48px",
                fontWeight: "900",
                letterSpacing: "-1px",
                lineHeight: "1.15",
                color: "var(--text-primary)",
                marginBottom: "16px",
                textWrap: "balance"
              }}
            >
              {siteSettings.site_headline || "Computer-Based Examination Platform for High-Stakes Assessments"}
            </h1>

            {/* Taste Skill v2 Subtext: Max 20 words, max four lines */}
            <p
              className="hero-subtitle"
              style={{
                fontSize: "17px",
                color: "var(--text-secondary)",
                maxWidth: "680px",
                margin: "0 auto 28px",
                lineHeight: "1.6",
                textWrap: "balance"
              }}
            >
              {siteSettings.site_subtitle || "Author institutional assessments, sync rosters from Google Classroom, and proctor candidates with zero student accounts required."}
            </p>

            {/* Taste Skill v2 Primary CTA: Visible above the fold without scroll */}
            <div className="hero-actions" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "36px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("free")}
                style={{ padding: "12px 26px", fontSize: "14px", fontWeight: "700" }}
              >
                Create Workspace Account →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => changeRouteTab("login")}
                style={{ padding: "12px 24px", fontSize: "14px", fontWeight: "600" }}
              >
                Sign In to Platform
              </button>
            </div>

            {/* Flagship Product Demonstration */}
            <div style={{ marginTop: "6px", marginBottom: "20px" }}>
              <StageshowHeroDemo />
            </div>

            {/* Landing Page Display Banner (468x60) */}
            <AdSlot placement="468x60_1" show={true} style={{ marginTop: "24px" }} />
          </section>

          {/* Stageshow Bento Grid: Balanced 5-Tile Architecture */}
          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", overflow: "hidden" }}>
            <StageshowBentoGrid />
          </section>

          {/* Hands-on Interactive Mode Demonstrator */}
          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "#ffffff", overflow: "hidden" }}>
            <div style={{ textAlign: "center", paddingTop: "50px", marginBottom: "-10px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(124, 58, 237, 0.08)",
                  color: "#7c3aed",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "0.5px"
                }}
              >
                <ZapIcon size={13} color="#2563eb" /> LIVE INTERACTIVE WORKBENCH
              </div>
              <h2 style={{ fontSize: "30px", fontWeight: "900", color: "#0f172a", marginTop: "8px" }}>
                Test Drive the Assessment Engine
              </h2>
              <p style={{ color: "#64748b", fontSize: "15px", marginTop: "6px" }}>
                Interact directly with the question palette, AI generation studio, and integrity monitor below.
              </p>
            </div>
            <InteractiveModeDemos />
          </section>
        </div>
      )}

      {/* Features View */}
      {activeTab === "features" && (
        <section style={{ maxWidth: "1160px", margin: "40px auto 80px", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "36px", fontWeight: "900", color: "var(--text-primary)" }}>
              Platform Features & Architecture
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>
              Enterprise reliability built on a modular monolith with strict tenant isolation.
            </p>
          </div>

          <div
            className="responsive-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "28px"
            }}
          >
            <div className="dash-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-blue)", letterSpacing: "0.5px", marginBottom: "6px" }}>
                ONBOARDING
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                Exam Specific Candidate UID Enrollment
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Students take exams without creating a permanent account or password. Instructors generate batch UIDs
                with PINs or import candidate CSVs. Rate-limited validation ensures eligibility and attempt constraints.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-blue)", letterSpacing: "0.5px", marginBottom: "6px" }}>
                AI TELEMETRY
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                On-Device MediaPipe Face and Behavior Verification
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Zero continuous video upload costs. MediaPipe tracks face presence, multiple faces, and head direction
                on the client. Flags are saved as advisory evidence for human review rather than automated candidate failure.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-blue)", letterSpacing: "0.5px", marginBottom: "6px" }}>
                QUESTION GENERATION
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                AI Question Studio and Syllabus Synthesis
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Generate curriculum-aligned Single MCQ, Multiple MCQ, and Numerical questions across STEM, Technical,
                and Academic disciplines in seconds. Strict JSON schema validation with LaTeX math support.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-blue)", letterSpacing: "0.5px", marginBottom: "6px" }}>
                LIVE SUPERVISION
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                Live Proctor Invigilation and Audit Trails
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Invigilators monitor active sessions with synchronized health signals, flagged anomaly timelines,
                encrypted snapshot evidence review, and formal appeal audit trails.
              </p>
            </div>
          </div>

          {/* Interactive Feature Sandbox */}
          <div style={{ marginTop: "40px" }}>
            <InteractiveModeDemos />
          </div>
        </section>
      )}

      {/* Pricing View - Dynamically Synchronized with SuperAdmin Plans */}
      {activeTab === "pricing" && (
        <section style={{ maxWidth: "1160px", margin: "40px auto 80px", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "36px", fontWeight: "900", color: "var(--text-primary)" }}>
              Transparent, Entitlement-Based Pricing
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>
              Choose a plan to provision your workspace. Live pricing and quotas configured directly by platform administrators.
            </p>
          </div>

          <div
            className="responsive-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "28px"
            }}
          >
            {(plans.length > 0 ? plans : [
              {
                id: "free",
                code: "free",
                name: "Free Starter",
                price_inr: 0,
                billing_period: "forever",
                description: "For individual educators and small classroom tests.",
                entitlements: { max_exams: 3, max_candidates: 30, ai_questions: 20, proctoring_enabled: false }
              },
              {
                id: "creator_pro",
                code: "creator_pro",
                name: "Creator Pro",
                price_inr: 499,
                billing_period: "month",
                description: "For coaching classes, independent faculty, and recruiters.",
                entitlements: { max_exams: 50, max_candidates: 250, ai_questions: 500, proctoring_enabled: false, pdf_import: true, team_members: 3 }
              },
              {
                id: "institution",
                code: "institution",
                name: "Institution Proctored",
                price_inr: 8999,
                billing_period: "month",
                description: "For engineering colleges, large coaching institutes, and testing centers.",
                entitlements: { max_exams: 500, max_candidates: 5000, ai_questions: 2000, proctoring_enabled: true, pdf_import: true, team_members: 15 }
              }
            ]).map((p) => {
              const code = p.code || p.id;
              const isPopular = code === "creator_pro";
              const isInstitution = code === "institution";
              return (
                <div
                  key={code}
                  className="dash-card"
                  style={{
                    padding: "32px",
                    display: "flex",
                    flexDirection: "column",
                    border: isPopular ? "1.5px solid var(--accent-blue)" : isInstitution ? "1.5px solid #7c3aed" : "1px solid var(--border-subtle)",
                    position: "relative"
                  }}
                >
                  {isPopular && (
                    <span style={{
                      position: "absolute", top: "-12px", right: "20px",
                      background: "var(--accent-blue)", color: "#ffffff",
                      fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "9999px"
                    }}>
                      Popular
                    </span>
                  )}
                  {isInstitution && (
                    <span style={{
                      position: "absolute", top: "-12px", right: "20px",
                      background: "#7c3aed", color: "#ffffff",
                      fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "9999px"
                    }}>
                      Enterprise Grade
                    </span>
                  )}
                  <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "8px", color: isPopular ? "var(--accent-blue)" : isInstitution ? "#7c3aed" : "inherit" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", marginBottom: "16px", fontVariantNumeric: "tabular-nums" }}>
                    {p.price_inr === 0 ? "₹0" : `₹${p.price_inr?.toLocaleString()}`}
                    <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-muted)", marginLeft: "4px" }}>
                      /{p.billing_period || (p.price_inr === 0 ? "forever" : "month")}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", minHeight: "36px" }}>
                    {p.description}
                  </p>
                  <ul style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "2", flex: 1, marginBottom: "24px", listStyle: "none" }}>
                    <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckIcon size={14} color="#16a34a" /> {p.entitlements?.max_exams ?? 3} Published Exams</li>
                    <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckIcon size={14} color="#16a34a" /> {p.entitlements?.max_candidates ?? 30} Candidates per exam</li>
                    <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckIcon size={14} color="#16a34a" /> {p.entitlements?.ai_questions ?? 20} AI Question Credits</li>
                    <li>{p.entitlements?.proctoring_enabled ? "Full Proctoring Engine & Live Video" : " Full proctoring module"}</li>
                    <li>{p.entitlements?.pdf_import ? "PDF Document Import" : "PDF document import"}</li>
                    {p.entitlements?.team_members && <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckIcon size={14} color="#16a34a" /> {p.entitlements.team_members} Faculty & Author seats</li>}
                  </ul>
                  <button
                    type="button"
                    className={isPopular || isInstitution ? "btn-primary" : "btn-secondary"}
                    onClick={() => handleOpenSignupWithPlan(code)}
                    style={{ width: "100%" }}
                  >
                    Choose {p.name} →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dedicated Sign In View */}
      {activeTab === "login" && (
        <section style={{ maxWidth: "460px", margin: "40px auto 80px", padding: "0 16px" }}>
          <div className="dash-card" style={{ padding: "32px 28px" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{
                  width: "52px",
                  height: "52px",
                  objectFit: "contain",
                  borderRadius: "50%",
                  margin: "0 auto 10px auto",
                  display: "block",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                }}
              />
            </div>
            {/* Segmented Switch for Workspace vs SuperAdmin */}
            <div style={{
              display: "flex",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              padding: "4px",
              marginBottom: "24px",
              border: "1px solid var(--border-subtle)"
            }}>
              <button
                type="button"
                onClick={() => {
                  setLoginRoleTab("creator");
                  setAuthError("");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: loginRoleTab === "creator" ? "700" : "500",
                  background: loginRoleTab === "creator" ? "#ffffff" : "transparent",
                  color: loginRoleTab === "creator" ? "var(--accent-blue)" : "var(--text-muted)",
                  boxShadow: loginRoleTab === "creator" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer"
                }}
              >
                Workspace Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginRoleTab("superadmin");
                  setAuthError("");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: loginRoleTab === "superadmin" ? "700" : "500",
                  background: loginRoleTab === "superadmin" ? "#ffffff" : "transparent",
                  color: loginRoleTab === "superadmin" ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: loginRoleTab === "superadmin" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer"
                }}
              >
                SuperAdmin Login
              </button>
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>
              {loginRoleTab === "superadmin" ? "Platform SuperAdmin Sign In" : "Sign In to Workspace"}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              {loginRoleTab === "superadmin"
                ? "Authorized platform administration and audit console. Strict multi-tenant control."
                : "Sign in with your registered account to manage your institution's assessments."}
            </p>

            {authError && (
              <div style={{
                background: "var(--accent-rose-subtle)",
                color: "var(--accent-rose)",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "16px"
              }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="lunaris-input"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder={loginRoleTab === "superadmin" ? "admin@lunaris.com" : "faculty@institution.edu"}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Password
                </label>
                <input
                  type="password"
                  className="lunaris-input"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Login Security CAPTCHA */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Security Verification (CAPTCHA)
                  </label>
                  <button
                    type="button"
                    onClick={loadLoginCaptcha}
                    style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                  >
                     Refresh
                  </button>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div
                    dangerouslySetInnerHTML={{ __html: loginCaptcha.svg || "" }}
                    style={{ height: "46px", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1", flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    className="lunaris-input"
                    value={loginCaptchaInput}
                    onChange={(e) => setLoginCaptchaInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    maxLength={6}
                    style={{ height: "46px", fontFamily: "monospace", fontSize: "16px", fontWeight: "800", letterSpacing: "2px", textTransform: "uppercase" }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
                style={{
                  marginTop: "8px",
                  height: "44px",
                  background: loginRoleTab === "superadmin"
                    ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
                    : "var(--gradient-primary)"
                }}
              >
                {authLoading
                  ? "Authenticating..."
                  : loginRoleTab === "superadmin"
                    ? "Sign In as Platform SuperAdmin →"
                    : "Sign In to Workspace Dashboard →"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0 2px" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>OR</span>
                <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
              </div>

              <button
                type="button"
                onClick={() => triggerGoogleSignIn("signin")}
                disabled={authLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  height: "44px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#334155",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "all 0.15s ease"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)", textAlign: "center", fontSize: "13px" }}>
              Don't have a workspace?{" "}
              <span
                style={{ color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" }}
                onClick={() => changeRouteTab("signup")}
              >
                Create an account
              </span>
            </div>
          </div>

          {/* Login Page Display Banner (300x250) */}
          <AdSlot placement="300x250_1" show={true} style={{ marginTop: "24px" }} />
        </section>
      )}

      {/* Sign Up & Plan Selection Onboarding Wizard */}
      {activeTab === "signup" && (
        <section style={{ maxWidth: "620px", margin: "40px auto 100px", padding: "0 16px" }}>
          <div className="dash-card" style={{ padding: "32px 28px" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{
                  width: "52px",
                  height: "52px",
                  objectFit: "contain",
                  borderRadius: "50%",
                  margin: "0 auto 10px auto",
                  display: "block",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                }}
              />
            </div>
            {/* Segmented Switch: Create New Org vs Join Org */}
            <div style={{
              display: "flex",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              padding: "4px",
              marginBottom: "24px",
              border: "1px solid var(--border-subtle)"
            }}>
              <button
                type="button"
                onClick={() => {
                  setRegMode("create_org");
                  setOtpSent(false);
                  setOtpCode("");
                  setRegCaptchaInput("");
                  setAuthError("");
                  loadRegCaptcha();
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: regMode === "create_org" ? "700" : "500",
                  background: regMode === "create_org" ? "#ffffff" : "transparent",
                  color: regMode === "create_org" ? "var(--accent-blue)" : "var(--text-muted)",
                  boxShadow: regMode === "create_org" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer"
                }}
              >
                Create New Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegMode("join_org");
                  setOtpSent(false);
                  setOtpCode("");
                  setRegCaptchaInput("");
                  setAuthError("");
                  loadRegCaptcha();
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: regMode === "join_org" ? "700" : "500",
                  background: regMode === "join_org" ? "#ffffff" : "transparent",
                  color: regMode === "join_org" ? "var(--accent-blue)" : "var(--text-muted)",
                  boxShadow: regMode === "join_org" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer"
                }}
              >
                Join Existing Organization
              </button>
            </div>

            {authError && (
              <div style={{
                background: "var(--accent-rose-subtle)",
                color: "var(--accent-rose)",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "16px"
              }}>
                {authError}
              </div>
            )}

            {/* OTP VERIFICATION STEP OR REGISTRATION MODES */}
            {otpSent ? (
              <div>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <div style={{ marginBottom: "8px" }}><MailIcon size={36} color="#2563eb" /></div>
                  <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>
                    Verify Your Email Address
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                    We have sent a 6-digit verification code to <strong>{authEmail}</strong>.
                    <br />Please enter the code below to complete your registration.
                  </p>
                </div>

                {otpNotice && (
                  <div style={{
                    background: "var(--accent-blue-subtle)",
                    color: "var(--accent-blue)",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    marginBottom: "16px",
                    textAlign: "center"
                  }}>
                    {otpNotice}
                  </div>
                )}

                <form onSubmit={handleVerifyAndRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px", textAlign: "center" }}>
                      6-DIGIT VERIFICATION CODE
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="• • • • • •"
                      maxLength={6}
                      autoFocus
                      required
                      style={{
                        textAlign: "center",
                        fontSize: "24px",
                        letterSpacing: "8px",
                        fontWeight: "800",
                        fontFamily: "monospace",
                        height: "52px"
                      }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", display: "block", textAlign: "center" }}>
                      Valid for 10 minutes. Check your inbox and spam folder.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={authLoading || otpCode.length !== 6}
                    style={{ height: "46px", fontSize: "14px" }}
                  >
                    {authLoading ? "Verifying & Provisioning..." : "Confirm & Activate Workspace →"}
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "13px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setAuthError("");
                        loadRegCaptcha();
                      }}
                      style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
                    >
                      ← Back to edit details
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpCountdown > 0 || authLoading}
                      style={{
                        background: "none",
                        border: "none",
                        color: otpCountdown > 0 ? "var(--text-muted)" : "var(--accent-blue)",
                        fontWeight: "600",
                        cursor: otpCountdown > 0 ? "default" : "pointer",
                        padding: 0
                      }}
                    >
                      {otpCountdown > 0 ? `Resend code in ${otpCountdown}s` : "Resend Code"}
                    </button>
                  </div>
                </form>
              </div>
            ) : regMode === "join_org" ? (
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>
                  Join Organization with Invite Code
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px" }}>
                  Enter the organization code. Your email will be verified against the invitation issued by the organization owner.
                </p>

                <div style={{
                  padding: "12px 14px",
                  background: "var(--accent-blue-subtle)",
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom: "18px",
                  lineHeight: "1.5"
                }}>
                  <strong>Owner Authorization Required:</strong> For platform security, only email addresses pre-authorized or invited by the institution owner can join with an invite code.
                </div>

                <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Organization Invite Code
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={authInviteCode}
                      onChange={(e) => setAuthInviteCode(e.target.value.toUpperCase())}
                      placeholder="ORG-YOUR-INSTITUTE"
                      style={{ fontFamily: "monospace", letterSpacing: "1px", textTransform: "uppercase" }}
                      required
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      Begins with "ORG-" followed by the institution name (e.g., ORG-ALLEN-KOTA).
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Prof. Ananya Sen"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Invited Email Address
                    </label>
                    <input
                      type="email"
                      className="lunaris-input"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="faculty@allen.ac.in"
                      required
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      Must match the email address where the institution owner sent your invite.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Create Password
                    </label>
                    <input
                      type="password"
                      className="lunaris-input"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                    />
                  </div>

                  {/* Security CAPTCHA Box */}
                  <div style={{
                    padding: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Security Verification (CAPTCHA)
                      </label>
                      <button
                        type="button"
                        onClick={loadRegCaptcha}
                        style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                      >
                         Refresh
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <div
                        dangerouslySetInnerHTML={{ __html: regCaptcha.svg || "" }}
                        style={{ height: "46px", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1", flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        className="lunaris-input"
                        value={regCaptchaInput}
                        onChange={(e) => setRegCaptchaInput(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        maxLength={6}
                        style={{ height: "46px", fontFamily: "monospace", fontSize: "16px", fontWeight: "800", letterSpacing: "2px", textTransform: "uppercase" }}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={authLoading}
                    style={{ marginTop: "10px", height: "44px", fontSize: "14px" }}
                  >
                    {authLoading ? "Verifying with Owner & Sending Code..." : "Verify Email & Join Workspace →"}
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0 6px" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>OR</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerGoogleSignIn("signup")}
                    disabled={authLoading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      height: "44px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#334155",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Continue with Google
                  </button>
                </form>
              </div>
            ) : (
              /* MODE 2: CREATE NEW WORKSPACE */
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "4px" }}>
                  Create Account & Register Workspace
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
                  Set up your educator workspace. Free tier is activated instantly; paid tiers require payment verification.
                </p>

                {/* Interactive Plan Selector Bar */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "8px" }}>
                    1. Select Desired Subscription Tier:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "10px"
                    }}
                  >
                    {(plans.length > 0 ? plans : [
                      { code: "free", name: "Free Starter", price_inr: 0, badge: "25 candidates" },
                      { code: "creator_pro", name: "Creator Pro", price_inr: 499, badge: "250 candidates" },
                      { code: "institution", name: "Institution", price_inr: 8999, badge: "Proctoring + 5k" }
                    ]).map((plan) => {
                      const code = plan.code || plan.id;
                      const isSelected = selectedPlan === plan.code;
                      return (
                        <div
                          key={plan.code}
                          onClick={() => setSelectedPlan(plan.code)}
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            border: isSelected ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                            background: isSelected ? "var(--accent-blue-subtle)" : "#ffffff",
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <strong style={{ display: "block", fontSize: "13px", color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                            {plan.name}
                          </strong>
                          <div style={{ fontSize: "14px", fontWeight: "800", margin: "2px 0" }}>
                            {plan.price}
                          </div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {plan.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Strict Notice regarding payment approval for paid plans */}
                {selectedPlan !== "free" && (
                  <div style={{
                    padding: "12px 14px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#92400e",
                    marginBottom: "18px",
                    lineHeight: "1.5"
                  }}>
                    <strong>Payment Approval Policy:</strong> To prevent unauthorized quota allotments, all workspaces start on the Free Starter tier upon registration. Your selected <strong>{selectedPlan === "creator_pro" ? "Creator Pro" : "Institution"}</strong> quotas and proctoring features will automatically activate once your UPI payment is submitted and approved by the SuperAdmin in your workspace Billing tab.
                  </div>
                )}

                <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700" }}>
                    2. Account & Workspace Credentials:
                  </label>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Prof. Ananya Sen"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Academy or Organization Name
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={authOrgName}
                      onChange={(e) => setAuthOrgName(e.target.value)}
                      placeholder="Apex Academic & Assessment Academy"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Work Email Address
                    </label>
                    <input
                      type="email"
                      className="lunaris-input"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="faculty@institution.org"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Password
                    </label>
                    <input
                      type="password"
                      className="lunaris-input"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                    />
                  </div>

                  {/* Security CAPTCHA Box */}
                  <div style={{
                    padding: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Security Verification (CAPTCHA)
                      </label>
                      <button
                        type="button"
                        onClick={loadRegCaptcha}
                        style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                      >
                         Refresh
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <div
                        dangerouslySetInnerHTML={{ __html: regCaptcha.svg || "" }}
                        style={{ height: "46px", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1", flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        className="lunaris-input"
                        value={regCaptchaInput}
                        onChange={(e) => setRegCaptchaInput(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        maxLength={6}
                        style={{ height: "46px", fontFamily: "monospace", fontSize: "16px", fontWeight: "800", letterSpacing: "2px", textTransform: "uppercase" }}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={authLoading}
                    style={{ marginTop: "10px", height: "44px", fontSize: "14px" }}
                  >
                    {authLoading
                      ? "Sending Verification Code..."
                      : selectedPlan === "free"
                        ? "Verify Email & Create Workspace →"
                        : `Verify Email & Continue to ${selectedPlan === "creator_pro" ? "Creator Pro" : "Institution"} →`}
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0 6px" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>OR</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerGoogleSignIn("signup")}
                    disabled={authLoading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      height: "44px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#334155",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Sign up with Google
                  </button>
                </form>
              </div>
            )}

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)", textAlign: "center", fontSize: "13px" }}>
              Already registered?{" "}
              <span
                style={{ color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" }}
                onClick={() => changeRouteTab("login")}
              >
                Sign in to existing account
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Landing Page Native Banner */}
      {activeTab === "home" && (
        <div style={{ maxWidth: "1120px", margin: "0 auto", padding: "12px 24px 28px" }}>
          <AdSlot placement="NativeBanner_1" show={true} />
        </div>
      )}

      {/* Clean Public Footer */}
      <footer
        className="public-footer"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "36px 32px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          fontSize: "13px",
          color: "var(--text-muted)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="/logo.png"
            alt="Lunaris"
            style={{ width: "24px", height: "24px", objectFit: "contain", borderRadius: "50%" }}
          />
          <span>© 2026 Lunaris Assessment Platform. All rights reserved.</span>
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => changeRouteTab("features")}
            style={{ background: "none", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" }}
          >
            Features & Modes
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("pricing")}
            style={{ background: "none", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" }}
          >
            Pricing & Plans
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("login")}
            style={{ background: "none", color: "var(--accent-blue)", fontWeight: "700", cursor: "pointer" }}
          >
            Sign In
          </button>
        </div>
      </footer>
    </div>
  );
}
