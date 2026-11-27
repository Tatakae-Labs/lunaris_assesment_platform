import React, { useState, useEffect } from "react";
import StageWindow from "./StageWindow";
import StageshowCursor from "./StageshowCursor";

/**
 * StageshowHeroDemo - Pixel-accurate, authentic recreation of Lunaris
 * Faithfully mirrors:
 * 1. Google Classroom student roster sync & PDF credentials sheet generation
 * 2. Real Candidate Entry Portal (/candidate/login) with Room Code, UID & PIN
 * 3. Specialized CBT Assessment Interface (section tabs, 
 *    +4/-1 marking, live MediaPipe webcam proctoring bubble, and 5-color palette)
 * 4. Submission & AI Integrity Verified Scorecard
 */
export default function StageshowHeroDemo() {
  const [step, setStep] = useState(0); // 0: Classroom Sync, 1: Enrolled Toast & PDF, 2: Candidate Login, 3: Live Institutional CBT, 4: Results & Scorecard
  const [isPlaying, setIsPlaying] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 490, y: 310 });
  const [isClicking, setIsClicking] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(179);
  const [cbtSelectedOption, setCbtSelectedOption] = useState(null);
  const [q1Answered, setQ1Answered] = useState(false);

  // Scripted beat timeline
  useEffect(() => {
    if (!isPlaying) return;

    let timeout;
    if (step === 0) {
      // Start in Classroom Sync dialog, move to "Stuff & Enroll 4 Students"
      setCbtSelectedOption(null);
      setQ1Answered(false);
      setCursorPos({ x: 380, y: 260 });
      timeout = setTimeout(() => {
        setIsClicking(true);
        setTimeout(() => {
          setIsClicking(false);
          setStep(1); // Show enrolled toast and PDF sheet
        }, 300);
      }, 1400);
    } else if (step === 1) {
      // Move to "Open Candidate Portal" or candidate pass
      timeout = setTimeout(() => {
        setCursorPos({ x: 740, y: 140 });
        setTimeout(() => {
          setIsClicking(true);
          setTimeout(() => {
            setIsClicking(false);
            setStep(2); // Jump to Candidate Login
          }, 300);
        }, 1100);
      }, 1800);
    } else if (step === 2) {
      // In Candidate Login, fields auto-filled, cursor moves to "Validate & Proceed"
      timeout = setTimeout(() => {
        setCursorPos({ x: 480, y: 360 });
        setTimeout(() => {
          setIsClicking(true);
          setTimeout(() => {
            setIsClicking(false);
            setStep(3); // Enter Live CBT
          }, 300);
        }, 1000);
      }, 1800);
    } else if (step === 3) {
      // Inside Live CBT Assessment!
      // First move cursor to Option A
      timeout = setTimeout(() => {
        setCursorPos({ x: 260, y: 265 });
        setTimeout(() => {
          setIsClicking(true);
          setCbtSelectedOption("A");
          setTimeout(() => {
            setIsClicking(false);
            // Now move to "Save & Next" button
            setTimeout(() => {
              setCursorPos({ x: 530, y: 410 });
              setTimeout(() => {
                setIsClicking(true);
                setQ1Answered(true);
                setTimeout(() => {
                  setIsClicking(false);
                  // Now move to "Submit Paper"
                  setTimeout(() => {
                    setCursorPos({ x: 860, y: 72 });
                    setTimeout(() => {
                      setIsClicking(true);
                      setTimeout(() => {
                        setIsClicking(false);
                        setStep(4); // Scorecard
                      }, 300);
                    }, 1000);
                  }, 1200);
                }, 300);
              }, 1000);
            }, 800);
          }, 250);
        }, 900);
      }, 1000);
    } else if (step === 4) {
      // Scorecard payoff hold, then smooth seamless loop
      timeout = setTimeout(() => {
        setStep(0);
      }, 3600);
    }

    return () => clearTimeout(timeout);
  }, [step, isPlaying]);

  // Live countdown timer in Step 3
  useEffect(() => {
    if (step === 3) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 179));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const formattedTime = `02:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Floating satellite for Google Drive PDF sheet
  const renderSatellite = () => {
    if (step === 1 || step === 2) {
      return {
        position: { top: "36px", right: "-28px" },
        content: (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #16a34a",
              borderRadius: "12px",
              padding: "16px 18px",
              width: "300px",
              boxShadow: "0 18px 36px rgba(22, 163, 74, 0.2), 0 0 0 1px rgba(22, 163, 74, 0.12)",
              animation: "stageshow-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "15px" }}></span>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#166534" }}>Google Drive Roster PDF</span>
              </div>
              <span style={{ fontSize: "10px", background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>ATTACHED</span>
            </div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
              candidate_credentials_roster.pdf
            </div>
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px", lineHeight: "1.4" }}>
              • Share Mode: <strong>View-Only</strong> (Direct Drive link)<br />
              • Contains private student UIDs & Access PINs
            </div>
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#2563eb", fontWeight: "700" }}>
              <span>Ready for Candidate Login →</span>
            </div>
          </div>
        )
      };
    }
    return null;
  };

  return (
    <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto", position: "relative" }}>
      {/* Beat Navigator & Timeline Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
          padding: "0 4px"
        }}
      >
        {/* Step Scrubber Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: 0, label: "1. Google Classroom Sync" },
            { id: 1, label: "2. PDF Credentials Roster" },
            { id: 2, label: "3. Candidate Login" },
            { id: 3, label: "4. Specialized CBT Engine" },
            { id: 4, label: "5. Verified Scorecard" }
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              className="stageshow-step-pill"
              onClick={() => {
                setStep(s.id);
                setIsPlaying(false);
              }}
              style={{
                fontSize: "11px",
                fontWeight: step === s.id ? "700" : "500",
                padding: "4px 10px",
                borderRadius: "20px",
                background: step === s.id ? "#0f172a" : "#f1f5f9",
                color: step === s.id ? "#ffffff" : "#475569",
                border: "none",
                cursor: "pointer",
                transition: "all 0.18s ease"
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Autoplay Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              fontSize: "11px",
              fontWeight: "600",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>{isPlaying ? "Pause Demo" : "Resume Autoplay"}</span>
          </button>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Live Architecture Simulation</span>
        </div>
      </div>

      {/* The Master Stage Window */}
      <StageWindow
        title="Lunaris Assessment Platform"
        url={step >= 3 ? "lunaris.app/exam/midterm-assessment?uid=LUN-981240" : "lunaris.app/dashboard/exams"}
        type={step >= 3 ? "app" : "browser"}
        satellite={renderSatellite()}
      >
        <div className="stageshow-hero-screen-body" style={{ height: "480px", background: step >= 3 ? "#0a0f1d" : "#f8fafc", position: "relative", overflow: "hidden", display: "flex" }}>
          {/* Animated Stageshow Pointer Cursor */}
          <StageshowCursor
            x={cursorPos.x}
            y={cursorPos.y}
            isClicking={isClicking}
            label={step >= 3 ? "Rugved (Candidate)" : "Faculty Admin"}
            visible={true}
          />

          {/* ========================================================= */}
          {/* SCREEN 1 & 2: GOOGLE CLASSROOM SYNC & PDF ROSTER MODAL     */}
          {/* ========================================================= */}
          {(step === 0 || step === 1) && (
            <div style={{ width: "100%", height: "100%", background: "#f8fafc", padding: "20px 24px", display: "flex", flexDirection: "column" }}>
              {/* Modal Card (Matches actual user screenshot layout!) */}
              <div
                className="stageshow-modal-card"
                style={{
                  maxWidth: "680px",
                  width: "100%",
                  margin: "0 auto",
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a" }}>
                      GOOGLE CLASSROOM INTEGRATION
                    </span>
                    <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                      Enroll Candidates from Classroom Course
                    </h3>
                  </div>
                  <div style={{ fontSize: "12px", padding: "4px 10px", background: "#f0fdf4", color: "#15803d", borderRadius: "6px", fontWeight: "700" }}>
                    Course: Lunaris Education (CS 2026)
                  </div>
                </div>

                {/* Toast Notification (when Step 1 active) */}
                {step === 1 && (
                  <div
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      animation: "stageshow-slide-in 0.3s ease"
                    }}
                  >
                    <span> Successfully enrolled 4 student(s) into 'Mock'! PDF credentials sheet generated.</span>
                    <span style={{ background: "#22c55e", color: "#0f172a", fontSize: "10px", fontWeight: "800", padding: "2px 6px", borderRadius: "4px" }}>
                      OK
                    </span>
                  </div>
                )}

                {/* Section 1: Upload Assessment to Stream */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
                    1. Upload Assessment to Classroom Stream
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 8px 0" }}>
                    Creates an official CourseWork assignment in Google Classroom with the candidate exam link & test instructions.
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: step === 0 ? "#16a34a" : "#dcfce7", color: step === 0 ? "#ffffff" : "#166534", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                    <span>{step === 0 ? " Uploading to Classroom..." : " Assignment Created & Synced"}</span>
                  </div>
                </div>

                {/* Section 2: Fetch & Stuff Student Roster */}
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
                        2. Fetch & Stuff Student Roster
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        Fetch student names and stuff them into the exam candidates roster.
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        background: step === 1 ? "#16a34a" : "#2563eb",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        border: "none"
                      }}
                    >
                      {step === 1 ? " 4 Students Enrolled" : "Enroll 4 Students into Exam"}
                    </button>
                  </div>

                  {/* Student Roster Table (Direct from user's screenshot!) */}
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "4px 8px" }}>Student Name</th>
                        <th style={{ padding: "4px 8px" }}>Assigned UID</th>
                        <th style={{ padding: "4px 8px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Vedanti Adhe", uid: "LUN-981238", status: step === 1 ? "Enrolled" : "Ready to Enroll" },
                        { name: "Sparsh Khandagale", uid: "LUN-981239", status: step === 1 ? "Enrolled" : "Ready to Enroll" },
                        { name: "Abha Dhandre", uid: "LUN-981241", status: step === 1 ? "Enrolled" : "Ready to Enroll" },
                        { name: "Rugved Kadu", uid: "LUN-981240", status: step === 1 ? "Enrolled" : "Ready to Enroll" }
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "6px 8px", fontWeight: "600", color: "#1e293b" }}>{row.name}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "#2563eb" }}>{row.uid}</td>
                          <td style={{ padding: "6px 8px", color: step === 1 ? "#16a34a" : "#059669", fontWeight: "700" }}>
                            {row.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 3: REAL CANDIDATE ENTRY PORTAL (/candidate/login)  */}
          {/* ========================================================= */}
          {step === 2 && (
            <div style={{ width: "100%", height: "100%", background: "#f8fafc", display: "grid", placeItems: "center", padding: "16px" }}>
              <div
                style={{
                  maxWidth: "420px",
                  width: "100%",
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
                  padding: "26px 28px"
                }}
              >
                {/* Logo & Portal Header */}
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <img
                    src="/logo.png"
                    alt="Lunaris"
                    style={{ width: "48px", height: "48px", objectFit: "contain", borderRadius: "50%", margin: "0 auto 8px" }}
                  />
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                    Candidate Exam Portal
                  </h3>
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    Enter assigned Exam UID. No permanent account required.
                  </p>
                </div>

                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "8px 10px", fontSize: "11px", color: "#1e40af", marginBottom: "14px" }}>
                  <strong>Login Credentials:</strong> Using UID & PIN from your Google Classroom PDF sheet.
                </div>

                {/* Form Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#334155", marginBottom: "3px" }}>
                      Exam Room Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="CS-MIDTERM-2026"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "var(--font-mono)", background: "#f8fafc" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#334155", marginBottom: "3px" }}>
                      Candidate Login UID
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="LUN-981240"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1.5px solid #2563eb", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#1d4ed8", fontWeight: "700", background: "#eff6ff" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#334155", marginBottom: "3px" }}>
                      Access PIN / Password
                    </label>
                    <input
                      type="password"
                      readOnly
                      value="4821"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "var(--font-mono)", background: "#f8fafc" }}
                    />
                  </div>

                  <button
                    type="button"
                    style={{
                      height: "38px",
                      background: "#2563eb",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "none",
                      marginTop: "4px"
                    }}
                  >
                    Validate & Launch CBT Assessment →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 4: SPECIALIZED INSTITUTIONAL CBT RUNNER (Dark Theme)      */}
          {/* ========================================================= */}
          {step === 3 && (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a0f1d" }}>
              {/* Top Banner (Standard Assessment Header) */}
              <header className="stageshow-cbt-header" style={{
                height: "50px",
                background: "#0f172a",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                userSelect: "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img
                    src="/logo.png"
                    alt="Lunaris"
                    style={{ width: "24px", height: "24px", objectFit: "contain", borderRadius: "50%", background: "#ffffff" }}
                  />
                  <div style={{
                    background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                    color: "#fff",
                    fontWeight: "800",
                    fontSize: "13px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    letterSpacing: "0.5px"
                  }}>
                    LUNARIS CBT
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>
                    Midterm Assessment 2026 (Comprehensive Evaluation)
                  </span>
                </div>

                {/* Server Authoritative Timer Bar */}
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
                    <span style={{
                      fontSize: "15px",
                      fontWeight: "bold",
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
                      color: "#38bdf8"
                    }}>
                      {formattedTime}
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
              </header>

              {/* Subject Navigation Tabs */}
              <div style={{
                height: "36px",
                background: "#0b1329",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                alignItems: "center",
                padding: "0 18px",
                gap: "4px"
              }}>
                {["PHYSICS", "CHEMISTRY", "MATHEMATICS"].map((subj, i) => (
                  <div
                    key={subj}
                    style={{
                      padding: "6px 16px",
                      fontSize: "12px",
                      fontWeight: "700",
                      borderRadius: "4px 4px 0 0",
                      background: i === 0 ? "#1e293b" : "transparent",
                      color: i === 0 ? "#38bdf8" : "#94a3b8",
                      borderBottom: i === 0 ? "2px solid #38bdf8" : "none"
                    }}
                  >
                    {subj}
                  </div>
                ))}
              </div>

              {/* Main Body Split: Question View & Palette + Proctor Bubble */}
              <div className="stageshow-cbt-split" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Left: Question Viewer */}
                <div className="stageshow-cbt-left" style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #1e293b",
                    marginBottom: "14px"
                  }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "#f8fafc" }}>
                      Question 1 (Physics - Section A (MCQ))
                    </span>
                    <span style={{ fontSize: "11px", background: "#1e293b", color: "#38bdf8", padding: "2px 8px", borderRadius: "4px" }}>
                      Marking Scheme: +4 / -1
                    </span>
                  </div>

                  <div style={{ fontSize: "14px", color: "#e2e8f0", lineHeight: "1.6", marginBottom: "16px" }}>
                    A solid cylinder of mass M and radius R rolls down an inclined plane of height h without slipping.
                    The angular velocity ω when it reaches the bottom of the incline is:
                  </div>

                  {/* 4 Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                    {[
                      { id: "A", text: "ω = √( 4gh / 3R² )" },
                      { id: "B", text: "ω = √( 2gh / R² )" },
                      { id: "C", text: "ω = √( 10gh / 7R² )" },
                      { id: "D", text: "ω = √( gh / R² )" }
                    ].map((opt) => {
                      const isSelected = cbtSelectedOption === opt.id;
                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            background: isSelected ? "rgba(59, 130, 246, 0.16)" : "#0f172a",
                            border: `1px solid ${isSelected ? "#3b82f6" : "#1e293b"}`,
                            borderRadius: "6px",
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

                  {/* Standard CBT Action Controls Footer */}
                  <div className="stageshow-cbt-footer" style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "14px",
                    borderTop: "1px solid #1e293b",
                    marginTop: "12px"
                  }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" style={{ padding: "6px 12px", background: "#7e22ce", color: "#fff", fontSize: "11px", fontWeight: "600", borderRadius: "4px" }}>
                        Save & Mark for Review
                      </button>
                      <button type="button" style={{ padding: "6px 12px", background: "#334155", color: "#f8fafc", fontSize: "11px", fontWeight: "600", borderRadius: "4px" }}>
                        Clear Response
                      </button>
                      <button type="button" style={{ padding: "6px 12px", background: "#9333ea", color: "#fff", fontSize: "11px", fontWeight: "600", borderRadius: "4px" }}>
                        Mark for Review & Next
                      </button>
                    </div>

                    <button type="button" style={{ padding: "6px 18px", background: "#2563eb", color: "#fff", fontSize: "12px", fontWeight: "bold", borderRadius: "4px" }}>
                      Save & Next
                    </button>
                  </div>
                </div>

                {/* Right Side: Proctor Bubble + Item Status Palette */}
                <div className="stageshow-cbt-right" style={{ width: "260px", display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid #1e293b" }}>
                  {/* Proctoring Bubble (Exact video mockup) */}
                  <div style={{
                    height: "110px",
                    background: "#020617",
                    borderBottom: "1px solid #1e293b",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {/* Simulated candidate camera icon & mesh */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "28px" }}></div>
                      <div style={{ fontSize: "10px", color: "#94a3b8" }}>Rugved Kadu (LUN-981240)</div>
                    </div>
                    <div style={{
                      position: "absolute",
                      top: "6px",
                      left: "6px",
                      background: "rgba(15, 23, 42, 0.85)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "9px",
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
                  <div style={{ flex: 1, padding: "12px", background: "#0b1329", overflowY: "auto" }}>
                    <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", marginBottom: "8px" }}>
                      QUESTION PALETTE (PHYSICS)
                    </div>

                    {/* Status Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "9px", color: "#cbd5e1", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", background: "#16a34a", borderRadius: "2px" }} />
                        <span>{q1Answered ? "1 Answered" : "0 Answered"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", background: "#dc2626", borderRadius: "2px" }} />
                        <span>{q1Answered ? "0 Not Ans" : "1 Not Ans"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", background: "#9333ea", borderRadius: "2px" }} />
                        <span>0 Marked</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", background: "#475569", borderRadius: "2px" }} />
                        <span>24 Not Visit</span>
                      </div>
                    </div>

                    {/* Number Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
                      {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
                        let bg = "#334155";
                        let c = "#f8fafc";
                        if (n === 1) {
                          bg = q1Answered ? "#16a34a" : "#dc2626";
                        }
                        return (
                          <div
                            key={n}
                            style={{
                              height: "24px",
                              borderRadius: "4px",
                              background: bg,
                              color: c,
                              display: "grid",
                              placeItems: "center",
                              fontSize: "10px",
                              fontWeight: "700"
                            }}
                          >
                            {n}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 5: SUBMISSION & AI VERIFIED SCORECARD              */}
          {/* ========================================================= */}
          {step === 4 && (
            <div style={{ width: "100%", height: "100%", background: "#0a0f1d", display: "grid", placeItems: "center", padding: "20px" }}>
              <div
                style={{
                  maxWidth: "480px",
                  width: "100%",
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "14px",
                  padding: "26px",
                  textAlign: "center",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "8px" }}></div>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc" }}>
                  Examination Successfully Submitted
                </h3>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", marginBottom: "20px" }}>
                  Midterm Assessment 2026 • Candidate: Rugved Kadu (LUN-981240)
                </p>

                {/* Score breakdown metrics (UI Skills: Tabular Nums) */}
                <div className="stageshow-scorecard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ background: "#1e293b", padding: "12px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>FINAL SCORE</div>
                    <div style={{ fontSize: "22px", fontWeight: "900", color: "#38bdf8", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      96<span style={{ fontSize: "13px", color: "#94a3b8" }}>/100</span>
                    </div>
                  </div>
                  <div style={{ background: "#1e293b", padding: "12px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>ACCURACY</div>
                    <div style={{ fontSize: "22px", fontWeight: "900", color: "#22c55e", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      96%
                    </div>
                  </div>
                  <div style={{ background: "#1e293b", padding: "12px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>PERCENTILE</div>
                    <div style={{ fontSize: "22px", fontWeight: "900", color: "#facc15", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      99.4
                    </div>
                  </div>
                </div>

                {/* Integrity Verification Seal */}
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#4ade80",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: "600"
                }}>
                  <span>AI Proctoring Audit: Passed</span>
                  <span>•</span>
                  <span>Zero Anomalies Recorded</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </StageWindow>

      <style>{`
        @keyframes stageshow-slide-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
