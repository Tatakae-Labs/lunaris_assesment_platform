import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../shared/api";

export default function PublicWebsite({
  initialTab = "home",
  currentUser,
  onNavigateToDashboard,
  onLogout,
  onNavigateToCandidate,
  onLoginSuccess,
  onNavigateToPlatformAdmin
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || "home"); // 'home', 'features', 'pricing', 'join_org', 'security', 'login', 'signup'
  const [candidateUid, setCandidateUid] = useState("LUN-AIR-2026");
  const [candidatePin, setCandidatePin] = useState("2026");
  const [examSlug, setExamSlug] = useState("allen-kota-mock");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  function changeRouteTab(tabName) {
    setActiveTab(tabName);
    if (tabName === "home") navigate("/");
    else if (tabName === "features") navigate("/features");
    else if (tabName === "pricing") navigate("/pricing");
    else if (tabName === "login") navigate("/login");
    else if (tabName === "signup") navigate("/register");
    else if (tabName === "join_org") navigate("/join");
    else if (tabName === "security") navigate("/security");
  }

  // Selected Plan for Onboarding: 'free', 'creator_pro', 'institution'
  const [selectedPlan, setSelectedPlan] = useState("free");

  // Auth Form State
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authOrgName, setAuthOrgName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Join Org with Code State
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  function handleOpenSignupWithPlan(planCode) {
    setSelectedPlan(planCode);
    setAuthError("");
    setActiveTab("signup");
    navigate("/register");
  }

  async function handleCreatorLogin(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.login(authEmail, authPassword);
      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      }
      navigate("/dashboard");
    } catch (err) {
      setAuthError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreatorRegister(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.register({
        email: authEmail,
        password: authPassword,
        full_name: authFullName,
        organization_name: authOrgName || `${authFullName}'s Academy`,
        plan_id: selectedPlan
      });
      localStorage.setItem("lunaris_token", res.access_token);
      localStorage.setItem("lunaris_user", JSON.stringify(res));
      if (onLoginSuccess) {
        onLoginSuccess(res);
      }
      navigate("/dashboard");
    } catch (err) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleJoinOrg(e) {
    e.preventDefault();
    if (!currentUser) {
      setJoinMessage("⚠️ Please sign in or create an account first to join an organization with an invite code.");
      return;
    }
    if (!joinCodeInput.trim()) {
      setJoinMessage("⚠️ Please enter a valid invite code (e.g. ORG-ALLEN-KOTA-MOCK).");
      return;
    }
    setJoinLoading(true);
    setJoinMessage("");
    try {
      const res = await api.joinOrganization(joinCodeInput.trim());
      setJoinMessage(`🎉 Success! You have joined "${res.org_name}" as an exam author.`);
      const updatedUser = {
        ...currentUser,
        organization_id: res.org_id,
        organization_name: res.org_name,
        role: "exam_author"
      };
      localStorage.setItem("lunaris_user", JSON.stringify(updatedUser));
      if (onLoginSuccess) {
        onLoginSuccess(updatedUser);
      }
      setTimeout(() => {
        onNavigateToDashboard();
      }, 1200);
    } catch (err) {
      setJoinMessage(`❌ Error: ${err.message || "Failed to join organization. Please check the code."}`);
    } finally {
      setJoinLoading(false);
    }
  }

  function handleStartCandidateExam(e) {
    e.preventDefault();
    if (!candidateUid.trim()) {
      alert("Please enter a valid Exam UID");
      return;
    }
    onNavigateToCandidate(examSlug, candidateUid.trim(), candidatePin.trim());
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
      {/* Top Universal Public Navbar */}
      <header style={{
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
      }}>
        {/* Brand */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          onClick={() => setActiveTab("home")}
        >
          <div style={{
            background: "linear-gradient(135deg, #2563eb 0%, #0284c7 100%)",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            fontWeight: "900",
            fontSize: "18px",
            color: "#ffffff"
          }}>
            L
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "0.5px", lineHeight: "1" }}>
              LUNARIS
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
              Assessment SaaS Platform
            </div>
          </div>
        </div>

        {/* Navigation Links: Overview, Features & Modes, Pricing & Plans */}
        <nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
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

        {/* Auth & Dashboard Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                🏢 Go to Dashboard →
              </button>
              <div style={{ textAlign: "right", fontSize: "12px", lineHeight: "1.2" }}>
                <strong style={{ color: "var(--text-primary)" }}>{currentUser.full_name || currentUser.email}</strong>
                <div style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "700", textTransform: "uppercase" }}>
                  {currentUser.organization_name || "Workspace"}
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
      </header>

      {/* Hero Section */}
      {activeTab === "home" && (
        <div>
          <section style={{
            padding: "80px 24px 60px",
            maxWidth: "1160px",
            margin: "0 auto",
            textAlign: "center"
          }}>
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
              <span>✦</span> Complete Assessment SaaS • Instant Onboarding
            </div>

            <h1 style={{
              fontSize: "48px",
              fontWeight: "900",
              letterSpacing: "-0.8px",
              lineHeight: "1.15",
              color: "var(--text-primary)",
              marginBottom: "20px"
            }}>
              High-Stakes Examination Engine with <br />
              <span style={{ color: "var(--accent-blue)" }}>Modular Face & Integrity Proctoring</span>
            </h1>

            <p style={{
              fontSize: "18px",
              color: "var(--text-secondary)",
              maxWidth: "760px",
              margin: "0 auto 36px",
              lineHeight: "1.6"
            }}>
              Create custom exams, invite students using secure UIDs with zero account creation required,
              and monitor results with NTA JEE-standard CBT test engines.
            </p>



            {/* Quick Actions & Demo Credentials */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "30px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenSignupWithPlan("creator_pro")}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                Create Creator Account & Select Plan →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab("login")}
                style={{ padding: "12px 24px", fontSize: "15px" }}
              >
                Sign In to Existing Workspace
              </button>
            </div>

            <div style={{
              display: "inline-flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-secondary)",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "12px",
              border: "1px solid var(--border-subtle)"
            }}>
              <span><strong>Faculty Login:</strong> faculty@allen.ac.in / Password123!</span>
              <span>•</span>
              <span><strong>SuperAdmin:</strong> superadmin@lunaris.com / SuperAdmin123!</span>
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

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
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
              Choose a plan to provision your workspace immediately. Enforced by backend database quotas.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px" }}>
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
                <li>✓ 25 Candidates per exam</li>
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
                <li>✓ Encrypted Evidence Vault</li>
              </ul>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleOpenSignupWithPlan("institution")}
                style={{ width: "100%" }}
              >
                Choose Institution Tier →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Security & Privacy View */}
      {activeTab === "security" && (
        <section style={{ maxWidth: "860px", margin: "40px auto 80px", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <h1 style={{ fontSize: "34px", fontWeight: "900", color: "var(--text-primary)" }}>
              Privacy, Ethics & Fairness Charter
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "6px" }}>
              Engineered with zero continuous surveillance and strict candidate rights safeguards.
            </p>
          </div>

          <div className="dash-card" style={{ padding: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px", color: "var(--accent-blue)" }}>
              ✦ No Automated Disqualification Policy
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              Under no circumstances will an AI signal, landmark pose estimate, or camera interruption automatically fail
              a student. Detection models operate strictly as risk signaling to aid authorized human reviewers.
            </p>

            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px", color: "var(--accent-blue)" }}>
              ✦ On-Device Processing
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              MediaPipe analyzes camera frames directly in the candidate's browser memory. Raw continuous video streams
              are never transmitted or stored on Lunaris servers. Only event metadata and authorized low-res snapshots
              associated with flagged incidents are retained.
            </p>

            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px", color: "var(--accent-blue)" }}>
              ✦ Strict Multi-Tenant Data Isolation
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              Organizations are strictly isolated in the database layer. One organization's faculty or proctors can never
              access another organization's candidate records, answers, or proctoring evidence.
            </p>

            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px", color: "var(--accent-blue)" }}>
              ✦ Hardware Failure & Fallback Accommodation
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              If a candidate's camera fails or browser permission is revoked, the exam does not crash. Fallback instructions
              guide the student, and the incident is documented with full context for faculty review.
            </p>
          </div>
        </section>
      )}

      {/* Join Workspace View */}
      {activeTab === "join_org" && (
        <section style={{ maxWidth: "520px", margin: "60px auto 100px", padding: "0 20px" }}>
          <div className="dash-card" style={{ padding: "36px" }}>
            <div style={{ display: "inline-flex", padding: "8px 12px", background: "var(--accent-blue-subtle)", color: "var(--accent-blue)", borderRadius: "8px", fontWeight: "700", fontSize: "12px", marginBottom: "16px" }}>
              🔑 Organization Invite Access
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>Join Workspace by Invite Code</h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "20px" }}>
              Collaborate on exam creation, review proctor logs, and grade assessments within an existing institution or faculty team.
            </p>

            {joinMessage && (
              <div style={{
                background: joinMessage.includes("❌") ? "var(--accent-rose-subtle)" : "var(--accent-emerald-subtle)",
                color: joinMessage.includes("❌") ? "var(--accent-rose)" : "var(--accent-emerald)",
                padding: "12px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                marginBottom: "20px"
              }}>
                {joinMessage}
              </div>
            )}

            {!currentUser ? (
              <div style={{ padding: "20px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>
                  Please sign in or register to join an organization
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                  Your account will be linked as an Exam Author to the target workspace upon providing the invite code.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveTab("login")}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    Sign In First
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab("signup")}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    Register Account
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleJoinOrg} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                    Organization Invite Code:
                  </label>
                  <input
                    type="text"
                    className="lunaris-input"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ORG-ALLEN-KOTA-MOCK"
                    style={{ fontFamily: "monospace", letterSpacing: "1px", textTransform: "uppercase" }}
                    required
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Invite codes begin with "ORG-" followed by the institution's identifier.
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setJoinCodeInput("ORG-ALLEN-KOTA-MOCK")}
                    style={{
                      background: "none",
                      border: "1px dashed var(--accent-blue)",
                      color: "var(--accent-blue)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Use Sample: ORG-ALLEN-KOTA-MOCK
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={joinLoading}
                  style={{ height: "44px", fontSize: "14px", marginTop: "8px" }}
                >
                  {joinLoading ? "Validating & Joining..." : "Join Workspace as Exam Author →"}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Sign In View */}
      {activeTab === "login" && (
        <section style={{ maxWidth: "440px", margin: "60px auto 100px", padding: "0 20px" }}>
          <div className="dash-card" style={{ padding: "32px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>Sign In to Workspace</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Access your assessment dashboard as an Exam Creator or Platform SuperAdmin.
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

            <form onSubmit={handleCreatorLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="lunaris-input"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="faculty@allen.ac.in"
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

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
                style={{ marginTop: "8px", height: "42px" }}
              >
                {authLoading ? "Authenticating..." : "Sign In to Workspace →"}
              </button>

              <div style={{ marginTop: "14px", padding: "10px", background: "var(--bg-secondary)", borderRadius: "6px", fontSize: "12px" }}>
                <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>One-Click Demo Sign In:</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail("faculty@allen.ac.in");
                      setAuthPassword("Password123!");
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "var(--accent-blue)"
                    }}
                  >
                    Faculty Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail("superadmin@lunaris.com");
                      setAuthPassword("SuperAdmin123!");
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "var(--text-primary)"
                    }}
                  >
                    SuperAdmin Demo
                  </button>
                </div>
              </div>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)", textAlign: "center", fontSize: "13px" }}>
              Don't have an account?{" "}
              <span
                style={{ color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" }}
                onClick={() => changeRouteTab("signup")}
              >
                Create one with a plan
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Sign Up & Plan Selection Onboarding Wizard */}
      {activeTab === "signup" && (
        <section style={{ maxWidth: "620px", margin: "40px auto 100px", padding: "0 20px" }}>
          <div className="dash-card" style={{ padding: "36px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "4px" }}>
              Create Account & Select Subscription
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Set up your educator workspace and activate your subscription entitlements.
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

            {/* Interactive Plan Selector Bar */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "8px" }}>
                1. Select Initial Subscription Tier:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {[
                  { code: "free", name: "Free Starter", price: "₹0", badge: "25 candidates" },
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

            <form onSubmit={handleCreatorRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
                  placeholder="dean@apexiit.org"
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

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
                style={{ marginTop: "10px", height: "44px", fontSize: "14px" }}
              >
                {authLoading ? "Provisioning Workspace..." : `Create Workspace on ${selectedPlan.toUpperCase()} Plan →`}
              </button>
            </form>

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

      {/* Footer */}
      <footer style={{
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
      }}>
        <div>
          © 2026 Lunaris Assessment Systems. Pure white-theme SaaS architecture.
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => changeRouteTab("join_org")}
            style={{ background: "none", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" }}
          >
            🔑 Join Workspace by Code
          </button>
          <button
            type="button"
            onClick={() => changeRouteTab("security")}
            style={{ background: "none", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" }}
          >
            🛡️ Security & Privacy
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={{ background: "none", color: "var(--accent-blue)", fontWeight: "700", cursor: "pointer" }}
          >
            🛡️ SuperAdmin Portal
          </button>
        </div>
      </footer>
    </div>
  );
}
