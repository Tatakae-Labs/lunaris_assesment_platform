import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";

export default function ExamCreationWizard({
  organizationId,
  onClose,
  onExamCreated,
  onNavigateToBilling
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [entitlements, setEntitlements] = useState(null);

  // Form State
  // Step 1: Basic Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("University & College Coursework");
  const [language, setLanguage] = useState("English");
  const [instructions, setInstructions] = useState(
    "1. Read all questions carefully.\n2. Ensure your device network connection remains steady throughout.\n3. Complete all sections before submitting your examination."
  );

  // Step 2: Exam Mode & Custom Type
  const [mode, setMode] = useState("standard_quiz"); // 'standard_quiz', 'quick_quiz', 'proctored_cbt', or custom
  const [customExamType, setCustomExamType] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Step 3: Questions & PIC (Per-Item Clock)
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [defaultPerQuestionSeconds, setDefaultPerQuestionSeconds] = useState(30);
  const [questionTimes, setQuestionTimes] = useState({}); // { [question_id]: seconds }
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  // Timing Models & PIC Architecture
  const [timingModel, setTimingModel] = useState("total_duration"); // 'total_duration', 'pic_only', 'dual'
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(30);
  const [picAutoAdvance, setPicAutoAdvance] = useState(true);
  const [picStrictCap, setPicStrictCap] = useState(false);
  const [picStrictCapSeconds, setPicStrictCapSeconds] = useState(120);

  // Quick Quiz Specific State
  const [speedScoring, setSpeedScoring] = useState(true);
  const [podiumRevealCadence, setPodiumRevealCadence] = useState("after_round"); // 'after_round', 'final_only'
  const [allowGuestNicknames, setAllowGuestNicknames] = useState(true);
  const [autoAdvanceRounds, setAutoAdvanceRounds] = useState(true);

  // Standard Quiz Specific State
  const [navigationPolicy, setNavigationPolicy] = useState("free"); // 'free', 'forward_only'
  const [resultReleasePolicy, setResultReleasePolicy] = useState("instant"); // 'instant', 'manual'
  const [allowRetries, setAllowRetries] = useState(false);
  const [showInstantExplanation, setShowInstantExplanation] = useState(true);

  // Proctored CBT Specific State
  const [watermarkOverlay, setWatermarkOverlay] = useState(true);
  const [mandatoryPreflight, setMandatoryPreflight] = useState(true);

  // General Exam Parameters
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [poolSize, setPoolSize] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [sections, setSections] = useState([]);
  const [passPercentage, setPassPercentage] = useState(40);

  // Step 5: Enrollment
  const [enrollmentType, setEnrollmentType] = useState("uid_batch"); // 'classroom', 'uid_batch', 'csv_import'
  const [candidateCount, setCandidateCount] = useState(25);
  const [csvCandidatesText, setCsvCandidatesText] = useState("Name,Email\nAarav Sharma,aarav@student.org\nRohan Verma,rohan@student.org");
  const [maxAttempts, setMaxAttempts] = useState(1);

  // Classroom state inside Wizard
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [selectedClassroomCourse, setSelectedClassroomCourse] = useState("");
  const [classroomStudents, setClassroomStudents] = useState([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomAutoPublish, setClassroomAutoPublish] = useState(true);

  // Step 6: Proctoring Permitted Checks (Proctored CBT only)
  const [proctoringChecks, setProctoringChecks] = useState({
    face_not_detected: true,
    multiple_faces: true,
    head_turned: true,
    tab_switch: true,
    fullscreen_exit: true,
    mobile_hints: true
  });
  const [retentionDays, setRetentionDays] = useState(30);

  // Load available questions, curriculum subjects, subscription entitlements, and Classroom status
  useEffect(() => {
    async function loadInitial() {
      try {
        const [qList, ent, subjs] = await Promise.all([
          api.getQuestions(organizationId),
          api.getOrgEntitlements(organizationId),
          api.getOrgSubjects(organizationId).catch(() => [])
        ]);
        setAvailableQuestions(qList || []);
        setSelectedQuestionIds((qList || []).map((q) => q.id));
        setEntitlements(ent);
        if (subjs && subjs.length > 0) {
          setSections(subjs.map((s) => s.name));
        } else if (qList && qList.length > 0) {
          const distinct = Array.from(new Set(qList.map((q) => q.subject).filter(Boolean)));
          setSections(distinct.length > 0 ? distinct : ["General"]);
        } else {
          setSections(["General"]);
        }
      } catch (err) {
        console.warn("Error loading wizard dependencies:", err.message);
      }

      // Check Classroom status
      try {
        const statusRes = await api.getClassroomStatus(organizationId);
        if (statusRes?.connected) {
          setClassroomConnected(true);
          const courses = await api.getClassroomCourses(organizationId);
          setClassroomCourses(courses || []);
          if (courses && courses.length > 0) {
            setSelectedClassroomCourse(courses[0].id);
            await loadClassroomStudentsForCourse(courses[0].id);
            setEnrollmentType("classroom");
          }
        } else {
          setClassroomConnected(false);
          setEnrollmentType("uid_batch");
        }
      } catch (clsErr) {
        console.warn("Classroom check in wizard:", clsErr);
        setClassroomConnected(false);
        setEnrollmentType("uid_batch");
      }
    }
    loadInitial();
  }, [organizationId]);

  async function loadClassroomStudentsForCourse(courseId) {
    if (!courseId) {
      setClassroomStudents([]);
      return;
    }
    setClassroomLoading(true);
    try {
      const stus = await api.getClassroomStudents(organizationId, courseId);
      setClassroomStudents(stus || []);
    } catch (e) {
      console.warn("Failed loading classroom students in wizard:", e);
      setClassroomStudents([]);
    } finally {
      setClassroomLoading(false);
    }
  }

  async function handleCourseChangeInWizard(courseId) {
    setSelectedClassroomCourse(courseId);
    await loadClassroomStudentsForCourse(courseId);
  }

  function handleConnectGoogleClassroomInWizard() {
    const activeCid = import.meta.env.VITE_GOOGLE_CLIENT_ID || "539216233370-eca2ktq30qc3m74o04b17q7bp90sds0j.apps.googleusercontent.com";
    if (!window.google?.accounts?.oauth2) {
      toast.warning("Google Identity Services is initializing. Please try again in a moment.");
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: activeCid,
      scope: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.coursework.students",
        "https://www.googleapis.com/auth/classroom.coursework.me",
        "https://www.googleapis.com/auth/classroom.announcements",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" "),
      callback: async (tokenResp) => {
        if (tokenResp?.error) {
          toast.warning("Google Classroom authorization was cancelled: " + tokenResp.error);
          return;
        }
        if (tokenResp?.access_token) {
          setClassroomLoading(true);
          try {
            await api.connectClassroom({
              organization_id: organizationId,
              access_token: tokenResp.access_token
            });
            setClassroomConnected(true);
            const courses = await api.getClassroomCourses(organizationId);
            setClassroomCourses(courses || []);
            if (courses && courses.length > 0) {
              setSelectedClassroomCourse(courses[0].id);
              await loadClassroomStudentsForCourse(courses[0].id);
              setEnrollmentType("classroom");
            }
            toast.success("Google Classroom connected successfully! Found your course and students.");
          } catch (err) {
            toast.error("Failed to connect Google Classroom: " + err.message);
          } finally {
            setClassroomLoading(false);
          }
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  function handleSelectMode(selectedMode) {
    setIsCustomMode(false);
    setMode(selectedMode);
    if (selectedMode === "quick_quiz") {
      setTimingModel("pic_only");
      setPerQuestionSeconds(20);
      setDefaultPerQuestionSeconds(20);
      setSpeedScoring(true);
      setDurationMinutes(15);
      setInstructions("1. Fast-paced live arena quiz.\n2. Each question has a strict speed timer.\n3. Speed-bonus scoring awards more points for fast correct answers.");
    } else if (selectedMode === "standard_quiz") {
      setTimingModel("total_duration");
      setPerQuestionSeconds(60);
      setDefaultPerQuestionSeconds(60);
      setSpeedScoring(false);
      setDurationMinutes(45);
      setNegativeMarking(false);
      setInstructions("1. Self-paced practice quiz.\n2. Review your answers before final submission.\n3. Immediate scorecard with detailed explanations provided upon completion.");
    } else if (selectedMode === "proctored_cbt") {
      setTimingModel("total_duration");
      setPerQuestionSeconds(120);
      setDefaultPerQuestionSeconds(120);
      setSpeedScoring(false);
      setDurationMinutes(180);
      setNegativeMarking(true);
      setInstructions("1. Read all questions carefully.\n2. Ensure your webcam and network connection remain steady throughout.\n3. Do not switch tabs or exit fullscreen mode during proctored examinations.");
    }
  }

  function handleToggleQuestion(id) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSetCustomQuestionTime(id, seconds) {
    setQuestionTimes((prev) => ({
      ...prev,
      [id]: Math.max(5, Number(seconds))
    }));
  }

  function handleToggleCheck(key) {
    setProctoringChecks((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  // Define steps list dynamically based on mode (Proctoring step ONLY for Proctored CBT, no Enrollment for Quick Quiz)
  const isProctorMode = mode === "proctored_cbt";
  const isQuickQuizMode = mode === "quick_quiz";
  const isStandardQuizMode = mode === "standard_quiz";
  const stepDefinitions = [
    { num: 1, key: "basic", label: "Basic Details" },
    { num: 2, key: "mode", label: "Exam Mode" },
    { num: 3, key: "questions", label: isStandardQuizMode ? "Questions & PIC" : "Questions" },
    {
      num: 4,
      key: "config",
      label: mode === "quick_quiz"
        ? "Arena Rules"
        : mode === "standard_quiz"
        ? "Quiz Config"
        : "CBT Config"
    },
    ...(!isQuickQuizMode ? [{ num: 5, key: "enrollment", label: "Enrollment" }] : []),
    ...(isProctorMode ? [{ num: 6, key: "proctoring", label: "Proctoring Telemetry" }] : []),
    { num: isProctorMode ? 7 : isQuickQuizMode ? 5 : 6, key: "entitlement", label: "Entitlements" },
    { num: isProctorMode ? 8 : isQuickQuizMode ? 6 : 7, key: "publish", label: "Preview & Publish" }
  ];

  const totalSteps = stepDefinitions.length;

  function nextStep() {
    setErrorMsg("");
    if (currentStep === 1) {
      if (!title.trim()) {
        setErrorMsg("Please enter an exam title.");
        return;
      }
    }
    if (currentStep === 3) {
      if (selectedQuestionIds.length === 0) {
        setErrorMsg("Please select at least 1 question for the exam.");
        return;
      }
    }

    // Step jumping for Quick Quiz (skip Enrollment Step 5 and Proctoring Step 6)
    if (isQuickQuizMode && currentStep === 4) {
      validateSubscription();
      setCurrentStep(7);
      return;
    }

    // Step jumping if proctoring is skipped
    if (!isProctorMode && currentStep === 5) {
      // Skip proctoring (Step 6) and go straight to entitlement check (Step 7)
      validateSubscription();
      setCurrentStep(7);
      return;
    }

    if (isProctorMode && currentStep === 6) {
      validateSubscription();
    }

    setCurrentStep((prev) => Math.min(8, prev + 1));
  }

  function prevStep() {
    setErrorMsg("");
    if (isQuickQuizMode && currentStep === 7) {
      setCurrentStep(4);
      return;
    }
    if (!isProctorMode && currentStep === 7) {
      // Step backwards from entitlement directly to enrollment
      setCurrentStep(5);
      return;
    }
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  // Subscription Entitlement Verification
  const orgPlan = entitlements?.plan_id || "free";
  const proctoringAllowed = entitlements?.entitlements?.proctoring_enabled ?? false;
  const maxCandidatesAllowed = entitlements?.entitlements?.max_candidates ?? 25;
  const effectiveCandidateCount = enrollmentType === "classroom"
    ? (classroomStudents.length || 1)
    : enrollmentType === "uid_batch"
    ? candidateCount
    : Math.max(1, csvCandidatesText.split("\n").filter((r) => r.trim()).length - 1);
  const candidateExceeded = effectiveCandidateCount > maxCandidatesAllowed;
  const proctoringRestricted = mode === "proctored_cbt" && !proctoringAllowed;

  function validateSubscription() {
    if (proctoringRestricted) {
      setErrorMsg("Proctored CBT mode requires an active Institution Tier subscription. Please upgrade or choose Standard Quiz mode.");
    } else if (candidateExceeded) {
      setErrorMsg(`Your plan allows up to ${maxCandidatesAllowed} candidates (requested: ${effectiveCandidateCount}). Please adjust candidate count or upgrade.`);
    }
  }

  // Publish Immutable Exam
  async function handlePublishExam() {
    setLoading(true);
    setErrorMsg("");
    try {
      const effectiveMode = isCustomMode && customExamType.trim() ? customExamType.trim().toLowerCase().replace(/\s+/g, '_') : mode;
      const effectivePerQ = mode === "quick_quiz"
        ? perQuestionSeconds
        : (timingModel === "pic_only" || timingModel === "dual" ? perQuestionSeconds : (picStrictCap ? picStrictCapSeconds : perQuestionSeconds));

      const examRes = await api.createExam({
        organization_id: organizationId,
        title,
        description,
        mode: effectiveMode,
        duration_minutes: durationMinutes,
        per_question_time_seconds: effectivePerQ,
        speed_scoring: mode === "quick_quiz" ? speedScoring : false,
        timing_model: mode === "quick_quiz" ? "pic_only" : timingModel,
        question_times: questionTimes,
        question_ids: selectedQuestionIds,
        settings: {
          category,
          language,
          instructions,
          exam_type_label: isCustomMode && customExamType.trim() ? customExamType.trim() : mode,
          timing_model: mode === "quick_quiz" ? "pic_only" : timingModel,
          per_question_time_seconds: effectivePerQ,
          pic_auto_advance: picAutoAdvance,
          pic_strict_cap: picStrictCap,
          speed_scoring: mode === "quick_quiz" ? speedScoring : false,
          podium_reveal_cadence: podiumRevealCadence,
          allow_guest_nicknames: allowGuestNicknames,
          auto_advance_rounds: autoAdvanceRounds,
          navigation_policy: navigationPolicy,
          result_release_policy: resultReleasePolicy,
          allow_retries: allowRetries,
          show_instant_explanation: showInstantExplanation,
          watermark_overlay: watermarkOverlay,
          mandatory_preflight: mandatoryPreflight,
          negative_marking: negativeMarking,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
          pool_size: poolSize ? Number(poolSize) : null,
          scheduled_start_at: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
          scheduled_end_at: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : null,
          sections,
          pass_percentage: passPercentage,
          proctoring_checks: mode === "proctored_cbt" ? Object.keys(proctoringChecks).filter((k) => proctoringChecks[k]) : [],
          retention_days: retentionDays,
          classroom_course_id: enrollmentType === "classroom" ? selectedClassroomCourse : null
        }
      });

      // Publish version
      await api.publishExam(examRes.id);

      // Generate enrollments (not needed for Quick Quiz open room / QR join)
      if (!isQuickQuizMode) {
        if (enrollmentType === "classroom" && selectedClassroomCourse) {
          await api.importClassroomStudents(selectedClassroomCourse, examRes.id, classroomStudents);
          if (classroomAutoPublish) {
            try {
              await api.publishToClassroom({
                organization_id: organizationId,
                exam_id: examRes.id,
                course_id: selectedClassroomCourse,
                max_points: 100
              });
            } catch (pubErr) {
              console.warn("Classroom stream auto-publish notice:", pubErr);
            }
          }
        } else if (enrollmentType === "uid_batch") {
          await api.bulkGenerateEnrollments(examRes.id, {
            count: candidateCount,
            max_attempts: maxAttempts
          });
        } else if (enrollmentType === "csv_import" && csvCandidatesText.trim()) {
          const rows = csvCandidatesText.split("\n").slice(1);
          const parsed = rows
            .map((r) => r.split(","))
            .filter((parts) => parts.length >= 1 && parts[0].trim())
            .map((parts) => ({
              name: parts[0].trim(),
              email: parts[1]?.trim() || ""
            }));
          await api.bulkGenerateEnrollments(examRes.id, {
            candidates: parsed,
            max_attempts: maxAttempts
          });
        }

        // Download candidate credentials sheet
        try {
          await api.downloadExamCredentialsPdf(examRes.id, examRes.room_code || "ROOM");
        } catch (pdfErr) {
          console.warn("Could not auto-download credentials PDF:", pdfErr);
        }
      }

      onExamCreated(examRes);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to publish exam");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100
    }}>
      <div className="dash-card" style={{
        width: "920px",
        maxHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
      }}>
        {/* Wizard Header */}
        <div style={{
          padding: "20px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
              Exam Creation Wizard
            </h2>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {mode === "quick_quiz" ? "⚡ Quick Quiz Arena" : mode === "standard_quiz" ? "📝 Standard Quiz" : "🛡️ AI Proctored CBT"} • Step {currentStep <= 5 ? currentStep : (isProctorMode ? currentStep : currentStep - 1)} of {totalSteps}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px 8px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          background: "#f8fafc",
          overflowX: "auto"
        }}>
          {stepDefinitions.map((step) => {
            const actualNum = step.num;
            const isCompleted = actualNum < currentStep;
            const isCurrent = actualNum === currentStep;
            return (
              <div
                key={step.key}
                style={{
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: isCurrent ? "700" : "500",
                  color: isCurrent ? "var(--accent-blue)" : isCompleted ? "#059669" : "var(--text-muted)",
                  borderBottom: isCurrent ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  fontSize: "11px",
                  background: isCurrent ? "var(--accent-blue)" : isCompleted ? "#059669" : "#e2e8f0",
                  color: (isCurrent || isCompleted) ? "#ffffff" : "#64748b"
                }}>
                  {actualNum}
                </span>
                {step.label}
              </div>
            );
          })}
        </div>

        {/* Wizard Scrollable Body */}
        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
          {errorMsg && (
            <div style={{
              padding: "12px 16px",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "8px",
              color: "#be123c",
              fontSize: "13px",
              marginBottom: "16px",
              fontWeight: "600"
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* STEP 1: Basic Details */}
          {currentStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Exam Title *
                </label>
                <input
                  type="text"
                  className="lunaris-input"
                  placeholder="e.g. Data Structures Midterm Quiz 2026, JEE Full CBT Mock #4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Description / Syllabus
                </label>
                <textarea
                  className="lunaris-input"
                  rows={2}
                  placeholder="Short summary of chapters, topics, or eligibility requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Category
                  </label>
                  <select
                    className="lunaris-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Higher Education">University & College Coursework</option>
                    <option value="Professional Certification">Professional & Technical Certification</option>
                    <option value="Foundation & Olympiad">Foundation & Olympiad</option>
                    <option value="Campus Recruitment">Campus Recruitment</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Primary Language
                  </label>
                  <select
                    className="lunaris-input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Bilingual">Bilingual</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Candidate Instructions
                </label>
                <textarea
                  className="lunaris-input"
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Exam Mode */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
                Select how candidates will experience and submit this assessment:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {/* Standard Quiz */}
                <div
                  onClick={() => handleSelectMode("standard_quiz")}
                  style={{
                    padding: "18px",
                    borderRadius: "10px",
                    border: (!isCustomMode && mode === "standard_quiz") ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: (!isCustomMode && mode === "standard_quiz") ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Standard Quiz</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Self-paced homework or practice quiz with customizable PIC timers, instant scorecards, and solution reviews.
                  </p>
                </div>

                {/* Quick Quiz Arena */}
                <div
                  onClick={() => handleSelectMode("quick_quiz")}
                  style={{
                    padding: "18px",
                    borderRadius: "10px",
                    border: (!isCustomMode && mode === "quick_quiz") ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: (!isCustomMode && mode === "quick_quiz") ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#fef3c7",
                    color: "#d97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Quick Quiz Arena</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Multiplayer speed challenge with room codes, rapid per-question countdowns, and real-time bonus podium reveals.
                  </p>
                </div>

                {/* AI Proctored CBT */}
                <div
                  onClick={() => handleSelectMode("proctored_cbt")}
                  style={{
                    padding: "18px",
                    borderRadius: "10px",
                    border: (!isCustomMode && mode === "proctored_cbt") ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: (!isCustomMode && mode === "proctored_cbt") ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>AI Proctored CBT</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    High-stakes examination with on-device MediaPipe webcam presence, strict tab lockdown, and anti-cheating watermark.
                  </p>
                </div>

                {/* Custom Exam Type */}
                <div
                  onClick={() => {
                    setMode("custom");
                    setIsCustomMode(true);
                  }}
                  style={{
                    padding: "18px",
                    borderRadius: "10px",
                    border: isCustomMode ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: isCustomMode ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#f3e8ff",
                    color: "#9333ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Custom Format</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Define any custom assessment format (Midterms, Certifications, Bar Mocks, Coding Screens).
                  </p>
                </div>
              </div>

              {isCustomMode && (
                <div style={{ marginTop: "16px", padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Enter Custom Examination Format / Type Name *
                  </label>
                  <input
                    type="text"
                    className="lunaris-input"
                    placeholder="e.g. Semester Midterm, Corporate Tech Screening, Law Bar Mock"
                    value={customExamType}
                    onChange={(e) => setCustomExamType(e.target.value)}
                    style={{ maxWidth: "460px", background: "#ffffff" }}
                    autoFocus
                  />
                </div>
              )}

              {mode === "proctored_cbt" && proctoringRestricted && (
                <div style={{
                  marginTop: "16px",
                  padding: "14px 18px",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#9f1239" }}>
                      Proctored CBT Mode Requires Institution Tier (₹1,999/mo)
                    </div>
                    <div style={{ fontSize: "12px", color: "#be123c", marginTop: "2px" }}>
                      Your current plan does not include on-device webcam & tab-lockdown telemetry.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToBilling) onNavigateToBilling();
                      else if (onClose) onClose();
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#e11d48",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "800",
                      cursor: "pointer"
                    }}
                  >
                    Pay ₹1,999 via UPI to Enable →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Questions & PIC Time Allocation */}
          {currentStep === 3 && (
            <div>
              {/* PIC (Per-Item Clock) Global Configuration Card - ONLY in Standard Quiz mode */}
              {isStandardQuizMode && (
              <div style={{
                padding: "16px 20px",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: "10px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Default Per-Item Clock (PIC) per Question
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Sets how much time is given for questions in this exam. You can also customize time for individual questions below.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {[15, 20, 30, 45, 60, 90, 120].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setPerQuestionSeconds(sec);
                          setDefaultPerQuestionSeconds(sec);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: perQuestionSeconds === sec ? "700" : "500",
                          background: perQuestionSeconds === sec ? "var(--accent-blue)" : "#ffffff",
                          color: perQuestionSeconds === sec ? "#ffffff" : "var(--text-primary)",
                          border: `1px solid ${perQuestionSeconds === sec ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                          cursor: "pointer"
                        }}
                      >
                        {sec}s
                      </button>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#ffffff", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      <input
                        type="number"
                        min={5}
                        max={600}
                        value={perQuestionSeconds}
                        onChange={(e) => {
                          const val = Math.max(5, Number(e.target.value));
                          setPerQuestionSeconds(val);
                          setDefaultPerQuestionSeconds(val);
                        }}
                        style={{
                          width: "55px",
                          border: "none",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontSize: "13px"
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>sec</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Question Selection Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700" }}>
                    Select Questions ({selectedQuestionIds.length} Selected)
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {isStandardQuizMode
                      ? "Configure per-question time limits (PIC) for individual questions where needed."
                      : "Select the questions to include in this assessment."}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedQuestionIds(availableQuestions.map((q) => q.id))}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedQuestionIds([])}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "330px", overflowY: "auto" }}>
                {availableQuestions.map((q, idx) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  let parsedContent = q.content || {};
                  if (!q.content && q.content_json) {
                    try {
                      parsedContent = JSON.parse(q.content_json);
                    } catch (e) {}
                  }

                  const itemTime = questionTimes[q.id] || perQuestionSeconds;
                  const isEditingThis = editingQuestionId === q.id;

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: isChecked ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                        background: isChecked ? "var(--accent-blue-subtle)" : "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleQuestion(q.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <div
                        onClick={() => handleToggleQuestion(q.id)}
                        style={{ flex: 1, cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#e2e8f0",
                            color: "#334155"
                          }}>
                            {q.subject}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Q{idx + 1} • {q.question_type}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "500" }}>
                          {parsedContent.text || parsedContent.prompt || "Question content"}
                        </div>
                        {Array.isArray(parsedContent.options) && parsedContent.options.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                            {parsedContent.options.map((opt, oIdx) => {
                              const isCorr = opt.id === parsedContent.correct_option_id;
                              return (
                                <span
                                  key={opt.id || oIdx}
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    background: isCorr ? "#ecfdf5" : "#f1f5f9",
                                    color: isCorr ? "#059669" : "#475569",
                                    fontWeight: isCorr ? "700" : "500",
                                    border: `1px solid ${isCorr ? "#a7f3d0" : "#e2e8f0"}`
                                  }}
                                >
                                  {String.fromCharCode(65 + oIdx)}. {opt.text}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {q.question_type === "numerical" && parsedContent.numerical_answer !== undefined && (
                          <div style={{ fontSize: "11px", color: "#059669", fontWeight: "600", marginTop: "4px" }}>
                            Answer: {parsedContent.numerical_answer} (±{parsedContent.tolerance || 0.01})
                          </div>
                        )}
                      </div>

                      {/* Per-Question Time Allocation (PIC) Widget - ONLY in Standard Quiz mode */}
                      {isStandardQuizMode && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {isEditingThis ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#ffffff", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--accent-blue)" }}>
                            <input
                              type="number"
                              min={5}
                              max={600}
                              value={itemTime}
                              onChange={(e) => handleSetCustomQuestionTime(q.id, e.target.value)}
                              style={{ width: "50px", border: "none", fontSize: "12px", textAlign: "center", fontWeight: "bold" }}
                              autoFocus
                            />
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>s</span>
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(null)}
                              style={{ border: "none", background: "none", cursor: "pointer", fontSize: "11px", color: "#16a34a", fontWeight: "bold" }}
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingQuestionId(q.id)}
                            title="Click to set custom PIC seconds for this question"
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background: questionTimes[q.id] ? "#e0f2fe" : "#f1f5f9",
                              color: questionTimes[q.id] ? "#0369a1" : "#475569",
                              border: `1px solid ${questionTimes[q.id] ? "#7dd3fc" : "#cbd5e1"}`,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            ⏱️ {itemTime}s
                            <span style={{ fontSize: "10px", opacity: 0.7 }}>✎</span>
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: MODE-SPECIFIC CONFIGURATION MENUS */}
          {currentStep === 4 && (
            <div>
              {/* MENU 1: QUICK QUIZ ARENA MENU */}
              {mode === "quick_quiz" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{
                    padding: "16px 20px",
                    background: "#fef3c7",
                    borderRadius: "10px",
                    border: "1px solid #fde68a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px"
                  }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "800", color: "#92400e" }}>
                        ⚡ Quick Quiz Live Arena Menu
                      </div>
                      <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                        Multiplayer live arena with room codes, speed clocks, and real-time bonus podium reveals.
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", background: "#fef9c3", color: "#854d0e", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                      LIVE MULTIPLAYER
                    </span>
                  </div>

                  {/* Arena PIC Speed Clock */}
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>
                      ⏱️ Arena Per-Question Speed Countdown (PIC)
                    </label>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                      All players synchronously race against this per-question countdown. Answers lock when time expires.
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      {[10, 15, 20, 30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setPerQuestionSeconds(sec)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: perQuestionSeconds === sec ? "700" : "500",
                            background: perQuestionSeconds === sec ? "#d97706" : "#ffffff",
                            color: perQuestionSeconds === sec ? "#ffffff" : "#92400e",
                            border: `1.5px solid ${perQuestionSeconds === sec ? "#d97706" : "#fde68a"}`,
                            cursor: "pointer"
                          }}
                        >
                          {sec}s {sec <= 15 ? "(Blitz)" : sec <= 30 ? "(Standard)" : "(Deep)"}
                        </button>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#ffffff", padding: "6px 10px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                        <input
                          type="number"
                          min={5}
                          max={120}
                          value={perQuestionSeconds}
                          onChange={(e) => setPerQuestionSeconds(Math.max(5, Number(e.target.value)))}
                          style={{ width: "50px", border: "none", fontSize: "13px", fontWeight: "bold", textAlign: "center" }}
                        />
                        <span style={{ fontSize: "12px", color: "#92400e", fontWeight: "600" }}>sec</span>
                      </div>
                    </div>
                  </div>

                  {/* Speed Scoring & Room Code Settings */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={speedScoring}
                          onChange={(e) => setSpeedScoring(e.target.checked)}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                            Speed-Bonus Scoring System
                          </strong>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                            Award up to 1,000 points per round based on how fast candidates submit the correct answer.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={allowGuestNicknames}
                          onChange={(e) => setAllowGuestNicknames(e.target.checked)}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                            Allow Guest Nicknames
                          </strong>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                            Students can join with just their nickname using the room code (no login credentials required).
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Live Podium & Reveal Cadence */}
                  <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                      Podium & Leaderboard Reveal Cadence
                    </label>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="podium"
                          checked={podiumRevealCadence === "after_round"}
                          onChange={() => setPodiumRevealCadence("after_round")}
                        />
                        <span>Reveal leaderboard after every question (Live suspense)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="podium"
                          checked={podiumRevealCadence === "final_only"}
                          onChange={() => setPodiumRevealCadence("final_only")}
                        />
                        <span>Final podium reveal only</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* MENU 2: STANDARD QUIZ CONFIGURATION MENU */}
              {mode === "standard_quiz" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{
                    padding: "16px 20px",
                    background: "#eff6ff",
                    borderRadius: "10px",
                    border: "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px"
                  }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "800", color: "#1e40af" }}>
                        📝 Standard Quiz Configuration Menu
                      </div>
                      <div style={{ fontSize: "12px", color: "#2563eb", marginTop: "2px" }}>
                        Configure timing architectures, PIC countdown rules, navigation models, and scorecard release.
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", background: "#dbeafe", color: "#1e3a8a", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                      SELF-PACED & CLASSROOM
                    </span>
                  </div>

                  {/* Timing Model Architecture Selection */}
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                      ⏱️ Timing & PIC Architecture
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                      <div
                        onClick={() => setTimingModel("total_duration")}
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          border: timingModel === "total_duration" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                          background: timingModel === "total_duration" ? "#ffffff" : "#f1f5f9",
                          cursor: "pointer"
                        }}
                      >
                        <strong style={{ fontSize: "12px", display: "block", color: "var(--text-primary)" }}>Total Duration Only</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                          Traditional timer for the whole quiz (e.g. 45 min).
                        </span>
                      </div>

                      <div
                        onClick={() => setTimingModel("pic_only")}
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          border: timingModel === "pic_only" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                          background: timingModel === "pic_only" ? "#ffffff" : "#f1f5f9",
                          cursor: "pointer"
                        }}
                      >
                        <strong style={{ fontSize: "12px", display: "block", color: "var(--text-primary)" }}>Strict PIC Only</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                          Per-question clock only. Auto-advances when time expires.
                        </span>
                      </div>

                      <div
                        onClick={() => setTimingModel("dual")}
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          border: timingModel === "dual" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                          background: timingModel === "dual" ? "#ffffff" : "#f1f5f9",
                          cursor: "pointer"
                        }}
                      >
                        <strong style={{ fontSize: "12px", display: "block", color: "var(--text-primary)" }}>Dual Clock (Total + PIC)</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                          Total time cap plus per-question limit to keep pace.
                        </span>
                      </div>
                    </div>

                    {/* Inputs depending on model */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      {(timingModel === "total_duration" || timingModel === "dual") && (
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                            Total Quiz Duration (Minutes)
                          </label>
                          <input
                            type="number"
                            className="lunaris-input"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(Number(e.target.value))}
                            min={5}
                            max={360}
                          />
                        </div>
                      )}

                      {(timingModel === "pic_only" || timingModel === "dual") && (
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                            Per-Item Clock (PIC) Seconds per Question
                          </label>
                          <input
                            type="number"
                            className="lunaris-input"
                            value={perQuestionSeconds}
                            onChange={(e) => setPerQuestionSeconds(Number(e.target.value))}
                            min={10}
                            max={600}
                          />
                        </div>
                      )}
                    </div>

                    {(timingModel === "pic_only" || timingModel === "dual") && (
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginTop: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={picAutoAdvance}
                          onChange={(e) => setPicAutoAdvance(e.target.checked)}
                        />
                        <span>Auto-advance to next question immediately when per-item clock expires</span>
                      </label>
                    )}
                  </div>

                  {/* Navigation & Scorecard Release Policies */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                        Question Navigation Policy
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginBottom: "8px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="navPolicy"
                          checked={navigationPolicy === "free"}
                          onChange={() => setNavigationPolicy("free")}
                        />
                        <span>Free Navigation (jump, flag & review)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="navPolicy"
                          checked={navigationPolicy === "forward_only"}
                          onChange={() => setNavigationPolicy("forward_only")}
                        />
                        <span>Strict Forward-Only (cannot go back)</span>
                      </label>
                    </div>

                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                        Scorecard & Solution Release
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginBottom: "8px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="releasePolicy"
                          checked={resultReleasePolicy === "instant"}
                          onChange={() => setResultReleasePolicy("instant")}
                        />
                        <span>Instant Scorecard & Solutions</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="releasePolicy"
                          checked={resultReleasePolicy === "manual"}
                          onChange={() => setResultReleasePolicy("manual")}
                        />
                        <span>Withhold results until educator approval</span>
                      </label>
                    </div>
                  </div>

                  {/* Grading & Shuffling */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                        Pass Criteria (% Marks)
                      </label>
                      <input
                        type="number"
                        className="lunaris-input"
                        value={passPercentage}
                        onChange={(e) => setPassPercentage(Number(e.target.value))}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={negativeMarking}
                          onChange={(e) => setNegativeMarking(e.target.checked)}
                        />
                        <span>Negative Marking (+4 / -1)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shuffleQuestions}
                          onChange={(e) => setShuffleQuestions(e.target.checked)}
                        />
                        <span>Shuffle question and option sequence</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* MENU 3: AI PROCTORED CBT CONFIGURATION MENU */}
              {(mode === "proctored_cbt" || mode === "custom") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{
                    padding: "16px 20px",
                    background: "#f0fdf4",
                    borderRadius: "10px",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px"
                  }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "800", color: "#166534" }}>
                        🛡️ AI Proctored CBT Configuration Menu
                      </div>
                      <div style={{ fontSize: "12px", color: "#15803d", marginTop: "2px" }}>
                        Configure enterprise exam lockdown, PIC question caps, MediaPipe telemetry, and security watermarks.
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", background: "#dcfce7", color: "#14532d", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                      ENTERPRISE SECURE CBT
                    </span>
                  </div>

                  {/* Total Duration & PIC Anti-Collusion Question Cap */}
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "14px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                          Total Examination Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          className="lunaris-input"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          min={10}
                          max={360}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                          Passing Threshold (% Marks)
                        </label>
                        <input
                          type="number"
                          className="lunaris-input"
                          value={passPercentage}
                          onChange={(e) => setPassPercentage(Number(e.target.value))}
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>

                    {/* PIC Strict Question Cap */}
                    <div style={{ padding: "12px 14px", background: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={picStrictCap}
                          onChange={(e) => setPicStrictCap(e.target.checked)}
                          style={{ marginTop: "3px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                            Enable PIC Question Cap (Anti-Collusion Timer)
                          </strong>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                            Limits the maximum time a candidate may spend on any single question to prevent camera leaks or external assistance.
                          </span>
                          {picStrictCap && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                              <span style={{ fontSize: "12px", fontWeight: "600" }}>Max seconds allowed per question:</span>
                              <input
                                type="number"
                                min={30}
                                max={600}
                                value={picStrictCapSeconds}
                                onChange={(e) => setPicStrictCapSeconds(Number(e.target.value))}
                                style={{ width: "70px", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Anti-Cheating Watermark & Preflight Protocols */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={watermarkOverlay}
                          onChange={(e) => setWatermarkOverlay(e.target.checked)}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                            Dynamic Candidate Screen Watermark
                          </strong>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                            Renders candidate UID and IP dynamically across the screen to deter camera screen capture.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div style={{ padding: "16px", background: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={mandatoryPreflight}
                          onChange={(e) => setMandatoryPreflight(e.target.checked)}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                            Mandatory Hardware Preflight Check
                          </strong>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                            Candidate must verify webcam, microphone, and fullscreen permissions before question paper opens.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Negative Marking & Sections */}
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={negativeMarking}
                        onChange={(e) => setNegativeMarking(e.target.checked)}
                      />
                      <span>Strict Negative Marking (+4 Correct / -1 Incorrect)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                      />
                      <span>Shuffle Question Order</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                      />
                      <span>Shuffle Option Order (Per-Candidate Variant)</span>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "6px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                          Question Pool Size (Optional)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={poolSize}
                          onChange={(e) => setPoolSize(e.target.value)}
                          placeholder="All selected"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                          Scheduled Start (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledStartAt}
                          onChange={(e) => setScheduledStartAt(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                          Scheduled End (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledEndAt}
                          onChange={(e) => setScheduledEndAt(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Enrollment */}
          {currentStep === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setEnrollmentType("classroom")}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: enrollmentType === "classroom" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                    color: enrollmentType === "classroom" ? "var(--accent-blue)" : "var(--text-secondary)",
                    border: enrollmentType === "classroom" ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  Google Classroom (Import Students & Sync)
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollmentType("uid_batch")}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: enrollmentType === "uid_batch" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                    color: enrollmentType === "uid_batch" ? "var(--accent-blue)" : "var(--text-secondary)",
                    border: enrollmentType === "uid_batch" ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  Auto-Generate Batch UIDs & PINs
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollmentType("csv_import")}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: enrollmentType === "csv_import" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                    color: enrollmentType === "csv_import" ? "var(--accent-blue)" : "var(--text-secondary)",
                    border: enrollmentType === "csv_import" ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    cursor: "pointer"
                  }}
                >
                  CSV Candidate Import
                </button>
              </div>

              {enrollmentType === "classroom" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {classroomConnected ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                        <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                          Select Google Classroom Course
                        </label>
                      </div>

                      {classroomCourses.length > 0 ? (
                        <select
                          className="lunaris-input"
                          value={selectedClassroomCourse}
                          onChange={(e) => handleCourseChangeInWizard(e.target.value)}
                          style={{ maxWidth: "420px", marginBottom: "12px" }}
                        >
                          {classroomCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.section ? `(${c.section})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                          No active courses found on this Google Classroom account.
                        </div>
                      )}

                      {/* Students List Display */}
                      <div style={{
                        padding: "12px 16px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: "12px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)" }}>
                            Classroom Student Roster ({classroomStudents.length} Students)
                          </span>
                          <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>
                            Will be auto-enrolled with login UIDs & PINs
                          </span>
                        </div>

                        {classroomLoading ? (
                          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                            Loading students from Google Classroom...
                          </div>
                        ) : classroomStudents.length > 0 ? (
                          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {classroomStudents.map((st) => (
                              <div key={st.userId} style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "12px",
                                padding: "6px 10px",
                                background: "#ffffff",
                                borderRadius: "6px",
                                border: "1px solid var(--border-subtle)"
                              }}>
                                <strong style={{ color: "var(--text-primary)" }}>{st.name}</strong>
                                <span style={{ color: "var(--text-muted)" }}>{st.email}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                            No enrolled students found in this course.
                          </div>
                        )}
                      </div>

                      {/* Auto-publish checkbox */}
                      <div style={{
                        padding: "14px 18px",
                        background: "#f0fdf4",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0"
                      }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={classroomAutoPublish}
                            onChange={(e) => setClassroomAutoPublish(e.target.checked)}
                            style={{ marginTop: "3px" }}
                          />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#166534" }}>
                              Automatically publish Quiz & Candidate Credentials PDF to Google Classroom stream
                            </div>
                            <div style={{ fontSize: "12px", color: "#15803d", marginTop: "2px" }}>
                              Creates an official assignment in Google Classroom with candidate credentials roster attached.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: "24px 20px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px dashed #cbd5e1",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                        Connect Google Classroom
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px", lineHeight: "1.5" }}>
                        Connect your Google account to automatically import students into this exam.
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectGoogleClassroomInWizard}
                        disabled={classroomLoading}
                        style={{
                          padding: "9px 18px",
                          background: "#2563eb",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        {classroomLoading ? "Connecting..." : "Connect Google Classroom"}
                      </button>
                    </div>
                  )}
                </div>
              ) : enrollmentType === "uid_batch" ? (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Number of Candidate UIDs to Generate
                  </label>
                  <input
                    type="number"
                    className="lunaris-input"
                    value={candidateCount}
                    onChange={(e) => setCandidateCount(Number(e.target.value))}
                    min={1}
                    max={5000}
                    style={{ maxWidth: "200px" }}
                  />
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                    Each candidate will receive a unique UID (e.g. LUN-491029) and a PIN.
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Paste CSV Data (Name, Email)
                  </label>
                  <textarea
                    className="lunaris-input"
                    rows={4}
                    value={csvCandidatesText}
                    onChange={(e) => setCsvCandidatesText(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Max Allowed Attempts per Candidate
                </label>
                <input
                  type="number"
                  className="lunaris-input"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  min={1}
                  max={5}
                  style={{ maxWidth: "120px" }}
                />
              </div>
            </div>
          )}

          {/* STEP 6: Proctoring Permitted Checks (ONLY for Proctored CBT) */}
          {currentStep === 6 && isProctorMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Configure permitted on-device computer vision and browser integrity checks:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { key: "face_not_detected", label: "Face Absent Detection (MediaPipe)", desc: "Flags if face is absent from frame for 6+ seconds" },
                  { key: "multiple_faces", label: "Multiple Faces Detection", desc: "Flags multiple faces in camera field of view" },
                  { key: "head_turned", label: "Head Direction & Motion", desc: "Advisory signal for prolonged sideways orientation" },
                  { key: "tab_switch", label: "Tab Switching & Focus Loss", desc: "Logs window blur and visibility state changes" },
                  { key: "fullscreen_exit", label: "Fullscreen Exit Tracking", desc: "Monitors fullscreen browser lockdown state" },
                  { key: "mobile_hints", label: "Mobile Device Signals", desc: "User-agent and viewport orientation risk signaling" }
                ].map((item) => (
                  <div
                    key={item.key}
                    onClick={() => handleToggleCheck(item.key)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: proctoringChecks[item.key] ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                      background: proctoringChecks[item.key] ? "var(--accent-blue-subtle)" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={proctoringChecks[item.key]}
                      onChange={() => {}}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <strong style={{ fontSize: "13px", display: "block" }}>{item.label}</strong>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Evidence Snapshot Retention (Days)
                </label>
                <input
                  type="number"
                  className="lunaris-input"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  min={1}
                  max={90}
                  style={{ maxWidth: "120px" }}
                />
              </div>
            </div>
          )}

          {/* STEP 7: Subscription Entitlement Validation */}
          {currentStep === 7 && (
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "12px" }}>
                Subscription Entitlement Validation
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Verifying your organization&#39;s subscription entitlements and remaining quotas:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div style={{
                  padding: "16px",
                  background: candidateExceeded ? "var(--accent-rose-subtle)" : "var(--accent-emerald-subtle)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Candidate Quota</span>
                  <strong style={{ fontSize: "16px", color: candidateExceeded ? "#dc2626" : "#059669" }}>
                    {effectiveCandidateCount} requested / {maxCandidatesAllowed} allowed
                  </strong>
                  {candidateExceeded && (
                    <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                      Limit exceeded for {orgPlan.toUpperCase()} plan.
                    </div>
                  )}
                </div>

                <div style={{
                  padding: "16px",
                  background: proctoringRestricted ? "var(--accent-rose-subtle)" : "var(--accent-emerald-subtle)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Proctoring Feature</span>
                  <strong style={{ fontSize: "16px", color: proctoringRestricted ? "#dc2626" : "#059669" }}>
                    {!isProctorMode ? "Not Required for Quiz Mode" : proctoringAllowed ? "Entitlement Verified" : "Restricted on Free Tier"}
                  </strong>
                  {proctoringRestricted && (
                    <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px" }}>
                      Upgrade to Institution tier to enable proctored CBT.
                    </div>
                  )}
                </div>
              </div>

              {(candidateExceeded || proctoringRestricted) ? (
                <div style={{
                  padding: "16px",
                  background: "var(--bg-secondary)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-strong)",
                  textAlign: "center"
                }}>
                  <div style={{ fontWeight: "700", marginBottom: "6px" }}>Upgrade Path Required</div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                    Upgrade to Creator Pro (250 candidates) or Institution (5,000 candidates + full proctoring).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToBilling) onNavigateToBilling();
                      else if (onClose) onClose();
                    }}
                    style={{
                      fontSize: "13px",
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "800",
                      cursor: "pointer"
                    }}
                  >
                    Open UPI Checkout & Upgrade Plan →
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: "14px",
                  background: "var(--accent-emerald-subtle)",
                  color: "var(--accent-emerald)",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  ✓ All plan entitlements verified. You have sufficient quota to publish this exam.
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Preview & Publish */}
          {currentStep === 8 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                padding: "20px",
                background: "var(--bg-secondary)",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "8px" }}>{title}</h3>
                <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px", flexWrap: "wrap" }}>
                  <span>Mode: <strong>{mode.toUpperCase()}</strong></span>
                  <span>•</span>
                  <span>Duration: <strong>{mode === "quick_quiz" ? `~${Math.ceil((selectedQuestionIds.length * perQuestionSeconds + 30) / 60)} Min` : `${durationMinutes} Min`}</strong></span>
                  <span>•</span>
                  <span>PIC Time: <strong>{perQuestionSeconds}s per question</strong></span>
                  <span>•</span>
                  <span>Questions: <strong>{selectedQuestionIds.length}</strong></span>
                  <span>•</span>
                  <span>Candidates: <strong>
                    {isQuickQuizMode
                      ? "Open Room Code & QR Join (No pre-enrollment needed)"
                      : enrollmentType === "classroom"
                      ? `${classroomStudents.length} Students (Google Classroom)`
                      : enrollmentType === "uid_batch"
                      ? `${candidateCount} Auto-Generated UIDs`
                      : "CSV Import"}
                  </strong></span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Instructions: {instructions}
                </div>
              </div>

              <div style={{
                padding: "14px",
                background: "var(--accent-blue-subtle)",
                borderRadius: "8px",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                fontSize: "12px",
                color: "var(--accent-blue)",
                lineHeight: "1.5"
              }}>
                Publishing creates an immutable exam snapshot version. Candidate enrollment credentials (UIDs & PINs) will be generated automatically.
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div style={{
          padding: "16px 28px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#ffffff",
          borderRadius: "0 0 16px 16px"
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{ fontSize: "13px" }}
          >
            ← Previous
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            {currentStep < 8 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={nextStep}
                style={{ fontSize: "13px", padding: "8px 20px" }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handlePublishExam}
                disabled={loading || candidateExceeded || proctoringRestricted}
                style={{ fontSize: "13px", padding: "8px 24px", background: "#16a34a" }}
              >
                {loading ? "Publishing Exam..." : "Publish Immutable Exam Version ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
