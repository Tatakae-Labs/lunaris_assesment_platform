import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import {
  FileTextIcon, PlusIcon, TrashIcon, CheckIcon, XIcon,
  SearchIcon, LockIcon, UnlockIcon, AlertTriangleIcon, LayersIcon, SparklesIcon
} from "../shared/Icons";

const QUESTION_TYPE_OPTIONS = [
  { id: "single_mcq", label: "Single Choice MCQ", desc: "Standard 4-option single correct choice" },
  { id: "multi_mcq", label: "Multiple Choice (MSQ)", desc: "Multi-correct choices with partial marking" },
  { id: "numerical", label: "Numerical Value (NVQ)", desc: "Decimal/Integer calculation with tolerance" },
  { id: "fill_in_blanks", label: "Fill in the Blanks", desc: "Missing terminology identification" },
  { id: "true_false", label: "True / False", desc: "Binary factual or conceptual evaluation" },
  { id: "subjective", label: "Descriptive / Subjective", desc: "Theoretical or derivation response with rubric" }
];

export default function TemplateBuilderModal({
  organizationId,
  templateId = null,
  initialTemplate = null,
  onClose,
  onSaved
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Metadata State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examType, setExamType] = useState("cbt");
  const [language, setLanguage] = useState("English");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [instructions, setInstructions] = useState(
    "1. Read all section instructions carefully.\n2. Negative marks apply where indicated.\n3. Verify your answers before submitting."
  );

  // General Rules
  const [rules, setRules] = useState({
    shuffle_options: true,
    randomize_sections: false,
    allow_calculator: false,
    show_instant_scorecard: false
  });

  // Dynamic Sections State
  const [sections, setSections] = useState([
    {
      id: "sec_1",
      name: "Section A: Conceptual Foundations",
      description: "Multiple choice single-response questions",
      subject: "Physics",
      chapter: "",
      topic: "",
      required_questions: 10,
      marks_per_question: 4.0,
      negative_marking: 1.0,
      question_types: ["single_mcq"],
      difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
      selection_rule: "all_mandatory",
      attempt_limit: 10,
      randomize_order: true,
      preselected_question_ids: []
    }
  ]);

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  // Question Bank Picker Drawer for Section
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankTypeFilter, setBankTypeFilter] = useState("all");

  // Load existing template data if editing
  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        if (initialTemplate) {
          hydrateFromTemplate(initialTemplate);
        }
        return;
      }
      setLoading(true);
      try {
        const data = await api.getTemplate(templateId);
        hydrateFromTemplate(data);
      } catch (err) {
        toast.error("Failed to load template: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [templateId]);

  function hydrateFromTemplate(data) {
    setTitle(data.title || "");
    setDescription(data.description || "");
    setExamType(data.exam_type || "cbt");
    setLanguage(data.language || "English");
    setDurationMinutes(data.duration_minutes || 180);
    setInstructions(data.instructions || "");
    if (data.rules) setRules(data.rules);
    if (data.sections && data.sections.length > 0) {
      setSections(data.sections);
      setActiveSectionIdx(0);
    }
  }

  // Live Dynamic Calculations
  const calculatedQuestions = sections.reduce((sum, s) => sum + (Number(s.required_questions) || 0), 0);
  const calculatedMarks = sections.reduce(
    (sum, s) => sum + ((Number(s.required_questions) || 0) * (Number(s.marks_per_question) || 0)),
    0
  );

  // Section manipulation
  function handleAddSection() {
    const nextNum = sections.length + 1;
    const newSec = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `Section ${String.fromCharCode(64 + nextNum)}: New Section`,
      description: "",
      subject: sections[0]?.subject || "Physics",
      chapter: "",
      topic: "",
      required_questions: 5,
      marks_per_question: 4.0,
      negative_marking: 1.0,
      question_types: ["single_mcq"],
      difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
      selection_rule: "all_mandatory",
      attempt_limit: 5,
      randomize_order: true,
      preselected_question_ids: []
    };
    setSections([...sections, newSec]);
    setActiveSectionIdx(sections.length);
  }

  function handleRemoveSection(idx) {
    if (sections.length <= 1) {
      toast.warning("A question paper template must have at least 1 section.");
      return;
    }
    const updated = sections.filter((_, i) => i !== idx);
    setSections(updated);
    setActiveSectionIdx(Math.max(0, idx - 1));
  }

  function handleUpdateActiveSection(key, value) {
    setSections((prev) => {
      const copy = [...prev];
      copy[activeSectionIdx] = {
        ...copy[activeSectionIdx],
        [key]: value
      };
      return copy;
    });
  }

  function handleToggleQuestionType(typeId) {
    const cur = sections[activeSectionIdx]?.question_types || [];
    let updated;
    if (cur.includes(typeId)) {
      if (cur.length === 1) {
        toast.warning("At least one question format must be enabled for this section.");
        return;
      }
      updated = cur.filter((t) => t !== typeId);
    } else {
      updated = [...cur, typeId];
    }
    handleUpdateActiveSection("question_types", updated);
  }

  function handleMoveSection(direction) {
    const targetIdx = activeSectionIdx + direction;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const copy = [...sections];
    const temp = copy[activeSectionIdx];
    copy[activeSectionIdx] = copy[targetIdx];
    copy[targetIdx] = temp;
    setSections(copy);
    setActiveSectionIdx(targetIdx);
  }

  // Bank Picker Drawer
  async function openBankPicker() {
    const curSec = sections[activeSectionIdx];
    setBankLoading(true);
    setShowBankPicker(true);
    try {
      const qList = await api.getQuestionsFiltered(organizationId, {
        subject: curSec?.subject || ""
      });
      setBankQuestions(qList || []);
    } catch (err) {
      toast.error("Failed to load Question Bank questions: " + err.message);
    } finally {
      setBankLoading(false);
    }
  }

  function handleToggleBankQuestion(qId) {
    const curSec = sections[activeSectionIdx];
    const pre = curSec.preselected_question_ids || [];
    let next;
    if (pre.includes(qId)) {
      next = pre.filter((id) => id !== qId);
    } else {
      if (pre.length >= (curSec.required_questions || 10)) {
        toast.warning(`Cannot pre-select more than the required question count (${curSec.required_questions}). Increase required questions first.`);
        return;
      }
      next = [...pre, qId];
    }
    handleUpdateActiveSection("preselected_question_ids", next);
  }

  // Save / Publish
  async function handleSave(statusToSet = "draft") {
    // Resolve organization ID with multi-level fallback
    let targetOrgId = organizationId;
    if (!targetOrgId && initialTemplate?.organization_id) {
      targetOrgId = initialTemplate.organization_id;
    }
    if (!targetOrgId) {
      try {
        const saved = localStorage.getItem("lunaris_user");
        targetOrgId = saved ? JSON.parse(saved)?.organization_id : "";
      } catch (e) {}
    }

    if (!targetOrgId) {
      const msg = "Unable to determine active organization. Please re-select your academy.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (!title.trim()) {
      const msg = "Please enter a template title.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.name || !s.name.trim()) {
        const msg = `Section #${i + 1} requires a section name.`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      if (!s.subject || !s.subject.trim()) {
        const msg = `Section '${s.name || `#${i + 1}`}' requires a subject.`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      if ((Number(s.required_questions) || 0) <= 0) {
        const msg = `Section '${s.name}' must require at least 1 question.`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
    }

    setSaving(true);
    setErrorMsg("");

    const payload = {
      organization_id: targetOrgId,
      title: title.trim(),
      description: description.trim(),
      exam_type: examType,
      language,
      duration_minutes: Number(durationMinutes) || 180,
      instructions,
      rules,
      sections,
      status: statusToSet
    };

    try {
      let result;
      if (templateId) {
        result = await api.updateTemplate(templateId, payload);
        toast.success(`Template updated to Version ${result.current_version || 2}!`);
      } else {
        result = await api.createTemplate(payload);
        toast.success("Question Paper Template created successfully!");
      }
      if (onSaved) onSaved(result);
      onClose();
    } catch (err) {
      console.error("Save template error:", err);
      const msg = err.message || "Failed to save template";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const activeSec = sections[activeSectionIdx] || sections[0];

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(15, 23, 42, 0.55)",
      backdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 110,
      padding: "20px"
    }}>
      <div className="dash-card" style={{
        width: "1050px",
        maxHeight: "94vh",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        overflow: "hidden"
      }}>
        {/* Modal Top Header with Live Dynamic Calculations */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#ffffff"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                padding: "3px 8px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "700"
              }}>
                TEMPLATE BUILDER
              </span>
              <h2 style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-primary)" }}>
                {templateId ? "Edit Examination Template" : "Design Question Paper Template"}
              </h2>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Configure reusable paper structure, section-level distributions, and selection rules.
            </div>
          </div>

          {/* Dynamic Calculator Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "6px 14px",
              background: "#f8fafc",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px"
            }}>
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>Sections</span>
                <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{sections.length}</strong>
              </div>
              <div style={{ width: "1px", height: "20px", background: "#e2e8f0" }} />
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>Total Questions</span>
                <strong style={{ fontSize: "14px", color: "var(--accent-blue)" }}>{calculatedQuestions}</strong>
              </div>
              <div style={{ width: "1px", height: "20px", background: "#e2e8f0" }} />
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>Total Marks</span>
                <strong style={{ fontSize: "14px", color: "#16a34a" }}>{calculatedMarks} M</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Workspace */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Column: Sections List & Order Manager */}
          <div style={{
            width: "280px",
            borderRight: "1px solid var(--border-subtle)",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Paper Sections ({sections.length})
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAddSection}
                style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <PlusIcon size={12} /> Add
              </button>
            </div>

            {/* Sections List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {sections.map((sec, idx) => {
                const isActive = activeSectionIdx === idx;
                const secMarks = (sec.required_questions || 0) * (sec.marks_per_question || 0);
                return (
                  <div
                    key={sec.id || idx}
                    onClick={() => setActiveSectionIdx(idx)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      marginBottom: "6px",
                      background: isActive ? "#ffffff" : "transparent",
                      border: isActive ? "1.5px solid var(--accent-blue)" : "1px solid transparent",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <strong style={{ fontSize: "12px", color: isActive ? "var(--accent-blue)" : "var(--text-primary)" }}>
                        {sec.name || `Section ${idx + 1}`}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>
                        {secMarks}M
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{sec.subject}</span>
                      <span>{sec.required_questions} Qs</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Section Reorder Controls */}
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border-subtle)",
              background: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Reorder Section:</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={activeSectionIdx === 0}
                  onClick={() => handleMoveSection(-1)}
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                >
                  ▲ Up
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={activeSectionIdx === sections.length - 1}
                  onClick={() => handleMoveSection(1)}
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                >
                  ▼ Down
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Active Section & Paper Configurator */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: "20px 24px" }}>
            {errorMsg && (
              <div style={{
                padding: "10px 14px",
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: "8px",
                color: "#be123c",
                fontSize: "12px",
                marginBottom: "16px",
                fontWeight: "600"
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Template Global Details Accordion / Inputs */}
            <div style={{
              padding: "14px 18px",
              background: "#f8fafc",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              marginBottom: "18px"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                    Template Name *
                  </label>
                  <input
                    type="text"
                    className="lunaris-input"
                    placeholder="e.g. Standard Engineering Physics Midterm 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ background: "#ffffff" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                    Exam Format
                  </label>
                  <select
                    className="lunaris-input"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    style={{ background: "#ffffff" }}
                  >
                    <option value="cbt">Proctored CBT Examination</option>
                    <option value="standard_quiz">Standard Practice Quiz</option>
                    <option value="midterm">Semester Midterm</option>
                    <option value="final">Annual Final Paper</option>
                    <option value="olympiad">Olympiad & Entrance</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    className="lunaris-input"
                    min={10}
                    max={360}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    style={{ background: "#ffffff" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                  Candidate Instructions
                </label>
                <textarea
                  className="lunaris-input"
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  style={{ background: "#ffffff", fontSize: "12px" }}
                />
              </div>
            </div>

            {/* ACTIVE SECTION BUILDER PANEL */}
            {activeSec && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Section Header Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-primary)" }}>
                      Configure {activeSec.name}
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Specify curriculum topics, question types, grading criteria, and optionality.
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={openBankPicker}
                      style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <LayersIcon size={14} />
                      Pre-Assign Bank Questions ({activeSec.preselected_question_ids?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(activeSectionIdx)}
                      style={{
                        padding: "6px 10px",
                        background: "#fff1f2",
                        color: "#e11d48",
                        border: "1px solid #fecdd3",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Delete Section
                    </button>
                  </div>
                </div>

                {/* Section Name & Subject Mapping */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Section Name *
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={activeSec.name}
                      onChange={(e) => handleUpdateActiveSection("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Curriculum Subject *
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      placeholder="e.g. Physics, Law, CS"
                      value={activeSec.subject}
                      onChange={(e) => handleUpdateActiveSection("subject", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Chapter / Topic (Optional)
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      placeholder="e.g. Kinematics, Circuits"
                      value={activeSec.topic || activeSec.chapter || ""}
                      onChange={(e) => {
                        handleUpdateActiveSection("topic", e.target.value);
                        handleUpdateActiveSection("chapter", e.target.value);
                      }}
                    />
                  </div>
                </div>

                {/* Marks, Questions Count, Negative Marking */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Required Questions *
                    </label>
                    <input
                      type="number"
                      className="lunaris-input"
                      min={1}
                      max={100}
                      value={activeSec.required_questions}
                      onChange={(e) => handleUpdateActiveSection("required_questions", Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Marks Per Question *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      className="lunaris-input"
                      value={activeSec.marks_per_question}
                      onChange={(e) => handleUpdateActiveSection("marks_per_question", Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Negative Marking
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      className="lunaris-input"
                      value={activeSec.negative_marking}
                      onChange={(e) => handleUpdateActiveSection("negative_marking", Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>
                      Selection Rule
                    </label>
                    <select
                      className="lunaris-input"
                      value={activeSec.selection_rule || "all_mandatory"}
                      onChange={(e) => handleUpdateActiveSection("selection_rule", e.target.value)}
                    >
                      <option value="all_mandatory">All Questions Mandatory</option>
                      <option value="attempt_any">Attempt Any X Questions</option>
                    </select>
                  </div>
                </div>

                {/* Question Types Distribution */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                    Permitted Question Types for this Section
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    {QUESTION_TYPE_OPTIONS.map((opt) => {
                      const isSelected = (activeSec.question_types || []).includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleToggleQuestionType(opt.id)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: isSelected ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                            background: isSelected ? "var(--accent-blue-subtle)" : "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: "pointer" }}
                          />
                          <div>
                            <strong style={{ fontSize: "12px", display: "block", color: "var(--text-primary)" }}>{opt.label}</strong>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{opt.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty Distribution Sliders */}
                <div style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
                      Difficulty Target Distribution
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Target: Easy {activeSec.difficulty_distribution?.easy || 30}% • Medium {activeSec.difficulty_distribution?.medium || 50}% • Hard {activeSec.difficulty_distribution?.hard || 20}%
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span>Easy</span>
                        <strong>{activeSec.difficulty_distribution?.easy || 30}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={activeSec.difficulty_distribution?.easy || 30}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateActiveSection("difficulty_distribution", {
                            ...activeSec.difficulty_distribution,
                            easy: val
                          });
                        }}
                        style={{ width: "100%", accentColor: "#16a34a" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span>Medium</span>
                        <strong>{activeSec.difficulty_distribution?.medium || 50}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={activeSec.difficulty_distribution?.medium || 50}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateActiveSection("difficulty_distribution", {
                            ...activeSec.difficulty_distribution,
                            medium: val
                          });
                        }}
                        style={{ width: "100%", accentColor: "#2563eb" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span>Hard</span>
                        <strong>{activeSec.difficulty_distribution?.hard || 20}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={activeSec.difficulty_distribution?.hard || 20}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateActiveSection("difficulty_distribution", {
                            ...activeSec.difficulty_distribution,
                            hard: val
                          });
                        }}
                        style={{ width: "100%", accentColor: "#dc2626" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Randomization & Ordering Controls */}
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={activeSec.randomize_order !== false}
                      onChange={(e) => handleUpdateActiveSection("randomize_order", e.target.checked)}
                    />
                    <span>Randomize question order within this section during paper generation</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border-subtle)",
          background: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {errorMsg && (
              <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>
                ⚠️ {errorMsg}
              </span>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleSave("draft")}
              disabled={saving}
              style={{ padding: "8px 18px", fontSize: "13px" }}
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleSave("published")}
              disabled={saving}
              style={{ padding: "8px 22px", fontSize: "13px", background: "#16a34a" }}
            >
              {saving ? "Publishing..." : "Publish Template for Reuse ✓"}
            </button>
          </div>
        </div>
      </div>

      {/* QUESTION BANK PRE-ASSIGN DRAWER */}
      {showBankPicker && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "480px",
          height: "100%",
          background: "#ffffff",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.2)",
          zIndex: 120,
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-primary)" }}>
                Pre-Assign Questions ({activeSec.preselected_question_ids?.length || 0}/{activeSec.required_questions})
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Selected questions will be locked into {activeSec.name}.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBankPicker(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* Search bar inside Drawer */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
            <input
              type="text"
              className="lunaris-input"
              placeholder="Search question text or topic..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              style={{ fontSize: "12px" }}
            />
          </div>

          {/* Questions List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {bankLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                Loading Question Bank...
              </div>
            ) : bankQuestions.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                No questions found in Question Bank for subject '{activeSec.subject}'.
              </div>
            ) : (
              bankQuestions
                .filter((q) => !bankSearch || q.content?.text?.toLowerCase().includes(bankSearch.toLowerCase()))
                .map((q) => {
                  const isPre = (activeSec.preselected_question_ids || []).includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleBankQuestion(q.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: isPre ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                        background: isPre ? "var(--accent-blue-subtle)" : "#ffffff",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: "#f1f5f9" }}>
                          {q.subject} • {q.question_type}
                        </span>
                        {isPre && <span style={{ fontSize: "11px", color: "var(--accent-blue)", fontWeight: "bold" }}>✓ Locked</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: "1.4" }}>
                        {q.content?.text || "Question content"}
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "#f8fafc" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowBankPicker(false)}
              style={{ width: "100%", fontSize: "13px" }}
            >
              Done Pre-Assigning ({activeSec.preselected_question_ids?.length || 0} Questions Locked)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

