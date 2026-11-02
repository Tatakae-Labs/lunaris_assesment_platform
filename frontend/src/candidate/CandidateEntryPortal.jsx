import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import { offlineStorage } from "../shared/offlineStorage";
import MediaPipeProctor from "../proctoring/MediaPipeProctor";
import NumericalKeypad from "./NumericalKeypad";
import QuestionPalette from "./QuestionPalette";

export default function CandidateEntryPortal({
  initialExamSlug = "",
  initialUid = "",
  initialPin = "",
  onExit
}) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeSlug = slug || searchParams.get("slug") || searchParams.get("room") || searchParams.get("room_code") || searchParams.get("exam_id") || initialExamSlug;
  const activeInitialUid = searchParams.get("uid") || searchParams.get("id") || initialUid;
  const activeInitialPin = searchParams.get("pin") || searchParams.get("password") || initialPin;

  // Step in candidate flow: 'uid_entry' -> 'preflight' -> 'attempt' -> 'completed'
  const [step, setStep] = useState("uid_entry");

  // Auth & Session
  const [examSlug, setExamSlug] = useState(activeSlug);
  const [candidateUid, setCandidateUid] = useState(activeInitialUid);
  const [accessPin, setAccessPin] = useState(activeInitialPin);

  useEffect(() => {
    if (slug) setExamSlug(slug);
    const r = searchParams.get("room") || searchParams.get("room_code") || searchParams.get("slug") || searchParams.get("exam_id");
    if (r) setExamSlug(r);
    const u = searchParams.get("uid") || searchParams.get("id");
    if (u) setCandidateUid(u);
    const p = searchParams.get("pin") || searchParams.get("password");
    if (p) setAccessPin(p);
  }, [slug, searchParams]);
  const [sessionToken, setSessionToken] = useState(null);
  const [candidateName, setCandidateName] = useState("");
  const [examDetails, setExamDetails] = useState(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  // Preflight
  const [consentChecked, setConsentChecked] = useState(false);
  const [cameraVerified, setCameraVerified] = useState(false);

  // Exam Mode Evaluation
  const isStandardQuiz = examDetails?.mode === "standard_quiz";
  const isProctoringRequired = !isStandardQuiz && (examDetails?.proctoring_enabled !== false);

  // Attempt Data
  const [attemptId, setAttemptId] = useState(null);
  const [paper, setPaper] = useState(null);
  const [activeSubject, setActiveSubject] = useState("Physics");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [candidateAnswers, setCandidateAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(10800);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // 'idle', 'saving', 'saved', 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Offline Persistence & UI Customization State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [fontSize, setFontSize] = useState(16); // 14px, 16px, 18px, 20px
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Proctor Anomaly & Screen Violation State
  const [activeViolationAlert, setActiveViolationAlert] = useState(null);
  const [violationCount, setViolationCount] = useState(0);

  // Interactive Coding Sandbox State
  const [codingLang, setCodingLang] = useState("python");
  const [codingConsoleTab, setCodingConsoleTab] = useState("sample"); // 'sample', 'custom', 'evaluation'

  // Google Classroom Auto Turn-In State
  const [classroomTurnInStatus, setClassroomTurnInStatus] = useState("idle"); // 'idle', 'turning_in', 'turned_in'
  const [classroomTurnInLoading, setClassroomTurnInLoading] = useState(false);
  const [codingCustomInput, setCodingCustomInput] = useState("");
  const [codingExecution, setCodingExecution] = useState({ running: false, result: null });

  function handleProctorViolation(event) {
    setViolationCount((c) => c + 1);
    let title = "Integrity Warning";
    let message = "A proctoring anomaly was detected and recorded.";

    if (event.eventType === "tab_switch") {
      title = "Screen Violation: Tab Switch / Lost Focus";
      message = "You switched away from the active examination window. This action is logged for faculty review.";
    } else if (event.eventType === "fullscreen_exit") {
      title = "Screen Violation: Fullscreen Exited";
      message = "Fullscreen exam mode was exited. Please keep the exam maximized in fullscreen.";
    } else if (event.eventType === "face_not_detected") {
      title = "Camera Warning: Face Out of Frame";
      message = "Your face is not clearly detected in the webcam preview. Please face the screen directly.";
    }

    setActiveViolationAlert({
      title,
      message,
      time: new Date().toLocaleTimeString(),
      severity: event.severity || "warning"
    });

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setActiveViolationAlert((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  }

  // 1. Verify UID and Access PIN
  async function handleVerifyAccess(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setAuthError("");
    try {
      const res = await api.verifyCandidateAccess(examSlug, candidateUid, accessPin);
      setSessionToken(res.session_token);
      setCandidateName(res.candidate_name);
      setExamDetails(res.exam);
      if (res.exam?.mode === "standard_quiz") {
        setCameraVerified(true);
        setConsentChecked(true);
      }
      setStep("preflight");
    } catch (err) {
      setAuthError(err.message || "Invalid Exam UID or Access PIN for this examination session.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Submit Preflight Consent and Start Attempt
  // Fullscreen and Security Lock State
  const [fullscreenViolation, setFullscreenViolation] = useState(false);
  const [copyWarning, setCopyWarning] = useState(false);
  const [proctorToast, setProctorToast] = useState(null);

  // 2. Submit Preflight Consent and Start Attempt
  async function handleStartExam() {
    if (!consentChecked) {
      alert("Please accept the proctoring and privacy terms to begin.");
      return;
    }
    setLoading(true);
    try {
      await api.candidatePreflightConsent(sessionToken, {
        consent_given: true,
        camera_status: cameraVerified ? "granted" : "not_required"
      });

      const attemptRes = await api.startCandidateAttempt(sessionToken);
      setAttemptId(attemptRes.attempt_id);
      setRemainingSeconds(attemptRes.remaining_seconds);

      const paperRes = await api.getCandidatePaper(sessionToken);
      setPaper(paperRes);
      if (paperRes?.questions?.length > 0) {
        const firstSubj = paperRes.questions[0].subject || "General";
        setActiveSubject(firstSubj);
      }

      // Restore saved answers from server and overlay any local cached answers
      const cached = offlineStorage.getLocalAnswers(sessionToken);
      const combined = {
        ...(paperRes.saved_answers || {}),
        ...cached
      };
      setCandidateAnswers(combined);
      setPendingQueueCount(offlineStorage.getPendingQueue(sessionToken).length);

      // Enter Fullscreen Mode (proctored CBT only)
      if (isProctoringRequired) {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn("Fullscreen request warning:", fsErr);
        }
      }

      setStep("attempt");
    } catch (err) {
      alert("Failed to start exam: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Security & Lockdown Monitors (Fullscreen, Copy/Paste, Right Click)
  useEffect(() => {
    if (step !== "attempt" || !isProctoringRequired) return;

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setFullscreenViolation(true);
        if (sessionToken) {
          api.sendCandidateProctorEvent(sessionToken, {
            event_type: "fullscreen_exit",
            severity: "suspicious",
            duration_ms: 3000,
            confidence: 1.0,
            source: "browser_security",
            metadata: { reason: "Candidate exited required fullscreen exam environment" }
          }).catch(() => {});
        }
      } else {
        setFullscreenViolation(false);
      }
    }

    function handleBlockCopy(e) {
      e.preventDefault();
      setCopyWarning(true);
      setTimeout(() => setCopyWarning(false), 4000);
      if (sessionToken) {
        api.sendCandidateProctorEvent(sessionToken, {
          event_type: "clipboard_copy_attempt",
          severity: "suspicious",
          duration_ms: 1000,
          confidence: 1.0,
          source: "browser_security",
          metadata: { reason: "Candidate attempted to copy or cut exam question content", action: e.type }
        }).catch(() => {});
      }
      return false;
    }

    function handleContextMenu(e) {
      e.preventDefault();
      return false;
    }

    function handleKeySecurity(e) {
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "v", "u", "a", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        handleBlockCopy(e);
        return false;
      }
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "c", "j"].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        return false;
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleBlockCopy);
    document.addEventListener("cut", handleBlockCopy);
    document.addEventListener("paste", handleBlockCopy);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeySecurity);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleBlockCopy);
      document.removeEventListener("cut", handleBlockCopy);
      document.removeEventListener("paste", handleBlockCopy);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeySecurity);
    };
  }, [step, sessionToken]);

  function handleReEnterFullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .then(() => setFullscreenViolation(false))
        .catch(() => setFullscreenViolation(false));
    } else {
      setFullscreenViolation(false);
    }
  }

  function handleProctorViolation(event) {
    if (!isProctoringRequired) return;
    if (event.severity === "suspicious" || event.eventType === "multiple_faces_detected" || event.eventType === "prohibited_object") {
      let title = "Integrity Advisory";
      let message = "";
      let icon = "";
      const isCritical = event.eventType === "prohibited_object" || event.eventType === "multiple_faces_detected";

      if (event.eventType === "prohibited_object") {
        title = "Prohibited Device Detected";
        message = "A mobile phone or electronic device was detected in your camera view. Cell phones are strictly prohibited during the examination.";
        icon = "";
      } else if (event.eventType === "multiple_faces_detected") {
        title = "Multiple Individuals Detected";
        message = "More than one person detected in camera view. Please ensure you are alone in your testing environment.";
        icon = "";
      } else if (event.eventType === "excessive_movement") {
        title = "Gaze & Movement Alert";
        message = "Significant head movement or looking away from the screen detected.";
        icon = "";
      } else if (event.eventType === "fullscreen_exit") {
        title = "Fullscreen Integrity Violation";
        message = "Exiting fullscreen mode has been recorded in the proctoring audit log.";
        icon = "";
      } else if (event.eventType === "tab_switch") {
        title = " Window Focus Lost";
        message = "Navigating away from the active exam window has been logged.";
        icon = "";
      } else {
        message = `Proctor advisory: ${event.eventType.replace(/_/g, " ")}`;
      }

      setProctorToast({ title, message, icon, isCritical, eventType: event.eventType });
      setTimeout(() => setProctorToast(null), 6000);
    }
  }

  // 3. Authoritative Timer Tick
  useEffect(() => {
    if (step !== "attempt" || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, remainingSeconds]);

  // 3b. Real-time Proctor Warning Reception
  useEffect(() => {
    if (step !== "attempt" || !sessionToken) return;

    let lastSeenWarningId = null;
    const interval = setInterval(async () => {
      try {
        const res = await api.getCandidateProctorWarnings(sessionToken);
        if (res && res.warnings && res.warnings.length > 0) {
          const latest = res.warnings[0];
          if (latest.id !== lastSeenWarningId) {
            lastSeenWarningId = latest.id;
            setProctorToast({
              title: " Official Proctor Warning",
              message: latest.message,
              icon: "🚨",
              isCritical: true,
              eventType: "proctor_warning"
            });
            setTimeout(() => setProctorToast(null), 9000);
          }
        }
      } catch (err) {
        // Silently ignore polling warnings
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [step, sessionToken]);

  // Format seconds into HH:MM:SS
  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Questions for active subject
  const examSubjects = Array.from(new Set(paper?.questions?.map((q) => q.subject || "General") || []));
  const filteredBySubject = paper?.questions?.filter((q) => (q.subject || "General") === activeSubject) || [];
  const currentQuestions = filteredBySubject.length > 0 ? filteredBySubject : (paper?.questions || []);
  const currentQ = currentQuestions[activeQuestionIndex];
  const currentAns = currentQ ? candidateAnswers[currentQ.id] : null;

  // 4. Save Answer with Autosave
  async function handleSelectOption(optionId) {
    if (!currentQ) return;
    const newAns = {
      selected_options: [optionId],
      state: "answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleNumericalInput(val) {
    if (!currentQ) return;
    const newAns = {
      numerical_value: String(val),
      state: val ? "answered" : "not_answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleOneWordInput(val) {
    if (!currentQ) return;
    const newAns = {
      one_word: val,
      text_answer: val,
      state: val.trim() ? "answered" : "not_answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleTrueFalseSelect(val) {
    if (!currentQ) return;
    const newAns = {
      selected_options: [val],
      true_false: val,
      state: "answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleMatchChange(pairId, rightVal) {
    if (!currentQ) return;
    const existing = candidateAnswers[currentQ.id]?.matches || {};
    const updatedMatches = { ...existing, [pairId]: rightVal };
    const hasAny = Object.values(updatedMatches).some(Boolean);
    const newAns = {
      matches: updatedMatches,
      state: hasAny ? "answered" : "not_answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleCrosswordCellChange(cellCoord, char) {
    if (!currentQ) return;
    const existing = candidateAnswers[currentQ.id]?.crossword_grid || {};
    const cleanChar = (char || "").toUpperCase().slice(-1);
    const updatedGrid = { ...existing, [cellCoord]: cleanChar };
    const hasAny = Object.values(updatedGrid).some(Boolean);
    const newAns = {
      crossword_grid: updatedGrid,
      state: hasAny ? "answered" : "not_answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  function handleClearResponse() {
    if (!currentQ) return;
    const newAns = {
      selected_options: [],
      numerical_value: "",
      one_word: "",
      true_false: null,
      matches: {},
      crossword_grid: {},
      code: "",
      state: "not_answered"
    };
    saveAnswerData(currentQ.id, newAns);
  }

  function handleMarkForReview() {
    if (!currentQ) return;
    const existing = candidateAnswers[currentQ.id] || {};
    const hasAnswer = (existing.selected_options && existing.selected_options.length > 0) ||
      existing.numerical_value ||
      existing.one_word ||
      existing.true_false ||
      (existing.matches && Object.values(existing.matches).some(Boolean)) ||
      (existing.crossword_grid && Object.values(existing.crossword_grid).some(Boolean)) ||
      (existing.code && existing.code.trim().length > 0);
    const newAns = {
      ...existing,
      state: hasAnswer ? "answered_marked" : "marked"
    };
    saveAnswerData(currentQ.id, newAns);
  }

  function getActiveCode(question) {
    if (!question) return "";
    const saved = candidateAnswers[question.id]?.code;
    if (saved !== undefined && saved !== null) return saved;
    const starterObj = question.content?.starter_code || {};
    return starterObj[codingLang] || starterObj["python"] || "# Write your solution here\n";
  }

  function handleCodeUpdate(val) {
    if (!currentQ) return;
    const newAns = {
      ...(candidateAnswers[currentQ.id] || {}),
      code: val,
      language: codingLang,
      state: val.trim() ? "answered" : "not_answered",
      timestamp: new Date().toISOString()
    };
    saveAnswerData(currentQ.id, newAns);
  }

  async function handleRunCodeSandbox(isSubmission = false) {
    if (!currentQ) return;
    const code = getActiveCode(currentQ);
    setCodingExecution({ running: true, result: null });
    try {
      if (isSubmission) {
        setCodingConsoleTab("evaluation");
        const res = await api.evaluateCode({
          source_code: code,
          language: codingLang,
          question_id: currentQ.id,
          time_limit_sec: currentQ.content?.time_limit_sec || 3.0
        });
        setCodingExecution({ running: false, result: res });
        if (res.all_passed) {
          saveAnswerData(currentQ.id, {
            code,
            language: codingLang,
            state: "answered",
            evaluated_score: res.score_percentage
          });
        }
      } else if (codingConsoleTab === "custom") {
        const res = await api.executeCode({
          source_code: code,
          language: codingLang,
          stdin_input: codingCustomInput,
          time_limit_sec: currentQ.content?.time_limit_sec || 3.0
        });
        setCodingExecution({ running: false, result: res });
      } else {
        // Run against visible sample test cases
        const sampleCases = (currentQ.content?.test_cases || []).filter(tc => !tc.is_hidden);
        const res = await api.evaluateCode({
          source_code: code,
          language: codingLang,
          custom_test_cases: sampleCases.length > 0 ? sampleCases : [
            { id: "1", input: "", expected_output: "", is_hidden: false }
          ],
          time_limit_sec: currentQ.content?.time_limit_sec || 3.0
        });
        setCodingExecution({ running: false, result: res });
      }
    } catch (err) {
      setCodingExecution({
        running: false,
        result: {
          status: "runtime_error",
          stderr: err.message || "Failed to execute code in sandbox."
        }
      });
    }
  }

  async function saveAnswerData(questionId, ansObj) {
    setCandidateAnswers((prev) => ({
      ...prev,
      [questionId]: ansObj
    }));

    // 1. Immediately persist locally to zero data-loss store
    offlineStorage.saveAnswerLocal(sessionToken, questionId, ansObj);
    const currQueue = offlineStorage.getPendingQueue(sessionToken);
    setPendingQueueCount(currQueue.length);

    // 2. Dispatch to server if online
    if (navigator.onLine) {
      setAutoSaveStatus("saving");
      try {
        await api.saveCandidateAnswer(sessionToken, questionId, ansObj);
        offlineStorage.dequeuePendingSync(sessionToken, questionId);
        setPendingQueueCount(offlineStorage.getPendingQueue(sessionToken).length);
        setAutoSaveStatus("saved");
      } catch (err) {
        console.warn("Autosave remote issue (safely buffered locally):", err.message);
        setAutoSaveStatus("error");
      }
    } else {
      setAutoSaveStatus("error");
    }
  }

  // Periodic and Network Reconnection Sync Listener
  useEffect(() => {
    if (step !== "attempt" || !sessionToken) return;

    async function drainBufferedQueue() {
      if (navigator.onLine) {
        const queue = offlineStorage.getPendingQueue(sessionToken);
        if (queue.length > 0) {
          setAutoSaveStatus("saving");
          const flushed = await offlineStorage.flushQueue(sessionToken, api.saveCandidateAnswer);
          const remaining = offlineStorage.getPendingQueue(sessionToken).length;
          setPendingQueueCount(remaining);
          if (remaining === 0 && flushed > 0) {
            setAutoSaveStatus("saved");
          }
        }
      }
    }

    function handleOnline() {
      setIsOnline(true);
      drainBufferedQueue();
    }

    function handleOffline() {
      setIsOnline(false);
      setAutoSaveStatus("error");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const syncInterval = setInterval(drainBufferedQueue, 6000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncInterval);
    };
  }, [step, sessionToken]);

  // 5. Final Submission
  async function handleSubmitExam(isAuto = false) {
    if (!isAuto && !window.confirm("Are you sure you want to finalize and submit your examination?")) return;
    setIsSubmitting(true);
    try {
      // Exit fullscreen on submit
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      // Flush any lingering queued answers before submitting
      await offlineStorage.flushQueue(sessionToken, api.saveCandidateAnswer);
      const res = await api.submitCandidateExam(sessionToken);
      offlineStorage.clearSession(sessionToken);
      setSubmitResult(res);
      setStep("completed");

      // Auto Turn-In to Google Classroom
      if (res?.attempt_id || attemptId) {
        triggerClassroomTurnIn(res?.attempt_id || attemptId, res?.score_total, res?.max_score);
      }
    } catch (err) {
      alert("Submission error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function triggerClassroomTurnIn(targetAttemptId, score, maxScore) {
    if (!targetAttemptId) return;
    setClassroomTurnInLoading(true);
    setClassroomTurnInStatus("turning_in");
    try {
      await api.turnInToClassroom({
        attempt_id: targetAttemptId,
        score: score,
        max_score: maxScore,
        candidate_email: candidateUid
      });
      setClassroomTurnInStatus("turned_in");
    } catch (e) {
      console.warn("Classroom turn-in notice:", e);
      setClassroomTurnInStatus("idle");
    } finally {
      setClassroomTurnInLoading(false);
    }
  }

  async function handleManualTurnIn() {
    const targetId = submitResult?.attempt_id || attemptId;
    if (!targetId) return;
    triggerClassroomTurnIn(targetId, submitResult?.score_total, submitResult?.max_score);
  }

  // Calculate palette state counts
  const totalQuestionsCount = paper?.questions?.length || 0;
  const answeredCount = Object.values(candidateAnswers).filter(
    (a) => a.state === "answered" || a.state === "answered_marked"
  ).length;
  const markedCount = Object.values(candidateAnswers).filter(
    (a) => a.state === "marked" || a.state === "answered_marked"
  ).length;
  const notAnsweredCount = Object.values(candidateAnswers).filter(
    (a) => a.state === "not_answered"
  ).length;
  const notVisitedCount = Math.max(0, totalQuestionsCount - answeredCount - markedCount - notAnsweredCount);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
      {/* ----------------- STEP 1: UID & PIN ENTRY ----------------- */}
      {step === "uid_entry" && (
        <div style={{ maxWidth: "480px", margin: "70px auto", padding: "0 20px" }}>
          <div className="dash-card" style={{ padding: "36px", background: "#ffffff" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{
                  width: "56px",
                  height: "56px",
                  objectFit: "contain",
                  borderRadius: "50%",
                  margin: "0 auto 14px auto",
                  display: "block",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                }}
              />
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
                Candidate Exam Portal
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                Enter your assigned Exam UID to begin. No permanent account required.
              </p>
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

            <div style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#1e40af",
              marginBottom: "16px",
              lineHeight: "1.5"
            }}>
              💡 <strong>Login with your Examination Credentials:</strong> Enter the Exam Room Code, Candidate UID, and Access Password/PIN from your Credentials PDF Sheet or Google Classroom announcement.
            </div>

            <form onSubmit={handleVerifyAccess} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>
                  Exam Room Code or Identifier
                </label>
                <input
                  type="text"
                  className="lunaris-input"
                  value={examSlug}
                  onChange={(e) => setExamSlug(e.target.value)}
                  placeholder="e.g. ROOM-8492 or midterm-exam"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>
                  Candidate Login UID
                </label>
                <input
                  type="text"
                  className="lunaris-input"
                  value={candidateUid}
                  onChange={(e) => setCandidateUid(e.target.value)}
                  placeholder="e.g. LUN-481920 (from your Credentials Sheet)"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>
                  Access Password / PIN
                </label>
                <input
                  type="password"
                  className="lunaris-input"
                  value={accessPin}
                  onChange={(e) => setAccessPin(e.target.value)}
                  placeholder="e.g. 6-digit passcode from your Credentials Sheet"
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ height: "44px", fontSize: "14px", marginTop: "8px" }}
              >
                {loading ? "Verifying Enrollment..." : "Validate & Proceed to Preflight →"}
              </button>
            </form>

            <div style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-subtle)",
              textAlign: "center"
            }}>
              <button
                type="button"
                onClick={onExit}
                style={{ background: "none", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
              >
                ← Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- STEP 2: PREFLIGHT CHECKS & CONSENT ----------------- */}
      {step === "preflight" && (
        <div style={{ maxWidth: "760px", margin: "50px auto", padding: "0 24px" }}>
          <div className="dash-card" style={{ padding: "36px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--accent-blue)", fontWeight: "700" }}>
                  Step 2 of 3 • System Preflight Verification
                </span>
                <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {examDetails?.title || "Examination Preflight"}
                </h2>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Candidate: <strong>{candidateName}</strong> • UID: <strong>{candidateUid}</strong>
                </div>
              </div>
              <div style={{
                padding: "8px 14px",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                textAlign: "right"
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Duration</span>
                <strong>{examDetails?.duration_minutes || 180} Minutes</strong>
              </div>
            </div>

            {/* Camera & Integrity Verification Widget */}
            {isProctoringRequired ? (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "8px" }}>
                  1. On-Device Camera & Sensor Test
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  MediaPipe runs directly inside your browser. No continuous video is sent or stored on our servers.
                </p>
                <div style={{ maxWidth: "340px" }}>
                  <MediaPipeProctor
                    candidateSessionToken={sessionToken}
                    onEventLogged={() => setCameraVerified(true)}
                  />
                </div>
              </div>
            ) : (
              <div style={{
                padding: "20px",
                background: "var(--accent-blue-subtle)",
                borderRadius: "10px",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                marginBottom: "24px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "24px" }}>📝</span>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--accent-blue)", margin: 0 }}>
                      Standard Practice Quiz Mode
                    </h3>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Self-paced evaluation • Camera and fullscreen lockdown disabled
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.6" }}>
                  • <strong>No Camera or Audio Required:</strong> Your webcam will remain completely off.<br />
                  • <strong>No Fullscreen Lockdown:</strong> You can resize windows and use reference tabs freely.<br />
                  • <strong>Instant Autosave:</strong> Your question responses save continuously to the server.
                </p>
              </div>
            )}

            {/* Privacy & Fairness Statement */}
            <div style={{
              padding: "16px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              marginBottom: "24px"
            }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "6px" }}>
                {isProctoringRequired ? "🛡️ Examination Integrity & Fairness Notice" : "📋 Assessment Information"}
              </h4>
              <ul style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.7", paddingLeft: "18px" }}>
                {isProctoringRequired ? (
                  <>
                    <li>Your browser will monitor window focus, tab switching, and fullscreen state.</li>
                    <li>Face verification signals are evaluated as risk indicators for human proctors rather than automated disqualification.</li>
                    <li>Your answers autosave continuously against our secure server clock.</li>
                    <li>If your camera or network disconnects, your progress remains intact.</li>
                  </>
                ) : (
                  <>
                    <li>Standard Practice Mode: Work through the examination items at your own pace within the timer.</li>
                    <li>Autosave active: Every selected answer is recorded securely in real-time.</li>
                    <li>You can review and navigate freely between question subjects prior to final submission.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Consent Checkbox Card */}
            <div style={{
              padding: "16px",
              background: consentChecked ? "rgba(37, 99, 235, 0.05)" : "#ffffff",
              border: `2px solid ${consentChecked ? "var(--accent-blue)" : "var(--border-subtle)"}`,
              borderRadius: "10px",
              marginBottom: "24px",
              transition: "all 0.2s ease"
            }}>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--text-primary)"
              }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  style={{ marginTop: "2px", width: "18px", height: "18px", accentColor: "var(--accent-blue)", cursor: "pointer" }}
                />
                <span style={{ lineHeight: "1.5" }}>
                  <strong>I agree to the proctoring guidelines</strong> and understand that my examination session is monitored in accordance with the privacy policy.
                  {!consentChecked && (
                    <span style={{ display: "block", color: "var(--accent-blue)", fontSize: "12px", marginTop: "4px", fontWeight: "600" }}>
                      👉 Check this box to enable the "Begin Examination" button below
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep("uid_entry")}
              >
                ← Back
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!consentChecked) {
                    alert("Please check the agreement box above to confirm your consent before beginning the exam.");
                    return;
                  }
                  handleStartExam();
                }}
                disabled={loading}
                style={{
                  padding: "10px 24px",
                  fontSize: "14px",
                  opacity: !consentChecked ? 0.75 : 1,
                  cursor: "pointer"
                }}
              >
                {loading ? "Initializing Exam Session..." : "Begin Examination →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- STEP 3: CBT EXAM ATTEMPT ----------------- */}
      {step === "attempt" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none"
        }}>
          {/* Fullscreen Violation Lockout Modal (proctored CBT only) */}
          {fullscreenViolation && isProctoringRequired && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(8px)",
              zIndex: 999999,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              color: "#ffffff",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "56px", marginBottom: "16px" }}></div>
              <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#ef4444", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                FULLSCREEN MODE REQUIRED
              </h2>
              <p style={{ maxWidth: "560px", fontSize: "15px", color: "#cbd5e1", lineHeight: "1.6", marginBottom: "28px" }}>
                This proctored examination must be conducted in full screen mode only. Leaving fullscreen or switching windows has been flagged as a security event in the proctoring incident log.
              </p>
              <button
                type="button"
                onClick={handleReEnterFullscreen}
                style={{
                  padding: "14px 32px",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "800",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(37,99,235,0.4)"
                }}
              >
                Return to Fullscreen & Resume Exam →
              </button>
            </div>
          )}

          {/* Copying Blocked Toast Alert */}
          {copyWarning && (
            <div style={{
              position: "fixed",
              top: "70px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 99999,
              background: "rgba(220, 38, 38, 0.95)",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              fontWeight: "700",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <span>🚫</span>
              <span>Copying, cutting, or pasting question content is strictly prohibited. Incident logged.</span>
            </div>
          )}

          {/* Proctor Live Advisory Toast */}
          {proctorToast && (
            <div style={{
              position: "fixed",
              top: "70px",
              right: "24px",
              zIndex: 99999,
              background: "#0f172a",
              border: `1.5px solid ${proctorToast.isCritical ? "#ef4444" : "#f59e0b"}`,
              color: "#ffffff",
              padding: "14px 18px",
              borderRadius: "10px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              maxWidth: "360px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px"
            }}>
              <span style={{ fontSize: "22px", flexShrink: 0 }}>
                {proctorToast.icon || ""}
              </span>
              <div>
                <div style={{
                  fontSize: "13px",
                  fontWeight: "800",
                  color: proctorToast.isCritical ? "#f87171" : "var(--accent-amber)",
                  marginBottom: "4px"
                }}>
                  {proctorToast.title}
                </div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: "1.4" }}>
                  {proctorToast.message}
                </div>
              </div>
            </div>
          )}

          {/* Top Exam Header */}
          <header style={{
            minHeight: "56px",
            background: "#ffffff",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 24px",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{ width: "26px", height: "26px", objectFit: "contain", borderRadius: "50%" }}
              />
              <span style={{ fontWeight: "800", fontSize: "16px", color: "var(--text-primary)" }}>
                {paper?.title || "Computer-Based Examination"}
              </span>
              <span style={{
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "4px",
                background: isStandardQuiz ? "var(--accent-blue-subtle)" : "rgba(37, 99, 235, 0.1)",
                color: isStandardQuiz ? "var(--accent-blue)" : "#2563eb"
              }}>
                {isStandardQuiz ? "Standard Practice Quiz" : "Proctored Computer-Based Assessment"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                • Candidate: <strong>{candidateName}</strong> ({candidateUid})
              </span>
            </div>

            {/* Accessibility, Sync Status, Timer & Submit */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {/* Font Size Zoom Controls */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--bg-secondary)",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                padding: "2px"
              }}>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(13, s - 2))}
                  style={{ background: "none", border: "none", padding: "4px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: "var(--text-secondary)" }}
                  title="Decrease Font Size"
                >
                  A-
                </button>
                <span style={{ fontSize: "11px", fontWeight: "bold", padding: "0 4px", color: "var(--text-muted)" }}>{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(22, s + 2))}
                  style={{ background: "none", border: "none", padding: "4px 8px", fontSize: "13px", fontWeight: "700", cursor: "pointer", color: "var(--text-secondary)" }}
                  title="Increase Font Size"
                >
                  A+
                </button>
              </div>

              {/* Real-time Network / Offline Sync Status Badge */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                background: !isOnline ? "#fef3c7" : pendingQueueCount > 0 ? "#eff6ff" : "var(--accent-emerald-subtle)",
                color: !isOnline ? "#b45309" : pendingQueueCount > 0 ? "var(--accent-blue)" : "var(--accent-emerald)",
                border: `1px solid ${!isOnline ? "#fde68a" : pendingQueueCount > 0 ? "#bfdbfe" : "rgba(16, 185, 129, 0.2)"}`
              }}>
                <span style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: !isOnline ? "#f59e0b" : pendingQueueCount > 0 ? "#3b82f6" : "#10b981",
                  display: "inline-block"
                }} />
                {!isOnline ? (
                  <span>Offline ({pendingQueueCount} in local storage)</span>
                ) : pendingQueueCount > 0 ? (
                  <span>Syncing ({pendingQueueCount})...</span>
                ) : autoSaveStatus === "saving" ? (
                  <span>Saving...</span>
                ) : (
                  <span>All Answers Synced</span>
                )}
              </div>

              {/* Examination Timer */}
              <div style={{
                padding: "6px 14px",
                background: remainingSeconds < 300 ? "var(--accent-rose-subtle)" : "var(--accent-blue-subtle)",
                color: remainingSeconds < 300 ? "var(--accent-rose)" : "var(--accent-blue)",
                borderRadius: "6px",
                fontWeight: "800",
                fontSize: "15px",
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--border-subtle)"
              }}>
                 {formatTime(remainingSeconds)}
              </div>

              {/* Mobile Palette Button */}
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "700" }}
              >
                📑 Palette ({answeredCount}/{totalQuestionsCount})
              </button>

              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                disabled={isSubmitting}
                style={{
                  padding: "7px 18px",
                  background: "#16a34a",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontWeight: "700",
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)"
                }}
              >
                {isSubmitting ? "Submitting..." : "Submit Exam "}
              </button>
            </div>
          </header>

          {/* Real-time Screen & Integrity Violation Alert Banner */}
          {activeViolationAlert && (
            <div style={{
              background: "#fef2f2",
              borderBottom: "2px solid #ef4444",
              color: "#991b1b",
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "13px",
              fontWeight: "600",
              zIndex: 100,
              boxShadow: "0 2px 6px rgba(239, 68, 68, 0.15)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}></span>
                <div>
                  <strong>{activeViolationAlert.title} (#{violationCount}): </strong>
                  <span>{activeViolationAlert.message}</span>
                  <span style={{ fontSize: "11px", color: "#b91c1c", marginLeft: "10px", fontWeight: "normal" }}>
                    Logged at {activeViolationAlert.time} • Recorded for human faculty review
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveViolationAlert(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#991b1b",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "4px 8px"
                }}
              >
                ✕ Dismiss
              </button>
            </div>
          )}

          {/* Section Bar & Real-time Question Stats Banner */}
          <div style={{
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 24px",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-muted)", marginRight: "4px" }}>
                SECTIONS:
              </span>
              {(examSubjects.length > 0 ? examSubjects : ["General"]).map((subject) => {
                const subQuestions = paper?.questions?.filter((q) => (q.subject || "General") === subject) || [];
                const subAnswered = subQuestions.filter(
                  (q) => candidateAnswers[q.id]?.state === "answered" || candidateAnswers[q.id]?.state === "answered_marked"
                ).length;
                const isActive = activeSubject === subject;
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => {
                      setActiveSubject(subject);
                      setActiveQuestionIndex(0);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: isActive ? "700" : "500",
                      background: isActive ? "#ffffff" : "transparent",
                      color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                      border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    {subject} <strong>({subAnswered}/{subQuestions.length})</strong>
                  </button>
                );
              })}
            </div>

            {/* Global Summary Chips */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "11px", fontWeight: "700", flexWrap: "wrap" }}>
              <span style={{ background: "var(--accent-emerald-subtle)", color: "var(--accent-emerald)", padding: "3px 8px", borderRadius: "4px" }}>
                 Answered: {answeredCount}
              </span>
              <span style={{ background: "rgba(147, 51, 234, 0.1)", color: "#9333ea", padding: "3px 8px", borderRadius: "4px" }}>
                ⭐ Marked: {markedCount}
              </span>
              <span style={{ background: "var(--accent-rose-subtle)", color: "#dc2626", padding: "3px 8px", borderRadius: "4px" }}>
                ✕ Not Answered: {notAnsweredCount}
              </span>
              <span style={{ background: "#e2e8f0", color: "#64748b", padding: "3px 8px", borderRadius: "4px" }}>
                ⚪ Not Visited: {notVisitedCount}
              </span>
            </div>
          </div>

          {/* Exam Body: Left Question Paper, Right Palette & Proctor */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Left: Question Content & Options */}
            <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {currentQ ? (
                <div style={{ flex: 1 }}>
                  {/* Question Header with Flag / Bookmark action */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-primary)" }}>
                        Question {activeQuestionIndex + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={handleMarkForReview}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "4px",
                          border: "1px solid rgba(147, 51, 234, 0.3)",
                          background: currentAns?.state?.includes("marked") ? "rgba(147, 51, 234, 0.15)" : "transparent",
                          color: "#9333ea",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        {currentAns?.state?.includes("marked") ? "⭐ Flagged for Review" : "☆ Flag Question"}
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                      <span style={{ color: "#059669", fontWeight: "700", padding: "2px 8px", background: "var(--accent-emerald-subtle)", borderRadius: "4px" }}>
                        +{currentQ.points_positive} Correct
                      </span>
                      <span style={{ color: "#dc2626", fontWeight: "700", padding: "2px 8px", background: "var(--accent-rose-subtle)", borderRadius: "4px" }}>
                        {currentQ.points_negative} Incorrect
                      </span>
                    </div>
                  </div>

                  {/* Question Text (with dynamic font scale) */}
                  <div style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: "1.7",
                    color: "var(--text-primary)",
                    padding: "20px",
                    background: "var(--bg-secondary)",
                    borderRadius: "10px",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "24px"
                  }}>
                    {currentQ.content.text}
                  </div>

                  {/* Options, Numerical Keypad, One-Word, True/False, Match Following, or Crossword */}
                  {currentQ.type === "numerical" ? (
                    <div style={{ maxWidth: "360px" }}>
                      <NumericalKeypad
                        value={currentAns?.numerical_value || ""}
                        onChange={handleNumericalInput}
                      />
                    </div>
                  ) : (currentQ.type === "one_word" || currentQ.type === "single_word" || currentQ.type === "fill_blank") ? (
                    <div style={{ background: "#ffffff", padding: "24px", borderRadius: "10px", border: "1px solid var(--border-subtle)", maxWidth: "560px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                        ✍️ One-Word Answer / Definition
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                        Enter the single term or definition that accurately satisfies the formulation above.
                      </p>
                      {currentQ.content.hint && (
                        <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1", fontSize: "12px", color: "#475569", marginBottom: "14px" }}>
                          💡 <strong>Hint / Clue:</strong> {currentQ.content.hint}
                        </div>
                      )}
                      <input
                        type="text"
                        value={currentAns?.one_word || currentAns?.text_answer || ""}
                        onChange={(e) => handleOneWordInput(e.target.value)}
                        placeholder="Type your one-word answer here..."
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          borderRadius: "8px",
                          border: "2px solid #3b82f6",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#0f172a",
                          background: "#f0f9ff"
                        }}
                      />
                    </div>
                  ) : currentQ.type === "true_false" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "480px" }}>
                      {[
                        { val: "true", label: "TRUE", icon: "", bg: "#ecfdf5", border: "#10b981", activeBg: "#059669" },
                        { val: "false", label: "FALSE", icon: "✕", bg: "#fef2f2", border: "#ef4444", activeBg: "#dc2626" }
                      ].map((tf) => {
                        const isSelected = String(currentAns?.true_false || currentAns?.selected_options?.[0]).toLowerCase() === tf.val;
                        return (
                          <div
                            key={tf.val}
                            onClick={() => handleTrueFalseSelect(tf.val)}
                            style={{
                              padding: "20px",
                              borderRadius: "10px",
                              border: `2px solid ${isSelected ? tf.border : "var(--border-subtle)"}`,
                              background: isSelected ? tf.bg : "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              transition: "all 0.15s ease",
                              boxShadow: isSelected ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none"
                            }}
                          >
                            <span style={{
                              fontSize: "28px",
                              color: isSelected ? (tf.val === "true" ? "#059669" : "#dc2626") : "var(--text-muted)",
                              fontWeight: "900"
                            }}>
                              {tf.icon}
                            </span>
                            <span style={{
                              fontSize: "16px",
                              fontWeight: "800",
                              color: isSelected ? (tf.val === "true" ? "#047857" : "#b91c1c") : "var(--text-primary)"
                            }}>
                              {tf.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : currentQ.type === "match_following" ? (
                    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-subtle)", maxWidth: "680px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
                        🔗 Match Column A with Column B
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {(currentQ.content.pairs || []).map((pair, idx) => {
                          const currentSelection = (currentAns?.matches || {})[pair.id] || "";
                          const allRightOptions = (currentQ.content.pairs || []).map(p => p.right);
                          return (
                            <div key={pair.id || idx} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <div style={{ flex: 1, fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                                <span style={{ color: "#64748b", marginRight: "6px" }}>({String.fromCharCode(65 + idx)})</span>
                                {pair.left}
                              </div>
                              <span style={{ color: "#94a3b8", fontSize: "16px" }}>➔</span>
                              <div style={{ flex: 1 }}>
                                <select
                                  value={currentSelection}
                                  onChange={(e) => handleMatchChange(pair.id, e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: currentSelection ? "2px solid #3b82f6" : "1px solid #cbd5e1",
                                    background: currentSelection ? "#eff6ff" : "#ffffff",
                                    fontSize: "13px",
                                    fontWeight: currentSelection ? "600" : "400"
                                  }}
                                >
                                  <option value="">-- Select Matching Item --</option>
                                  {allRightOptions.map((r, rIdx) => (
                                    <option key={rIdx} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : currentQ.type === "crossword" ? (
                    <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-subtle)", maxWidth: "760px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
                        🧩 Crossword Puzzle Clues & Answer Grid
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {(currentQ.content.clues || []).map((clueItem, cIdx) => {
                          const ansLen = (clueItem.answer || "").length || 6;
                          const isDown = clueItem.direction === "down";
                          const r = parseInt(clueItem.row) || 0;
                          const c = parseInt(clueItem.col) || 0;
                          return (
                            <div key={cIdx} style={{ padding: "14px", background: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                                <span style={{ fontWeight: "700", color: "#6b21a8" }}>
                                  #{cIdx + 1} {clueItem.direction.toUpperCase()} ({ansLen} letters):
                                </span>
                                <span style={{ color: "#7e22ce", fontStyle: "italic" }}>
                                  {clueItem.clue}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                                {Array.from({ length: ansLen }).map((_, letterIdx) => {
                                  const cellCoord = `${isDown ? r + letterIdx : r},${isDown ? c : c + letterIdx}`;
                                  const cellChar = (currentAns?.crossword_grid || {})[cellCoord] || "";
                                  return (
                                    <input
                                      key={letterIdx}
                                      id={`cw_${currentQ.id}_${cIdx}_${letterIdx}`}
                                      type="text"
                                      maxLength={1}
                                      value={cellChar}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        handleCrosswordCellChange(cellCoord, val);
                                        if (val && letterIdx < ansLen - 1) {
                                          const nextEl = document.getElementById(`cw_${currentQ.id}_${cIdx}_${letterIdx + 1}`);
                                          if (nextEl) nextEl.focus();
                                        }
                                      }}
                                      style={{
                                        width: "36px",
                                        height: "40px",
                                        textAlign: "center",
                                        fontSize: "16px",
                                        fontWeight: "800",
                                        textTransform: "uppercase",
                                        borderRadius: "6px",
                                        border: cellChar ? "2px solid #7c3aed" : "1px solid #cbd5e1",
                                        background: cellChar ? "#f3e8ff" : "#ffffff",
                                        color: "#581c87"
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : currentQ.type === "coding" ? (
                    /* 💻 Interactive Coding & Scripting Sandbox IDE */
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "920px" }}>
                      {/* Top IDE Toolbar */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                        background: "#0f172a",
                        color: "#f8fafc",
                        padding: "10px 16px",
                        borderRadius: "8px 8px 0 0",
                        border: "1px solid #1e293b"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Language:
                          </span>
                          <select
                            value={codingLang}
                            onChange={(e) => {
                              const newLang = e.target.value;
                              setCodingLang(newLang);
                              const starter = currentQ.content?.starter_code?.[newLang] || "";
                              if (starter) {
                                handleCodeUpdate(starter);
                              }
                            }}
                            style={{
                              background: "#1e293b",
                              color: "#38bdf8",
                              border: "1px solid #334155",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                          >
                            <option value="python">🐍 Python 3.12</option>
                            <option value="javascript">⚡ JavaScript (Node.js)</option>
                            <option value="cpp">⚙️ C++ (G++ 17)</option>
                            <option value="java">☕ Java (OpenJDK 17)</option>
                          </select>

                          <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "#64748b" }}>
                            <span> {currentQ.content.time_limit_sec || 2.0}s limit</span>
                            <span>•</span>
                            <span>💾 {currentQ.content.memory_limit_mb || 256}MB</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              const starter = currentQ.content?.starter_code?.[codingLang] || "";
                              handleCodeUpdate(starter);
                            }}
                            style={{
                              background: "transparent",
                              border: "1px solid #334155",
                              color: "#94a3b8",
                              borderRadius: "6px",
                              padding: "6px 12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            ↺ Reset Template
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunCodeSandbox(false)}
                            disabled={codingExecution.running}
                            style={{
                              background: "#1e293b",
                              border: "1px solid #475569",
                              color: "#f8fafc",
                              borderRadius: "6px",
                              padding: "6px 14px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: codingExecution.running ? "not-allowed" : "pointer"
                            }}
                          >
                            {codingExecution.running && codingConsoleTab !== "evaluation" ? "Running..." : "▶ Run Sample Cases"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunCodeSandbox(true)}
                            disabled={codingExecution.running}
                            style={{
                              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                              border: "none",
                              color: "#ffffff",
                              borderRadius: "6px",
                              padding: "6px 16px",
                              fontSize: "12px",
                              fontWeight: "800",
                              cursor: codingExecution.running ? "not-allowed" : "pointer",
                              boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)"
                            }}
                          >
                            {codingExecution.running && codingConsoleTab === "evaluation" ? "Evaluating..." : "🚀 Submit Solution"}
                          </button>
                        </div>
                      </div>

                      {/* Code Editor Body */}
                      <div style={{
                        position: "relative",
                        background: "#090d16",
                        border: "1px solid #1e293b",
                        borderTop: "none",
                        borderRadius: "0 0 8px 8px",
                        overflow: "hidden"
                      }}>
                        <textarea
                          rows={14}
                          value={getActiveCode(currentQ)}
                          onChange={(e) => handleCodeUpdate(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Tab") {
                              e.preventDefault();
                              const start = e.target.selectionStart;
                              const end = e.target.selectionEnd;
                              const val = e.target.value;
                              const newVal = val.substring(0, start) + "    " + val.substring(end);
                              handleCodeUpdate(newVal);
                              setTimeout(() => {
                                e.target.selectionStart = e.target.selectionEnd = start + 4;
                              }, 0);
                            }
                          }}
                          spellCheck="false"
                          autoCapitalize="off"
                          autoComplete="off"
                          style={{
                            width: "100%",
                            padding: "16px",
                            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
                            fontSize: "13px",
                            lineHeight: "1.6",
                            background: "transparent",
                            color: "#e2e8f0",
                            border: "none",
                            outline: "none",
                            resize: "vertical"
                          }}
                        />
                      </div>

                      {/* Output Console & Test Cases Panel */}
                      <div style={{
                        background: "#ffffff",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "8px",
                        overflow: "hidden"
                      }}>
                        {/* Subtabs */}
                        <div style={{
                          display: "flex",
                          background: "#f8fafc",
                          borderBottom: "1px solid var(--border-subtle)",
                          padding: "4px 8px",
                          gap: "4px"
                        }}>
                          <button
                            type="button"
                            onClick={() => setCodingConsoleTab("sample")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              border: "none",
                              background: codingConsoleTab === "sample" ? "#ffffff" : "transparent",
                              color: codingConsoleTab === "sample" ? "var(--accent-blue)" : "var(--text-secondary)",
                              boxShadow: codingConsoleTab === "sample" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                            }}
                          >
                            📋 Sample Cases ({(currentQ.content?.test_cases || []).filter(c => !c.is_hidden).length})
                          </button>

                          <button
                            type="button"
                            onClick={() => setCodingConsoleTab("custom")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              border: "none",
                              background: codingConsoleTab === "custom" ? "#ffffff" : "transparent",
                              color: codingConsoleTab === "custom" ? "var(--accent-blue)" : "var(--text-secondary)",
                              boxShadow: codingConsoleTab === "custom" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                            }}
                          >
                            ⌨️ Custom Stdin
                          </button>

                          <button
                            type="button"
                            onClick={() => setCodingConsoleTab("evaluation")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              border: "none",
                              background: codingConsoleTab === "evaluation" ? "#ffffff" : "transparent",
                              color: codingConsoleTab === "evaluation" ? "var(--accent-blue)" : "var(--text-secondary)",
                              boxShadow: codingConsoleTab === "evaluation" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                            }}
                          >
                            📊 Full Suite Evaluation
                          </button>
                        </div>

                        {/* Console Body */}
                        <div style={{ padding: "16px" }}>
                          {/* TAB 1: Sample Cases */}
                          {codingConsoleTab === "sample" && (
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                                Sample Cases Available for Debugging:
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {(currentQ.content?.test_cases || []).filter(c => !c.is_hidden).map((tc, idx) => (
                                  <div key={idx} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
                                      <strong style={{ color: "#0f172a" }}>Sample #{idx + 1}</strong>
                                      {tc.explanation && <span style={{ color: "var(--text-muted)" }}>{tc.explanation}</span>}
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", fontFamily: "monospace" }}>
                                      <div>
                                        <span style={{ color: "#64748b", display: "block" }}>Input:</span>
                                        <pre style={{ margin: 0, padding: "4px 6px", background: "#ffffff", borderRadius: "4px", border: "1px solid #cbd5e1" }}>{tc.input || "(empty)"}</pre>
                                      </div>
                                      <div>
                                        <span style={{ color: "#64748b", display: "block" }}>Expected Output:</span>
                                        <pre style={{ margin: 0, padding: "4px 6px", background: "#ffffff", borderRadius: "4px", border: "1px solid #cbd5e1" }}>{tc.expected_output}</pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {codingExecution.result && (
                                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #e2e8f0" }}>
                                  <div style={{ fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>Execution Output:</div>
                                  <pre style={{
                                    margin: 0,
                                    padding: "10px",
                                    borderRadius: "6px",
                                    fontFamily: "monospace",
                                    fontSize: "12px",
                                    background: codingExecution.result.status === "runtime_error" ? "#fef2f2" : "#f1f5f9",
                                    color: codingExecution.result.status === "runtime_error" ? "#dc2626" : "#0f172a",
                                    border: "1px solid #cbd5e1",
                                    maxHeight: "140px",
                                    overflowY: "auto"
                                  }}>
                                    {codingExecution.result.stdout || codingExecution.result.stderr || "(no output)"}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: Custom Stdin */}
                          {codingConsoleTab === "custom" && (
                            <div>
                              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                                Custom Input (stdin):
                              </label>
                              <textarea
                                rows={3}
                                value={codingCustomInput}
                                onChange={(e) => setCodingCustomInput(e.target.value)}
                                placeholder="Enter custom inputs separated by spaces or newlines..."
                                style={{ width: "100%", padding: "8px", fontFamily: "monospace", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", marginBottom: "10px" }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRunCodeSandbox(false)}
                                disabled={codingExecution.running}
                                className="btn-secondary"
                                style={{ fontSize: "12px", height: "34px" }}
                              >
                                {codingExecution.running ? "Executing..." : "Run with Custom Stdin"}
                              </button>

                              {codingExecution.result && (
                                <div style={{ marginTop: "12px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "4px" }}>Execution Output:</span>
                                  <pre style={{ margin: 0, padding: "8px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "monospace" }}>
                                    {codingExecution.result.stdout || codingExecution.result.stderr || "(no output)"}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 3: Full Evaluation Suite */}
                          {codingConsoleTab === "evaluation" && (
                            <div>
                              {codingExecution.result?.results ? (
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <span style={{
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        background: codingExecution.result.all_passed ? "#d1fae5" : "#fee2e2",
                                        color: codingExecution.result.all_passed ? "#059669" : "#dc2626"
                                      }}>
                                        {codingExecution.result.all_passed ? " All Test Cases Passed" : "✗ Some Test Cases Failed"}
                                      </span>
                                      <span style={{ fontSize: "12px", fontWeight: "700" }}>
                                        Score: {codingExecution.result.score_percentage}% ({codingExecution.result.passed_count}/{codingExecution.result.total_count})
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                      Total Latency: {codingExecution.result.total_time_ms}ms
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {codingExecution.result.results.map((r, rIdx) => (
                                      <div
                                        key={rIdx}
                                        style={{
                                          padding: "8px 12px",
                                          borderRadius: "6px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          background: r.passed ? "#f0fdf4" : "#fef2f2",
                                          border: r.passed ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                          fontSize: "12px"
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span>{r.passed ? "🟢" : "🔴"}</span>
                                          <strong>Test Case #{r.case_number}</strong>
                                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                            {r.is_hidden ? "(Hidden Evaluation)" : "(Sample Case)"}
                                          </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                          <span style={{
                                            fontWeight: "800",
                                            textTransform: "uppercase",
                                            fontSize: "10px",
                                            color: r.passed ? "#15803d" : "#b91c1c"
                                          }}>
                                            {r.status.replace("_", " ")}
                                          </span>
                                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                                            {r.execution_time_ms}ms
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
                                  Click <strong>"🚀 Submit Solution"</strong> to run your code against the complete test case suite.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {currentQ.content.options?.map((opt) => {
                        const isSelected = currentAns?.selected_options?.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleSelectOption(opt.id)}
                            style={{
                              padding: "12px 16px",
                              borderRadius: "8px",
                              border: isSelected ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                              background: isSelected ? "var(--accent-blue-subtle)" : "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <div style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              border: isSelected ? "6px solid var(--accent-blue)" : "2px solid var(--border-strong)",
                              background: "#ffffff"
                            }} />
                            <span style={{ fontSize: "14px", fontWeight: isSelected ? "600" : "400" }}>
                              {opt.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No questions available in this section.
                </div>
              )}

              {/* Bottom Action Bar */}
              <div style={{
                marginTop: "32px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleMarkForReview}
                    style={{
                      padding: "8px 16px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#9333ea"
                    }}
                  >
                    Mark for Review & Next
                  </button>

                  <button
                    type="button"
                    onClick={handleClearResponse}
                    style={{
                      padding: "8px 16px",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "var(--text-secondary)"
                    }}
                  >
                    Clear Response
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activeQuestionIndex === 0}
                    className="btn-secondary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveQuestionIndex((prev) => Math.min(currentQuestions.length - 1, prev + 1))}
                    disabled={activeQuestionIndex >= currentQuestions.length - 1}
                    className="btn-primary"
                    style={{ padding: "8px 20px", fontSize: "13px" }}
                  >
                    Save & Next →
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Palette & Proctoring Sidebar */}
            <aside style={{
              width: "320px",
              borderLeft: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              padding: "16px"
            }}>
              {/* Right: Palette & Proctoring Sidebar */}
              {isProctoringRequired ? (
                <div style={{ marginBottom: "16px" }}>
                  <MediaPipeProctor
                    candidateSessionToken={sessionToken}
                    attemptId={attemptId}
                    onEventLogged={handleProctorViolation}
                  />
                </div>
              ) : (
                <div style={{
                  padding: "12px 14px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <span style={{ fontSize: "22px" }}>📝</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>Standard Practice Quiz</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Camera & fullscreen lockdown disabled</div>
                  </div>
                </div>
              )}

              {/* Palette Legend */}
              <div style={{
                background: "#ffffff",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "16px",
                fontSize: "11px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", background: "#16a34a", borderRadius: "2px" }} />
                  <span>Answered ({answeredCount})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", background: "#9333ea", borderRadius: "50%" }} />
                  <span>Marked ({markedCount})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", background: "#dc2626", borderRadius: "2px" }} />
                  <span>Not Answered</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "12px", background: "#94a3b8", borderRadius: "2px" }} />
                  <span>Not Visited</span>
                </div>
              </div>

              {/* Question Palette Matrix */}
              <div style={{
                flex: 1,
                background: "#ffffff",
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "10px" }}>
                  {activeSubject} Palette
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                  {currentQuestions.map((q, idx) => {
                    const ans = candidateAnswers[q.id];
                    let bg = "#94a3b8"; // unvisited
                    let color = "#ffffff";
                    if (ans?.state === "answered") bg = "#16a34a";
                    else if (ans?.state === "marked") bg = "#9333ea";
                    else if (ans?.state === "answered_marked") bg = "#7e22ce";
                    else if (ans?.state === "not_answered") bg = "#dc2626";

                    const isCurrent = idx === activeQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQuestionIndex(idx)}
                        style={{
                          height: "36px",
                          borderRadius: "6px",
                          background: bg,
                          color,
                          fontWeight: "700",
                          fontSize: "12px",
                          border: isCurrent ? "2px solid #0f172a" : "none",
                          boxShadow: isCurrent ? "0 0 0 2px var(--accent-blue)" : "none"
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>

          {/* Responsive Mobile / Tablet Palette Drawer Modal */}
          {mobilePaletteOpen && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 99999,
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <div style={{
                width: "360px",
                maxWidth: "85vw",
                height: "100%",
                background: "#ffffff",
                boxShadow: "-10px 0 30px rgba(0,0,0,0.25)",
                display: "flex",
                flexDirection: "column",
                padding: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)" }}>
                    Question Palette • {activeSubject}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMobilePaletteOpen(false)}
                    style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                    {currentQuestions.map((q, idx) => {
                      const ans = candidateAnswers[q.id];
                      let bg = "#94a3b8"; // unvisited
                      let color = "#ffffff";
                      if (ans?.state === "answered") bg = "#16a34a";
                      else if (ans?.state === "marked") bg = "#9333ea";
                      else if (ans?.state === "answered_marked") bg = "#7e22ce";
                      else if (ans?.state === "not_answered") bg = "#dc2626";

                      const isCurrent = idx === activeQuestionIndex;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setActiveQuestionIndex(idx);
                            setMobilePaletteOpen(false);
                          }}
                          style={{
                            height: "38px",
                            borderRadius: "6px",
                            background: bg,
                            color,
                            fontWeight: "700",
                            fontSize: "12px",
                            border: isCurrent ? "2px solid #0f172a" : "none",
                            boxShadow: isCurrent ? "0 0 0 2px var(--accent-blue)" : "none",
                            cursor: "pointer"
                          }}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: "16px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setMobilePaletteOpen(false)}
                    className="btn-primary"
                    style={{ width: "100%", padding: "10px", fontSize: "13px" }}
                  >
                    Close Palette
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- STEP 4: SUBMITTED / COMPLETED ----------------- */}
      {step === "completed" && (
        <div style={{ maxWidth: "560px", margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <div className="dash-card" style={{ padding: "40px" }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "var(--accent-emerald-subtle)",
              color: "var(--accent-emerald)",
              display: "grid",
              placeItems: "center",
              fontSize: "28px",
              margin: "0 auto 16px"
            }}>
              
            </div>

            <h2 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-primary)" }}>
              Examination Submitted Successfully
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "6px", marginBottom: "24px" }}>
              Thank you, {candidateName}. Your responses have been safely saved and processed.
            </p>

            {submitResult && (
              <div style={{
                padding: "24px",
                background: "var(--bg-secondary)",
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "28px",
                fontSize: "14px"
              }}>
                <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                    Candidate Examination UID
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-mono)", color: "var(--accent-blue)", marginTop: "2px" }}>
                    {submitResult.candidate_uid}
                  </div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "16px"
                }}>
                  <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Total Score</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--accent-blue)", marginTop: "4px" }}>
                      {submitResult.score_total ?? 0}
                    </div>
                    {submitResult.max_score ? (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>/ {submitResult.max_score} marks</div>
                    ) : null}
                  </div>

                  <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Accuracy</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--accent-emerald)", marginTop: "4px" }}>
                      {submitResult.accuracy != null ? `${Math.round(submitResult.accuracy)}%` : "100%"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Performance</div>
                  </div>

                  <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Correct</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>
                      {submitResult.correct_count ?? answeredCount}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Questions</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
                  <span>Submission Time:</span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {new Date(submitResult.submitted_at || Date.now()).toLocaleTimeString()}
                  </strong>
                </div>
              </div>
            )}

            {/* Google Classroom Turn In Status Card */}
            <div style={{
              padding: "16px 20px",
              background: "#f0fdf4",
              borderRadius: "10px",
              border: "1px solid #bbf7d0",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              textAlign: "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: "#16a34a",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                  🎓
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#166534" }}>
                    Google Classroom Turn-In
                  </div>
                  <div style={{ fontSize: "12px", color: "#15803d" }}>
                    {classroomTurnInStatus === "turned_in"
                      ? " Assignment turned in & grade recorded in Classroom"
                      : "Syncing score & turning in assignment to Google Classroom..."}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualTurnIn}
                disabled={classroomTurnInLoading || classroomTurnInStatus === "turned_in"}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  background: classroomTurnInStatus === "turned_in" ? "#dcfce7" : "#16a34a",
                  color: classroomTurnInStatus === "turned_in" ? "#166534" : "#ffffff",
                  border: "none",
                  cursor: classroomTurnInStatus === "turned_in" ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {classroomTurnInLoading
                  ? "Turning in..."
                  : classroomTurnInStatus === "turned_in"
                  ? " Turned In"
                  : "Turn In to Classroom →"}
              </button>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onExit}
              style={{ width: "100%", height: "42px" }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
