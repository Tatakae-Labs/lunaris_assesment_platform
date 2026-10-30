import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

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
  const [category, setCategory] = useState("Engineering Entrance");
  const [language, setLanguage] = useState("English");
  const [instructions, setInstructions] = useState("1. Read all questions carefully.\n2. Ensure your webcam and network connection remain steady throughout.\n3. Do not switch tabs or exit fullscreen mode during proctored examinations.");

  // Step 2: Exam Mode
  const [mode, setMode] = useState("proctored_cbt"); // 'standard_quiz', 'quick_quiz', 'proctored_cbt'

  // Step 3: Questions
  const [questionSource, setQuestionSource] = useState("question_bank"); // 'manual', 'question_bank', 'ai_generate', 'pdf_import'
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [pdfFileName, setPdfFileName] = useState("");

  // Step 4: Rules & Sections
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [negativeMarking, setNegativeMarking] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [sections, setSections] = useState([]);
  const [passPercentage, setPassPercentage] = useState(40);

  // Step 5: Enrollment
  const [enrollmentType, setEnrollmentType] = useState("uid_batch"); // 'uid_batch', 'csv_import'
  const [candidateCount, setCandidateCount] = useState(25);
  const [csvCandidatesText, setCsvCandidatesText] = useState("Name,Email\nAarav Sharma,aarav@student.org\nRohan Verma,rohan@student.org");
  const [maxAttempts, setMaxAttempts] = useState(1);

  // Step 6: Proctoring Permitted Checks
  const [proctoringChecks, setProctoringChecks] = useState({
    face_not_detected: true,
    multiple_faces: true,
    head_turned: true,
    tab_switch: true,
    fullscreen_exit: true,
    mobile_hints: true
  });
  const [retentionDays, setRetentionDays] = useState(30);

  // Load available questions, curriculum subjects, and subscription entitlements
  useEffect(() => {
    async function loadInitial() {
      try {
        const [qList, ent, subjs] = await Promise.all([
          api.getQuestions(organizationId),
          api.getOrgEntitlements(organizationId),
          api.getOrgSubjects(organizationId).catch(() => [])
        ]);
        setAvailableQuestions(qList || []);
        // Select all available questions by default for ease of creation
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
    }
    loadInitial();
  }, [organizationId]);

  function handleToggleQuestion(id) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleToggleCheck(key) {
    setProctoringChecks((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  // Validate step progression
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
    if (currentStep === 6) {
      // Step 7 is subscription validation check!
      validateSubscription();
    }
    setCurrentStep((prev) => Math.min(8, prev + 1));
  }

  function prevStep() {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  // Step 7: Entitlement Validation Check
  const orgPlan = entitlements?.plan_id || "free";
  const proctoringAllowed = entitlements?.entitlements?.proctoring_enabled ?? false;
  const maxCandidatesAllowed = entitlements?.entitlements?.max_candidates ?? 25;
  const candidateExceeded = candidateCount > maxCandidatesAllowed;
  const proctoringRestricted = mode === "proctored_cbt" && !proctoringAllowed;

  function validateSubscription() {
    if (proctoringRestricted) {
      setErrorMsg("Proctored CBT mode is only available on the Institution tier. Please upgrade or choose Standard Quiz mode.");
    } else if (candidateExceeded) {
      setErrorMsg(`Your plan allows up to ${maxCandidatesAllowed} candidates. Please reduce candidate count or upgrade to Creator Pro / Institution.`);
    }
  }

  // Step 8: Final Publish
  async function handlePublishExam() {
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Create Exam
      const examRes = await api.createExam({
        organization_id: organizationId,
        title,
        description,
        mode,
        duration_minutes: durationMinutes,
        question_ids: selectedQuestionIds,
        settings: {
          category,
          language,
          instructions,
          negative_marking: negativeMarking,
          shuffle_questions: shuffleQuestions,
          sections,
          pass_percentage: passPercentage,
          proctoring_checks: Object.keys(proctoringChecks).filter((k) => proctoringChecks[k]),
          retention_days: retentionDays
        }
      });

      // 2. Publish immutable version
      await api.publishExam(examRes.id);

      // 3. Generate candidate enrollments
      if (enrollmentType === "uid_batch") {
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

      onExamCreated(examRes);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to publish exam");
    } finally {
      setLoading(false);
    }
  }

  const stepsList = [
    "Basic Details",
    "Exam Mode",
    "Questions",
    "Rules & Marking",
    "Enrollment",
    "Proctoring",
    "Entitlement Check",
    "Preview & Publish"
  ];

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
        width: "900px",
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
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Step {currentStep} of 8 • {stepsList[currentStep - 1]}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              fontSize: "18px",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          overflowX: "auto"
        }}>
          {stepsList.map((stepName, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <div
                key={stepName}
                style={{
                  padding: "10px 14px",
                  fontSize: "11px",
                  fontWeight: isCurrent ? "700" : "500",
                  color: isCurrent ? "var(--accent-blue)" : isCompleted ? "#059669" : "var(--text-muted)",
                  borderBottom: isCurrent ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>{isCompleted ? "✓" : `${stepNum}.`}</span>
                <span>{stepName}</span>
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div style={{
            margin: "16px 28px 0",
            padding: "10px 14px",
            background: "var(--accent-rose-subtle)",
            color: "var(--accent-rose)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600"
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Wizard Body Content */}
        <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. JEE Main 2026 Grand Mock Test (Paper 1)"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                  Description & Objective
                </label>
                <textarea
                  className="lunaris-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive entrance test covering standard NTA syllabus..."
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
                    <option value="Engineering Entrance">Engineering Entrance (JEE / BITSAT)</option>
                    <option value="Medical Entrance">Medical Entrance (NEET)</option>
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

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <div
                  onClick={() => setMode("standard_quiz")}
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: mode === "standard_quiz" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: mode === "standard_quiz" ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>📋</div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Standard Quiz</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Self-paced tests with instant scorecards. No strict webcam requirements.
                  </p>
                </div>

                <div
                  onClick={() => setMode("quick_quiz")}
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: mode === "quick_quiz" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: mode === "quick_quiz" ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚡</div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Quick Quiz Arena</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Live Kahoot-style classroom buzzer quiz with room codes and speed scoring.
                  </p>
                </div>

                <div
                  onClick={() => setMode("proctored_cbt")}
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: mode === "proctored_cbt" ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                    background: mode === "proctored_cbt" ? "var(--accent-blue-subtle)" : "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏛️</div>
                  <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Proctored JEE CBT</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Official NTA-standard 3-section exam with MediaPipe face & behavior telemetry.
                  </p>
                </div>
              </div>

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
                      🔒 Proctored CBT Mode Requires Institution Tier (₹1,999/mo)
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
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(225, 29, 72, 0.3)"
                    }}
                  >
                    ⚡ Pay ₹1,999 via UPI to Enable →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Questions */}
          {currentStep === 3 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Select Questions ({selectedQuestionIds.length} Selected)</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Choose from Question Bank, generate AI drafts, or import document.
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

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
                {availableQuestions.map((q) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  let parsedContent = {};
                  try {
                    parsedContent = JSON.parse(q.content_json);
                  } catch (e) {}

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleQuestion(q.id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: isChecked ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                        background: isChecked ? "var(--accent-blue-subtle)" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: "4px" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)"
                          }}>
                            {q.subject}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Type: {q.question_type}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                          {parsedContent.text || "Question content"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Rules & Sections */}
          {currentStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Duration (Minutes)
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
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                  />
                  <span>Enable Negative Marking (+4 for correct, -1 for incorrect)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />
                  <span>Shuffle question and option sequence for each candidate</span>
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                  Curriculum Subject Sections ({sections.length})
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {sections.map((sec, i) => (
                    <span
                      key={sec + i}
                      style={{
                        padding: "5px 12px",
                        background: "var(--accent-blue-subtle)",
                        color: "var(--accent-blue)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {sec}
                      <button
                        type="button"
                        onClick={() => setSections(sections.filter((_, idx) => idx !== i))}
                        style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", padding: 0, fontWeight: "bold" }}
                      >×</button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Enter section name (e.g. Data Structures, Constitutional Law, Pathology):");
                      if (name && name.trim()) setSections([...sections, name.trim()]);
                    }}
                    style={{
                      padding: "5px 12px",
                      background: "none",
                      border: "1px dashed var(--border-subtle)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      color: "var(--text-muted)"
                    }}
                  >
                    + Add Section
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Enrollment */}
          {currentStep === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEnrollmentType("uid_batch")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: enrollmentType === "uid_batch" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                    color: enrollmentType === "uid_batch" ? "var(--accent-blue)" : "var(--text-secondary)",
                    border: enrollmentType === "uid_batch" ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)"
                  }}
                >
                  ⚡ Auto-Generate Batch UIDs & PINs
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollmentType("csv_import")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: enrollmentType === "csv_import" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                    color: enrollmentType === "csv_import" ? "var(--accent-blue)" : "var(--text-secondary)",
                    border: enrollmentType === "csv_import" ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)"
                  }}
                >
                  📄 CSV Candidate Import
                </button>
              </div>

              {enrollmentType === "uid_batch" ? (
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
                    Each candidate will receive a unique UID (e.g. LUN-491029) and a 4-digit PIN. No permanent account needed!
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

          {/* STEP 6: Proctoring Permitted Checks */}
          {currentStep === 6 && (
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
                Verifying your organization's subscription entitlements and remaining quotas:
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
                    {candidateCount} requested / {maxCandidatesAllowed} allowed
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
                    {proctoringAllowed ? "Entitlement Verified" : "Restricted on Free Tier"}
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
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    ⚡ Open UPI Checkout & Upgrade Plan →
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
                <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  <span>Mode: <strong>{mode.toUpperCase()}</strong></span>
                  <span>•</span>
                  <span>Duration: <strong>{durationMinutes} Min</strong></span>
                  <span>•</span>
                  <span>Questions: <strong>{selectedQuestionIds.length}</strong></span>
                  <span>•</span>
                  <span>Candidates: <strong>{candidateCount}</strong></span>
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
                ℹ️ Publishing creates an immutable exam snapshot version. Edits to the question bank
                after publishing will not alter this candidate version. Candidate enrollment UIDs and PINs
                will be generated automatically.
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
