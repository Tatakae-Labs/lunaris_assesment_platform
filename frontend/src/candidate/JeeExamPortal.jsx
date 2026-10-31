import React, { useState, useEffect, useRef } from "react";
import { api } from "../shared/api";
import QuestionPalette from "./QuestionPalette";
import NumericalKeypad from "./NumericalKeypad";
import PreflightModal from "./PreflightModal";

export default function JeeExamPortal({ inviteToken, onExit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preflightDone, setPreflightDone] = useState(false);

  // Attempt Data
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSubject, setActiveSubject] = useState("Physics");

  // Answers & Palette State
  // { [qId]: { selected_options: [], numerical_value: "", state: "answered" } }
  const [userAnswers, setUserAnswers] = useState({});
  const [questionStates, setQuestionStates] = useState({});
  const [revisions, setRevisions] = useState({});

  // Server Timer
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Proctoring Sensors
  const [advisoryAlerts, setAdvisoryAlerts] = useState([]);
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize Exam Session
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        // Start or Resume Attempt
        const attRes = await api.startAttempt(inviteToken);
        setAttempt(attRes);
        setSecondsRemaining(attRes.remaining_seconds);

        // Fetch Sanitized Paper
        const paperRes = await api.getPaper(attRes.attempt_id);
        setQuestions(paperRes.questions);

        // Restore any previously saved answers (reconnect tolerance)
        const initialStates = {};
        const initialAnswers = {};
        paperRes.questions.forEach((q) => {
          if (paperRes.saved_answers && paperRes.saved_answers[q.id]) {
            const saved = paperRes.saved_answers[q.id];
            initialAnswers[q.id] = saved;
            initialStates[q.id] = saved.state || "answered";
          } else {
            initialStates[q.id] = "unvisited";
          }
        });

        setUserAnswers(initialAnswers);
        setQuestionStates(initialStates);

        // Default to subject of first question
        if (paperRes.questions.length > 0) {
          setActiveSubject(paperRes.questions[0].subject);
          if (initialStates[paperRes.questions[0].id] === "unvisited") {
            setQuestionStates((prev) => ({ ...prev, [paperRes.questions[0].id]: "not_answered" }));
          }
        }
      } catch (err) {
        setError(err.message || "Failed to initialize examination session");
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [inviteToken]);

  // Synchronized Server Timer
  useEffect(() => {
    if (!preflightDone || secondsRemaining === null || submitResult) return;

    if (secondsRemaining <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [preflightDone, secondsRemaining, submitResult]);

  // Browser Security Listeners (Visibility API & Fullscreen)
  const isStandardQuiz = attempt?.mode === "standard_quiz";

  useEffect(() => {
    if (!preflightDone || submitResult || !attempt || isStandardQuiz) return;

    function handleVisibility() {
      if (document.hidden) {
        triggerAdvisoryAlert("Tab switch or minimize detected. Please stay focused on the CBT interface.", "warning");
        api.sendProctorEvent(attempt.attempt_id, "tab_switch", "suspicious", { hidden: true });
      }
    }

    function handleFullscreen() {
      if (!document.fullscreenElement) {
        triggerAdvisoryAlert("Fullscreen exited. Please re-enter fullscreen mode to prevent integrity flags.", "warning");
        api.sendProctorEvent(attempt.attempt_id, "fullscreen_exit", "suspicious", { fullscreen: false });
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreen);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, [preflightDone, submitResult, attempt]);

  // Webcam Setup during examination
  useEffect(() => {
    if (!preflightDone || submitResult || isStandardQuiz) return;

    async function startCam() {
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { min: 1280, ideal: 1280 },
              height: { min: 720, ideal: 720 },
              frameRate: { ideal: 30, min: 24 },
              facingMode: "user"
            }
          });
        } catch (e1) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
              }
            });
          } catch (e2) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.warn("Could not attach proctor camera stream:", e);
      }
    }
    startCam();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [preflightDone, submitResult]);

  function triggerAdvisoryAlert(msg, type = "info") {
    const id = Date.now();
    setAdvisoryAlerts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setAdvisoryAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 6000);
  }

  // Answer Saving & Navigation Handlers
  async function persistAnswer(qId, answerData) {
    if (!attempt) return;
    const nextRev = (revisions[qId] || 0) + 1;
    setRevisions((prev) => ({ ...prev, [qId]: nextRev }));

    try {
      await api.saveAnswer(attempt.attempt_id, qId, answerData, nextRev);
    } catch (e) {
      console.error("Autosave sync error:", e);
    }
  }

  const currentQ = questions[currentIndex];

  function handleSelectOption(optId) {
    if (!currentQ) return;
    const prev = userAnswers[currentQ.id] || {};
    let nextOpts = [];

    if (currentQ.type === "multi_mcq") {
      const existing = prev.selected_options || [];
      nextOpts = existing.includes(optId) ? existing.filter((x) => x !== optId) : [...existing, optId];
    } else {
      nextOpts = [optId];
    }

    const updated = { ...prev, selected_options: nextOpts };
    setUserAnswers((prevMap) => ({ ...prevMap, [currentQ.id]: updated }));
  }

  function handleNumericalChange(val) {
    if (!currentQ) return;
    const prev = userAnswers[currentQ.id] || {};
    const updated = { ...prev, numerical_value: val };
    setUserAnswers((prevMap) => ({ ...prevMap, [currentQ.id]: updated }));
  }

  function handleSaveAndNext() {
    if (!currentQ) return;
    const ans = userAnswers[currentQ.id] || {};
    const isAnswered = (ans.selected_options && ans.selected_options.length > 0) || (ans.numerical_value && ans.numerical_value.trim() !== "");

    const newState = isAnswered ? "answered" : "not_answered";
    const payload = { ...ans, state: newState };

    setQuestionStates((prev) => ({ ...prev, [currentQ.id]: newState }));
    persistAnswer(currentQ.id, payload);
    goToNextQuestion();
  }

  function handleSaveAndMarkForReview() {
    if (!currentQ) return;
    const ans = userAnswers[currentQ.id] || {};
    const isAnswered = (ans.selected_options && ans.selected_options.length > 0) || (ans.numerical_value && ans.numerical_value.trim() !== "");

    const newState = isAnswered ? "answered_marked" : "marked";
    const payload = { ...ans, state: newState };

    setQuestionStates((prev) => ({ ...prev, [currentQ.id]: newState }));
    persistAnswer(currentQ.id, payload);
    goToNextQuestion();
  }

  function handleMarkForReviewAndNext() {
    if (!currentQ) return;
    const ans = userAnswers[currentQ.id] || {};
    const newState = "marked";
    const payload = { ...ans, state: newState };

    setQuestionStates((prev) => ({ ...prev, [currentQ.id]: newState }));
    persistAnswer(currentQ.id, payload);
    goToNextQuestion();
  }

  function handleClearResponse() {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { selected_options: [], numerical_value: "", state: "not_answered" }
    }));
    setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "not_answered" }));
    persistAnswer(currentQ.id, { selected_options: [], numerical_value: "", state: "not_answered" });
  }

  function goToNextQuestion() {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      selectQuestionIndex(nextIdx);
    }
  }

  function selectQuestionIndex(idx) {
    setCurrentIndex(idx);
    const targetQ = questions[idx];
    if (targetQ) {
      setActiveSubject(targetQ.subject);
      setQuestionStates((prev) => {
        if (!prev[targetQ.id] || prev[targetQ.id] === "unvisited") {
          return { ...prev, [targetQ.id]: "not_answered" };
        }
        return prev;
      });
    }
  }

  async function handleFinalSubmit() {
    if (!attempt || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      const result = await api.submitAttempt(attempt.attempt_id);
      setSubmitResult(result);
    } catch (err) {
      alert("Error submitting exam: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatTime(totalSec) {
    if (totalSec === null || totalSec === undefined) return "--:--";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Preflight Screen
  if (!preflightDone) {
    return (
      <PreflightModal
        examTitle={attempt?.title}
        durationMinutes={attempt?.duration_minutes}
        mode={attempt?.mode}
        onProceed={() => setPreflightDone(true)}
      />
    );
  }

  // Scorecard / Results Presentation
  if (submitResult) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0f1d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}>
        <div style={{
          maxWidth: "720px",
          width: "100%",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span style={{
              background: "#16a34a",
              color: "#fff",
              padding: "4px 16px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase"
            }}>
              Examination Successfully Finalized
            </span>
            <h1 style={{ fontSize: "28px", color: "#f8fafc", marginTop: "14px", fontFamily: "var(--font-display)" }}>
              JEE Main Scorecard & Analysis
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>
              Immutable Server-Side Deterministic Grading
            </p>
          </div>

          {/* Primary Score Tile */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            marginBottom: "28px"
          }}>
            <div style={{ background: "#1e293b", padding: "18px", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>Total Score</div>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                {submitResult.score_total} <span style={{ fontSize: "14px", color: "#64748b" }}>/ {submitResult.max_possible_score}</span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "18px", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>Accuracy</div>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#22c55e", fontFamily: "var(--font-mono)" }}>
                {submitResult.accuracy_percentage}%
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "18px", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>Attempts Breakdown</div>
              <div style={{ fontSize: "14px", marginTop: "8px", display: "flex", justifyContent: "space-around" }}>
                <span style={{ color: "#22c55e" }}>✓ {submitResult.correct_count}</span>
                <span style={{ color: "#ef4444" }}>✗ {submitResult.incorrect_count}</span>
                <span style={{ color: "#94a3b8" }}>○ {submitResult.unanswered_count}</span>
              </div>
            </div>
          </div>

          {/* Subject Wise Performance Table */}
          <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#e2e8f0" }}>Subject Performance Breakdown</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "28px" }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#94a3b8", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", borderRadius: "6px 0 0 6px" }}>Subject</th>
                <th style={{ padding: "10px 14px" }}>Marks Obtained</th>
                <th style={{ padding: "10px 14px" }}>Max Marks</th>
                <th style={{ padding: "10px 14px" }}>Correct</th>
                <th style={{ padding: "10px 14px" }}>Incorrect</th>
                <th style={{ padding: "10px 14px", borderRadius: "0 6px 6px 0" }}>Unanswered</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(submitResult.subject_breakdown || {}).map(([subj, data]) => (
                <tr key={subj} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 14px", fontWeight: "600", color: "#38bdf8" }}>{subj}</td>
                  <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>{data.score}</td>
                  <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{data.max_score}</td>
                  <td style={{ padding: "12px 14px", color: "#22c55e" }}>{data.correct}</td>
                  <td style={{ padding: "12px 14px", color: "#ef4444" }}>{data.incorrect}</td>
                  <td style={{ padding: "12px 14px", color: "#64748b" }}>{data.unanswered}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={onExit}
            style={{
              width: "100%",
              padding: "14px",
              background: "#2563eb",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "15px",
              borderRadius: "8px"
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const paperSubjectList = Array.from(new Set(paper?.questions?.map((q) => q.subject).filter(Boolean)));
  const subjects = paperSubjectList.length > 0 ? paperSubjectList : ["General"];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#0a0f1d",
      overflow: "hidden"
    }}>
      {/* Top Banner (JEE CBT Standard Header) */}
      <header style={{
        height: "60px",
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        userSelect: "none"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/logo.png"
            alt="Lunaris"
            style={{ width: "28px", height: "28px", objectFit: "contain", borderRadius: "50%", background: "#ffffff" }}
          />
          <div style={{
            background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
            color: "#fff",
            fontWeight: "800",
            fontSize: "15px",
            padding: "4px 10px",
            borderRadius: "6px",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.5px"
          }}>
            LUNARIS CBT
          </div>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#e2e8f0" }}>
            {attempt?.title || "JEE Main Mock Examination"}
          </span>
        </div>

        {/* Server Authoritative Timer Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#1e293b",
            padding: "6px 16px",
            borderRadius: "8px",
            border: "1px solid #334155"
          }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>Time Remaining:</span>
            <span style={{
              fontSize: "18px",
              fontWeight: "bold",
              fontFamily: "var(--font-mono)",
              color: secondsRemaining && secondsRemaining < 300 ? "#ef4444" : "#38bdf8"
            }}>
              {formatTime(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            style={{
              padding: "8px 18px",
              background: "#16a34a",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "13px",
              borderRadius: "6px"
            }}
          >
            Submit Paper
          </button>
        </div>
      </header>

      {/* Advisory Alert Toasts */}
      <div style={{ position: "fixed", top: "70px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "8px" }}>
        {advisoryAlerts.map((a) => (
          <div
            key={a.id}
            style={{
              background: a.type === "warning" ? "#7f1d1d" : "#1e293b",
              color: "#f8fafc",
              border: `1px solid ${a.type === "warning" ? "#dc2626" : "#475569"}`,
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.4)"
            }}
          >
            {a.msg}
          </div>
        ))}
      </div>

      {/* Subject Navigation Tabs */}
      <div style={{
        height: "44px",
        background: "#0b1329",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: "6px"
      }}>
        {subjects.map((subj) => (
          <button
            key={subj}
            type="button"
            onClick={() => {
              setActiveSubject(subj);
              const firstInSubj = questions.findIndex((q) => q.subject === subj);
              if (firstInSubj !== -1) selectQuestionIndex(firstInSubj);
            }}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: "600",
              borderRadius: "6px 6px 0 0",
              background: activeSubject === subj ? "#1e293b" : "transparent",
              color: activeSubject === subj ? "#38bdf8" : "#94a3b8",
              borderBottom: activeSubject === subj ? "2px solid #38bdf8" : "none"
            }}
          >
            {subj}
          </button>
        ))}
      </div>

      {/* Main Body: Question Viewer (Left) & Question Palette + Proctor Bubble (Right) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Question Viewer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0f1d", overflowY: "auto" }}>
          {currentQ ? (
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Question Header & Marking Weights */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "14px",
                borderBottom: "1px solid #1e293b",
                marginBottom: "20px"
              }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#f8fafc" }}>
                  Question {currentIndex + 1} ({currentQ.subject} - {currentQ.type === "numerical" ? "Section B (NVQ)" : "Section A (MCQ)"})
                </span>
                <span style={{ fontSize: "12px", background: "#1e293b", color: "#38bdf8", padding: "4px 10px", borderRadius: "4px" }}>
                  Marking Scheme: +{currentQ.points_positive} / {currentQ.points_negative}
                </span>
              </div>

              {/* Question Stem Text */}
              <div style={{
                fontSize: "16px",
                color: "#e2e8f0",
                lineHeight: "1.7",
                marginBottom: "28px"
              }}>
                {currentQ.content.text}
              </div>

              {/* Options (MCQ / Numerical) */}
              <div style={{ flex: 1 }}>
                {currentQ.type === "numerical" ? (
                  <div>
                    <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>
                      Use the on-screen keypad to enter your numerical answer (decimal or integer):
                    </p>
                    <NumericalKeypad
                      value={userAnswers[currentQ.id]?.numerical_value || ""}
                      onChange={handleNumericalChange}
                      onClear={() => handleNumericalChange("")}
                      onBackspace={() => {
                        const cur = userAnswers[currentQ.id]?.numerical_value || "";
                        handleNumericalChange(cur.slice(0, -1));
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {currentQ.content.options.map((opt, optIdx) => {
                      const selected = (userAnswers[currentQ.id]?.selected_options || []).includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(opt.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            padding: "14px 18px",
                            background: selected ? "rgba(59, 130, 246, 0.12)" : "#0f172a",
                            border: `1px solid ${selected ? "#3b82f6" : "#1e293b"}`,
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          <div style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: currentQ.type === "multi_mcq" ? "4px" : "50%",
                            border: `2px solid ${selected ? "#3b82f6" : "#475569"}`,
                            display: "grid",
                            placeItems: "center",
                            background: selected ? "#3b82f6" : "transparent"
                          }}>
                            {selected && (
                              <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>
                                {currentQ.type === "multi_mcq" ? "✓" : ""}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "15px", color: selected ? "#ffffff" : "#cbd5e1" }}>
                            <strong>({String.fromCharCode(65 + optIdx)})</strong> {opt.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* JEE CBT Action Controls Footer */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "20px",
                borderTop: "1px solid #1e293b",
                marginTop: "20px"
              }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleSaveAndMarkForReview}
                    style={{
                      padding: "10px 18px",
                      background: "#7e22ce",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: "600",
                      borderRadius: "6px"
                    }}
                  >
                    Save & Mark for Review
                  </button>
                  <button
                    type="button"
                    onClick={handleClearResponse}
                    style={{
                      padding: "10px 18px",
                      background: "#334155",
                      color: "#f8fafc",
                      fontSize: "13px",
                      fontWeight: "600",
                      borderRadius: "6px"
                    }}
                  >
                    Clear Response
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkForReviewAndNext}
                    style={{
                      padding: "10px 18px",
                      background: "#9333ea",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: "600",
                      borderRadius: "6px"
                    }}
                  >
                    Mark for Review & Next
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  style={{
                    padding: "10px 24px",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "bold",
                    borderRadius: "6px"
                  }}
                >
                  Save & Next
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", placeItems: "center", flex: 1, color: "#64748b" }}>
              Loading question...
            </div>
          )}
        </div>

        {/* Right Side: Palette + Live Camera Proctor Bubble */}
        <div style={{ width: "320px", display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Proctoring Bubble */}
          <div style={{
            height: "140px",
            background: "#020617",
            borderLeft: "1px solid #1e293b",
            borderBottom: "1px solid #1e293b",
            position: "relative",
            overflow: "hidden"
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(4px)",
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
              Live AI Proctoring
            </div>
          </div>

          {/* Palette */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <QuestionPalette
              questions={questions}
              currentIndex={currentIndex}
              onSelectIndex={selectQuestionIndex}
              questionStates={questionStates}
              activeSubject={activeSubject}
            />
          </div>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      {showSubmitModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 15, 29, 0.8)",
          backdropFilter: "blur(6px)",
          display: "grid",
          placeItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "460px",
            width: "100%",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "24px"
          }}>
            <h3 style={{ fontSize: "18px", color: "#f8fafc", marginBottom: "8px" }}>
              Confirm Exam Submission
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
              Are you sure you want to finalize your test? Once submitted, your answers will be graded server-side and cannot be modified.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: "8px 16px",
                  background: "#334155",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: "600",
                  borderRadius: "6px"
                }}
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                style={{
                  padding: "8px 18px",
                  background: "#16a34a",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "bold",
                  borderRadius: "6px"
                }}
              >
                Yes, Submit Final
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
