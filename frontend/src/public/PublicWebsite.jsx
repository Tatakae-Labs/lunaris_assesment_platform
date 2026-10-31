import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api";

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

  useEffect(() => {
    loadLoginCaptcha();
    loadRegCaptcha();
    loadGoogleConfig();
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

    function initGsi() {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false
          });
        } catch (e) {
          console.warn("Google GSI init notice:", e);
        }
      }
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
        loginCaptchaInput.trim()
      );

      // Validate role expectation if logging in specifically through the SuperAdmin tab
      if (loginRoleTab === "superadmin" && !res.is_superadmin) {
        throw new Error("Access Denied: This account does not possess SuperAdmin privileges. Please use the Workspace Login tab.");
      }

      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      }
      if (res.is_superadmin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
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
        invite_code: activeTab === "signup" && regMode === "join_org" ? authInviteCode.trim().toUpperCase() : undefined,
        organization_name: authOrgName.trim() || undefined
      });

      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) onLoginSuccess(res);
      if (res.is_superadmin) navigate("/admin");
      else navigate("/dashboard");
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
                invite_code: mode === "signup" && regMode === "join_org" ? authInviteCode.trim().toUpperCase() : undefined,
                organization_name: authOrgName.trim() || undefined
              });

              localStorage.setItem("lunaris_token", res.access_token);
              localStorage.setItem("lunaris_user", JSON.stringify(res));
              if (onLoginSuccess) onLoginSuccess(res);
              if (res.is_superadmin) navigate("/admin");
              else navigate("/dashboard");
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
      }
      navigate("/dashboard");
    } catch (err) {
      setAuthError(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Alias for backward compatibility if invoked anywhere
  const handleRegisterSubmit = handleRequestOtp;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
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
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
              Assessment SaaS Platform
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
                {currentUser.is_superadmin ? "🛡️ Go to Admin Portal →" : "🏢 Go to Dashboard →"}
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
          {mobileMenuOpen ? "✕" : "☰"}
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
                {currentUser.is_superadmin ? "🛡️ Go to Admin Portal →" : "🏢 Go to Dashboard →"}
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
              padding: "80px 24px 60px",
              maxWidth: "1160px",
              margin: "0 auto",
              textAlign: "center"
            }}
          >
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--accent-blue-subtle)",
              color: "var(--accent-blue)",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "700",
              marginBottom: "20px",
              border: "1px solid rgba(37, 99, 235, 0.15)"
            }}>
              <span>✦</span> Enterprise Assessment SaaS • Pure White Architecture
            </div>

            <h1
              className="hero-headline"
              style={{
                fontSize: "48px",
                fontWeight: "900",
                letterSpacing: "-0.8px",
                lineHeight: "1.15",
                color: "var(--text-primary)",
                marginBottom: "20px"
              }}
            >
              High-Stakes Examination Engine with <br />
              <span style={{ color: "var(--accent-blue)" }}>Modular Face & Integrity Proctoring</span>
            </h1>

            <p
              className="hero-subtitle"
              style={{
                fontSize: "18px",
                color: "var(--text-secondary)",
                maxWidth: "760px",
                margin: "0 auto 36px",
                lineHeight: "1.6"
              }}
            >
              Create custom exams, invite students using secure UIDs with zero account creation required,
              and monitor results with NTA JEE-standard CBT test engines.
            </p>

            {/* Quick Actions */}
            <div className="hero-actions" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "30px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("free")}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                Create Workspace Account →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => changeRouteTab("login")}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                Sign In to Platform
              </button>
            </div>
          </section>

          {/* Three Assessment Modes */}
          <section style={{ padding: "40px 24px 70px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ maxWidth: "1160px", margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: "40px" }}>
                <h2 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)" }}>
                  Three Scalable Assessment Modes
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "6px" }}>
                  Tailored engines for low-stakes classroom checks, gamified engagement, and strict high-stakes CBTs.
                </p>
              </div>

              <div
                className="responsive-grid-3"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "24px"
                }}
              >
                {/* Mode 1: Standard Quiz */}
                <div className="dash-card" style={{ padding: "28px", background: "#ffffff" }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "var(--accent-blue-subtle)",
                    color: "var(--accent-blue)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "22px",
                    marginBottom: "16px"
                  }}>
                    📋
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                    Standard Quiz
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "16px" }}>
                    Asynchronous modular assessments for regular chapter tests, homework checks, and hiring screenings.
                  </p>
                  <ul style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.8", paddingLeft: "18px" }}>
                    <li>Instant automatic grading & scorecards</li>
                    <li>MCQ & Numerical question banks</li>
                    <li>Configurable shuffle & review options</li>
                  </ul>
                </div>

                {/* Mode 2: Quick Quiz Arena */}
                <div className="dash-card" style={{ padding: "28px", background: "#ffffff" }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "var(--accent-amber-subtle)",
                    color: "var(--accent-amber)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "22px",
                    marginBottom: "16px"
                  }}>
                    ⚡
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                    Quick Quiz Arena
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "16px" }}>
                    Live Kahoot-style engagement mode for classroom buzzer quizzes with per-question timers and speed scoring.
                  </p>
                  <ul style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.8", paddingLeft: "18px" }}>
                    <li>6-digit join room codes</li>
                    <li>Speed-weighted bonus points</li>
                    <li>Real-time podium leaderboard</li>
                  </ul>
                </div>

                {/* Mode 3: NTA JEE Main CBT */}
                <div className="dash-card" style={{ padding: "28px", background: "#ffffff", border: "1.5px solid var(--accent-blue)" }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "var(--accent-blue-subtle)",
                    color: "var(--accent-blue)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "22px",
                    marginBottom: "16px"
                  }}>
                    🏛️
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                    NTA Proctored CBT Engine
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "16px" }}>
                    Pixel-perfect recreation of official Indian JEE Main CBT interface with 5-color status palettes and virtual numerical keypads.
                  </p>
                  <ul style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.8", paddingLeft: "18px" }}>
                    <li>Section switching (Physics, Chem, Math)</li>
                    <li>Server-authoritative synchronized clock</li>
                    <li>On-device MediaPipe integrity monitoring</li>
                  </ul>
                </div>
              </div>
            </div>
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
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginBottom: "8px" }}>
                1. Exam-Specific UID Candidate Enrollment
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Students take exams without creating a permanent account or password. Instructors generate batch UIDs
                with PINs or import candidate CSVs. Rate-limited validation ensures eligibility and attempt constraints.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginBottom: "8px" }}>
                2. On-Device MediaPipe Face & Behavior Telemetry
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Zero continuous video upload costs. MediaPipe tracks face presence, multiple faces, and head direction
                on the client. Flags are saved as advisory evidence for human review—never automated candidate failure.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginBottom: "8px" }}>
                3. AI Question Studio & PDF Import
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Generate JEE-standard Single MCQ, Multiple MCQ, and Numerical questions across Physics, Chemistry,
                and Mathematics in seconds. Strict JSON schema validation with LaTeX math support.
              </p>
            </div>

            <div className="dash-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginBottom: "8px" }}>
                4. Live Proctor Invigilation Console
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Invigilators monitor active sessions with synchronized health signals, flagged anomaly timelines,
                encrypted snapshot evidence review, and formal appeal audit trails.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Pricing View */}
      {activeTab === "pricing" && (
        <section style={{ maxWidth: "1160px", margin: "40px auto 80px", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "36px", fontWeight: "900", color: "var(--text-primary)" }}>
              Transparent, Entitlement-Based Pricing
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>
              Choose a plan to provision your workspace. All paid subscriptions require UPI payment approval before activation.
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
            {/* Free */}
            <div className="dash-card" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "8px" }}>Free Starter</div>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", marginBottom: "16px" }}>
                ₹0 <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-muted)" }}>/ forever</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                For individual educators and testing the platform.
              </p>
              <ul style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "2", flex: 1, marginBottom: "24px", listStyle: "none" }}>
                <li>✓ 3 Published Exams</li>
                <li>✓ 30 Candidates per exam</li>
                <li>✓ 20 AI Question Drafts</li>
                <li>✓ Standard Quiz engine</li>
                <li>✗ Full proctoring module</li>
              </ul>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleOpenSignupWithPlan("free")}
                style={{ width: "100%" }}
              >
                Choose Free Starter
              </button>
            </div>

            {/* Creator Pro */}
            <div className="dash-card" style={{ padding: "32px", display: "flex", flexDirection: "column", border: "1.5px solid var(--accent-blue)" }}>
              <div style={{ fontWeight: "700", fontSize: "18px", color: "var(--accent-blue)", marginBottom: "8px" }}>
                Creator Pro (Popular)
              </div>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", marginBottom: "16px" }}>
                ₹499 <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-muted)" }}>/ month</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                For coaching classes, independent faculty, and recruiters.
              </p>
              <ul style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "2", flex: 1, marginBottom: "24px", listStyle: "none" }}>
                <li>✓ 50 Published Exams</li>
                <li>✓ 250 Candidates per exam</li>
                <li>✓ 500 AI Question Generation Credits</li>
                <li>✓ PDF document import</li>
                <li>✓ Quick Quiz buzzer arena</li>
                <li>✓ 3 Team Author seats</li>
              </ul>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("creator_pro")}
                style={{ width: "100%" }}
              >
                Choose Creator Pro →
              </button>
            </div>

            {/* Institution */}
            <div className="dash-card" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "8px" }}>Institution Proctored</div>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", marginBottom: "16px" }}>
                ₹1,999 <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-muted)" }}>/ month</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                For engineering colleges, large coaching institutes, and testing centers.
              </p>
              <ul style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "2", flex: 1, marginBottom: "24px", listStyle: "none" }}>
                <li>✓ 500 Published Exams</li>
                <li>✓ 5,000 Candidates per exam</li>
                <li>✓ Full NTA JEE CBT Engine</li>
                <li>✓ On-Device MediaPipe Proctoring</li>
                <li>✓ Live Invigilation Console</li>
                <li>✓ 15 Team Members & Reviewers</li>
              </ul>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("institution")}
                style={{ width: "100%" }}
              >
                Choose Institution →
              </button>
            </div>
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
                🏢 Workspace Login
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
                🛡️ SuperAdmin Login
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
                🏢 Create New Workspace
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
                🔑 Join Existing Organization
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
                  <div style={{ fontSize: "40px", marginBottom: "8px" }}>📩</div>
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
                  🔒 <strong>Owner Authorization Required:</strong> For platform security, only email addresses pre-authorized or invited by the institution owner can join with an invite code.
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
                    {[
                      { code: "free", name: "Free Starter", price: "₹0", badge: "30 candidates" },
                      { code: "creator_pro", name: "Creator Pro", price: "₹499/mo", badge: "250 candidates" },
                      { code: "institution", name: "Institution", price: "₹1,999/mo", badge: "Proctoring + 5k" }
                    ].map((plan) => {
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
                    <strong>⚠️ Payment Approval Policy:</strong> To prevent unauthorized quota allotments, all workspaces start on the Free Starter tier upon registration. Your selected <strong>{selectedPlan === "creator_pro" ? "Creator Pro" : "Institution"}</strong> quotas and proctoring features will automatically activate once your UPI payment is submitted and approved by the SuperAdmin in your workspace Billing tab.
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
                      placeholder="Apex IIT JEE Academy"
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
          <span>© 2026 Lunaris Assessment Systems. Pure white-theme SaaS architecture.</span>
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
