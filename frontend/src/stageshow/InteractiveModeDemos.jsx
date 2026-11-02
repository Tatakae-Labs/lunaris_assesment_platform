import React, { useState } from "react";

/**
 * InteractiveModeDemos - Pixel-accurate interactive test-benches
 * Gives visitors immediate tactile engagement with the real mechanics of Lunaris:
 * 1. Specialized CBT Runner (section tabs, responsive item palette, proctor box)
 * 2. AI Question Studio (Groq Llama 3.3, LaTeX formatting, schema validation)
 * 3. Live Proctor Surveillance Console (CCTV feed, anomaly logs, warning dispatcher)
 */
export default function InteractiveModeDemos() {
  const [activeTab, setActiveTab] = useState("cbt");

  // CBT State
  const [cbtSelectedOption, setCbtSelectedOption] = useState("B");
  const [activeSubject, setActiveSubject] = useState("PHYSICS");
  const [cbtQuestionStatus, setCbtQuestionStatus] = useState({
    1: "answered",
    2: "not_answered",
    3: "marked",
    4: "not_visited",
    5: "not_visited"
  });
  const [activeQ, setActiveQ] = useState(1);

  // AI Studio State
  const [aiTopic, setAiTopic] = useState("Rotational Dynamics");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSnippet, setGeneratedSnippet] = useState({
    subject: "Physics",
    title: "Rolling Without Slipping with Variable Incline",
    question: "A uniform solid sphere of mass M and radius R rolls without slipping down an inclined plane of inclination θ. The minimum coefficient of static friction μ required is:",
    formula: "μ_min = (2/7) · tan θ",
    correct: "Option A: (2/7) tan θ"
  });

  // Proctor Console Simulator State
  const [proctorIncidentCount, setProctorIncidentCount] = useState(0);
  const [proctorStatus, setProctorStatus] = useState("Nominal / Verified");
  const [proctorLogs, setProctorLogs] = useState([
    { time: "10:14:02", text: "Session initialized for UID LUN-981240 (Rugved Kadu)", type: "info" },
    { time: "10:15:20", text: "MediaPipe FaceMesh calibrated (Zero anomalies)", type: "success" }
  ]);

  function handleCbtAction(action) {
    setCbtQuestionStatus((prev) => {
      const copy = { ...prev };
      if (action === "save") copy[activeQ] = "answered";
      if (action === "mark") copy[activeQ] = "marked";
      if (action === "clear") {
        copy[activeQ] = "not_answered";
        setCbtSelectedOption(null);
      }
      return copy;
    });
    if (action !== "clear" && activeQ < 5) {
      setActiveQ((prev) => prev + 1);
    }
  }

  function handleTriggerAiGenerate() {
    setIsGenerating(true);
    setTimeout(() => {
      if (aiTopic === "Rotational Dynamics") {
        setGeneratedSnippet({
          subject: "Physics",
          title: "Angular Momentum Conservation in Collision",
          question: "A rod of length L and mass M pivoted at one end is struck horizontally at distance x from the pivot by a particle of mass m moving with speed v. The impulse on the pivot vanishes when x equals:",
          formula: "x = (2/3) L  (Center of Percussion)",
          correct: "Option B: (2/3) L"
        });
      } else if (aiTopic === "Organic Mechanisms") {
        setGeneratedSnippet({
          subject: "Chemistry",
          title: "Aldol Condensation & Conjugation",
          question: "When acetaldehyde is treated with dilute NaOH followed by heating, the primary conjugated product formed undergoes ozonolysis to yield:",
          formula: "CH₃-CH=CH-CHO + O₃ → CH₃CHO + OHC-CHO",
          correct: "Option C: But-2-enal"
        });
      } else {
        setGeneratedSnippet({
          subject: "Mathematics",
          title: "Orthogonal Trajectories of Hyperbolas",
          question: "The differential equation representing the family of curves xy = c gives orthogonal trajectories satisfying the differential form:",
          formula: "dy/dx = y/x  =>  x² - y² = k",
          correct: "Option A: Rectangular Hyperbolas"
        });
      }
      setIsGenerating(false);
    }, 600);
  }

  function simulateProctorIncident(type) {
    const time = new Date().toLocaleTimeString();
    if (type === "head_turn") {
      setProctorIncidentCount((prev) => prev + 1);
      setProctorStatus("Advisory Flag: Head Gaze Deviation");
      setProctorLogs((prev) => [
        { time, text: "Candidate head gaze pitch/yaw > 32° for 3.1s", type: "warn" },
        ...prev
      ]);
    } else if (type === "tab_switch") {
      setProctorIncidentCount((prev) => prev + 1);
      setProctorStatus("Security Incident: Window Focus Lost");
      setProctorLogs((prev) => [
        { time, text: "Visibility API: Candidate navigated away / Alt-Tab", type: "danger" },
        ...prev
      ]);
    } else {
      setProctorStatus("Nominal / Verified");
      setProctorLogs((prev) => [
        { time, text: "Proctor reviewed snapshot and cleared advisory flag", type: "success" },
        ...prev
      ]);
    }
  }

  return (
    <section style={{ padding: "40px 24px 80px", maxWidth: "1180px", margin: "0 auto" }}>
      {/* Interactive Tabs Pill Header */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
        <div
          className="interactive-tabs-container"
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "5px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            gap: "4px"
          }}
        >
          {[
            { id: "cbt", label: "Specialized CBT Assessment Runner" },
            { id: "ai", label: "AI Question Studio" },
            { id: "proctor", label: "Live Proctor CCTV Console" }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: activeTab === t.id ? "700" : "500",
                background: activeTab === t.id ? "#ffffff" : "transparent",
                color: activeTab === t.id ? "#2563eb" : "#475569",
                boxShadow: activeTab === t.id ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                transition: "all 0.16s ease"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SPECIALIZED CBT ASSESSMENT RUNNER */}
      {/* ========================================================= */}
      {activeTab === "cbt" && (
        <div
          style={{
            background: "#0a0f1d",
            borderRadius: "14px",
            border: "1px solid #1e293b",
            overflow: "hidden",
            boxShadow: "0 20px 45px rgba(0, 0, 0, 0.4)"
          }}
        >
          {/* Top Banner (Identical to JeeExamPortal.jsx) */}
          <div
            className="interactive-cbt-header"
            style={{
              height: "54px",
              background: "#0f172a",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{ width: "24px", height: "24px", objectFit: "contain", borderRadius: "50%", background: "#fff" }}
              />
              <span style={{
                background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                color: "#fff",
                fontWeight: "800",
                fontSize: "13px",
                padding: "3px 8px",
                borderRadius: "4px"
              }}>
                LUNARIS CBT
              </span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>
                Specialized CBT Engine • Live Assessment Session
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#1e293b",
                padding: "4px 12px",
                borderRadius: "6px",
                border: "1px solid #334155"
              }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>TIME REMAINING:</span>
                <span style={{ fontSize: "15px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
                  02:58:34
                </span>
              </div>
              <button
                type="button"
                style={{
                  padding: "6px 14px",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "none"
                }}
              >
                Submit Paper
              </button>
            </div>
          </div>

          {/* Subject Navigation Tabs */}
          <div style={{
            height: "38px",
            background: "#0b1329",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: "4px"
          }}>
            {["PHYSICS", "CHEMISTRY", "MATHEMATICS"].map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setActiveSubject(subj)}
                style={{
                  padding: "8px 18px",
                  fontSize: "12px",
                  fontWeight: "700",
                  borderRadius: "4px 4px 0 0",
                  background: activeSubject === subj ? "#1e293b" : "transparent",
                  color: activeSubject === subj ? "#38bdf8" : "#94a3b8",
                  border: "none",
                  borderBottom: activeSubject === subj ? "2px solid #38bdf8" : "none",
                  cursor: "pointer"
                }}
              >
                {subj}
              </button>
            ))}
          </div>

          {/* Main Body: Question Viewer (Left) & Palette + Proctor Bubble (Right) */}
          <div className="interactive-cbt-split" style={{ display: "flex", minHeight: "360px" }}>
            {/* Left Question Viewer */}
            <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "10px",
                borderBottom: "1px solid #1e293b",
                marginBottom: "16px"
              }}>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#f8fafc" }}>
                  Question {activeQ} ({activeSubject} - Section A (MCQ))
                </span>
                <span style={{ fontSize: "11px", background: "#1e293b", color: "#38bdf8", padding: "2px 8px", borderRadius: "4px" }}>
                  Marking Scheme: +4 / -1
                </span>
              </div>

              <div style={{ fontSize: "14px", color: "#e2e8f0", lineHeight: "1.6", marginBottom: "18px" }}>
                A particle is executing simple harmonic motion with amplitude A. When its displacement from equilibrium is x = A/√2,
                the ratio of its kinetic energy to potential energy is:
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {[
                  { id: "A", text: "1 : 1" },
                  { id: "B", text: "2 : 1" },
                  { id: "C", text: "1 : 2" },
                  { id: "D", text: "1 : 4" }
                ].map((opt) => {
                  const isSelected = cbtSelectedOption === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setCbtSelectedOption(opt.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        background: isSelected ? "rgba(59, 130, 246, 0.16)" : "#0f172a",
                        border: `1px solid ${isSelected ? "#3b82f6" : "#1e293b"}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "#3b82f6" : "#475569"}`,
                        display: "grid",
                        placeItems: "center",
                        background: isSelected ? "#3b82f6" : "transparent"
                      }}>
                        {isSelected && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <span style={{ fontSize: "13px", color: isSelected ? "#ffffff" : "#cbd5e1", fontFamily: "var(--font-mono)" }}>
                        <strong>({opt.id})</strong> {opt.text}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CBT Assessment Action Controls Footer */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "16px",
                borderTop: "1px solid #1e293b",
                marginTop: "16px"
              }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleCbtAction("mark")}
                    style={{ padding: "8px 14px", background: "#7e22ce", color: "#fff", fontSize: "12px", fontWeight: "600", borderRadius: "6px", border: "none", cursor: "pointer" }}
                  >
                    Save & Mark for Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCbtAction("clear")}
                    style={{ padding: "8px 14px", background: "#334155", color: "#f8fafc", fontSize: "12px", fontWeight: "600", borderRadius: "6px", border: "none", cursor: "pointer" }}
                  >
                    Clear Response
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCbtAction("mark")}
                    style={{ padding: "8px 14px", background: "#9333ea", color: "#fff", fontSize: "12px", fontWeight: "600", borderRadius: "6px", border: "none", cursor: "pointer" }}
                  >
                    Mark for Review & Next
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCbtAction("save")}
                  style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", fontSize: "13px", fontWeight: "bold", borderRadius: "6px", border: "none", cursor: "pointer" }}
                >
                  Save & Next →
                </button>
              </div>
            </div>

            {/* Right Side: Proctor Bubble + Item Status Palette */}
            <div style={{ width: "280px", background: "#0b1329", borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column" }}>
              {/* Proctor Bubble */}
              <div style={{
                height: "120px",
                background: "#020617",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "32px" }}></div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Candidate: Rugved (LUN-981240)</div>
                </div>
                <div style={{
                  position: "absolute",
                  top: "6px",
                  left: "6px",
                  background: "rgba(15, 23, 42, 0.85)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  color: "#22c55e",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
                  Live AI Proctoring (0 Flags)
                </div>
              </div>

              {/* Item Status Palette */}
              <div style={{ flex: 1, padding: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", marginBottom: "8px" }}>
                  QUESTION PALETTE
                </div>

                {/* Status Legend */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px", color: "#cbd5e1", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#16a34a", borderRadius: "2px" }} />
                    <span>Answered</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#dc2626", borderRadius: "2px" }} />
                    <span>Not Answered</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#9333ea", borderRadius: "2px" }} />
                    <span>Marked</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "#475569", borderRadius: "2px" }} />
                    <span>Not Visited</span>
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginBottom: "8px" }}>
                  SELECT QUESTION NUMBER:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((q) => {
                    const status = cbtQuestionStatus[q] || "not_visited";
                    let bg = "#334155";
                    let color = "#ffffff";
                    if (status === "answered") { bg = "#16a34a"; }
                    else if (status === "not_answered") { bg = "#dc2626"; }
                    else if (status === "marked") { bg = "#9333ea"; }

                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setActiveQ(q)}
                        style={{
                          height: "32px",
                          borderRadius: "4px",
                          background: activeQ === q ? "#2563eb" : bg,
                          color: color,
                          border: activeQ === q ? "2px solid #38bdf8" : "none",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer"
                        }}
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AI QUESTION STUDIO                                 */}
      {/* ========================================================= */}
      {activeTab === "ai" && (
        <div
          className="dash-card"
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "28px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
          }}
        >
          <div className="interactive-ai-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: "4px" }}>
                AI QUESTION STUDIO
              </span>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                Groq LLaMA-3.3 Powered Question Synthesis
              </h3>
            </div>

            <div className="interactive-ai-controls" style={{ display: "flex", gap: "8px" }}>
              <select
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "600" }}
              >
                <option value="Rotational Dynamics">Physics: Rotational Dynamics</option>
                <option value="Organic Mechanisms">Chemistry: Organic Reaction Mechanisms</option>
                <option value="Calculus Differential">Math: Differential Calculus & Orthogonal Trajectories</option>
              </select>

              <button
                type="button"
                onClick={handleTriggerAiGenerate}
                disabled={isGenerating}
                style={{
                  padding: "6px 16px",
                  background: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {isGenerating ? "Synthesizing..." : "Generate Question"}
              </button>
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb" }}>
                {generatedSnippet.subject} • {generatedSnippet.title}
              </span>
              <span style={{ fontSize: "11px", color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: "4px", fontWeight: "700" }}>
                Strict JSON Schema Verified
              </span>
            </div>

            <p style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.6", marginBottom: "12px" }}>
              {generatedSnippet.question}
            </p>

            <div
              style={{
                padding: "10px 14px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "#0f172a",
                marginBottom: "12px"
              }}
            >
              Solution Formula: {generatedSnippet.formula}
            </div>

            <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: "700" }}>
              Answer Key: {generatedSnippet.correct}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LIVE PROCTOR CCTV CONSOLE                          */}
      {/* ========================================================= */}
      {activeTab === "proctor" && (
        <div
          className="dash-card"
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "28px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
          }}
        >
          <div className="interactive-ai-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", background: "#fee2e2", padding: "3px 8px", borderRadius: "4px" }}>
                LIVE INTEGRITY CONSOLE
              </span>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                MediaPipe Client Telemetry & Real-Time Incident Review
              </h3>
            </div>

            <div className="interactive-ai-controls" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => simulateProctorIncident("head_turn")}
                style={{ padding: "6px 12px", background: "#fef3c7", color: "#b45309", borderRadius: "6px", fontSize: "12px", fontWeight: "700", border: "1px solid #fde68a", cursor: "pointer" }}
              >
                Simulate Head Deviation
              </button>
              <button
                type="button"
                onClick={() => simulateProctorIncident("tab_switch")}
                style={{ padding: "6px 12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", fontSize: "12px", fontWeight: "700", border: "1px solid #fecaca", cursor: "pointer" }}
              >
                Simulate Window Blur (Alt-Tab)
              </button>
              <button
                type="button"
                onClick={() => simulateProctorIncident("clear")}
                style={{ padding: "6px 12px", background: "#f1f5f9", color: "#475569", borderRadius: "6px", fontSize: "12px", fontWeight: "700", border: "none", cursor: "pointer" }}
              >
                Clear Advisory
              </button>
            </div>
          </div>

          <div className="interactive-proctor-split" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
            {/* Candidate Feed Mockup */}
            <div style={{ background: "#0f172a", borderRadius: "10px", padding: "18px", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "8px" }}></div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>UID: LUN-981240</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>Candidate: Rugved Kadu</div>
              <div style={{ marginTop: "12px", fontSize: "11px", padding: "4px 12px", borderRadius: "12px", background: proctorIncidentCount > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)", color: proctorIncidentCount > 0 ? "#f87171" : "#34d399", fontWeight: "700" }}>
                {proctorStatus}
              </div>
            </div>

            {/* Audit Log Stream */}
            <div style={{ background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "14px", maxHeight: "180px", overflowY: "auto" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#475569", marginBottom: "8px" }}>
                REAL-TIME TELEMETRY AUDIT TRAIL ({proctorIncidentCount} Flagged)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {proctorLogs.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: log.type === "danger" ? "#fee2e2" : log.type === "warn" ? "#fffbeb" : "#ffffff",
                      color: log.type === "danger" ? "#991b1b" : log.type === "warn" ? "#92400e" : "#334155",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <span style={{ fontWeight: "700" }}>[{log.time}]</span>
                    <span>{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
