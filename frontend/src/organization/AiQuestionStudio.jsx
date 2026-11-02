import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import {
  BotIcon, UploadIcon, FileTextIcon, CheckIcon, XIcon,
  RefreshIcon, TrashIcon, PlusIcon, SearchIcon, ZapIcon
} from "../shared/Icons";

const QUESTION_FORMAT_OPTIONS = [
  { id: "single_mcq", label: "Single Choice MCQ", desc: "Standard 4-option single correct choice" },
  { id: "multi_mcq", label: "Multiple Choice", desc: "Multi-correct choices with partial marking" },
  { id: "numerical", label: "Numerical Value (NVQ)", desc: "Exact decimal calculation with tolerance" },
  { id: "assertion_reason", label: "Assertion & Reason", desc: "Statement evaluation (A & R validity)" },
  { id: "true_false", label: "True / False", desc: "Binary factual or conceptual verification" },
  { id: "coding", label: "Coding Sandbox (IDE)", desc: "Code problem with starter code & test cases" },
  { id: "one_word", label: "One-Word Answer", desc: "Terminology identification with acceptable variants" },
  { id: "match_following", label: "Match the Following", desc: "Paired column relationship mapping" },
  { id: "case_study", label: "Case Study / Passage", desc: "Contextual scenario with analytical questions" }
];

export default function AiQuestionStudio({ organizationId, onQuestionApproved }) {
  const [studioMode, setStudioMode] = useState("synthesizer"); // "synthesizer" | "file_ingestion"
  
  // Synthesizer State
  const [topic, setTopic] = useState("Data Structures & Algorithms");
  const [subject, setSubject] = useState("");
  const [customSubjects, setCustomSubjects] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFormats, setSelectedFormats] = useState(["single_mcq", "numerical"]);
  const [bloomLevel, setBloomLevel] = useState("analytical");
  const [targetAudience, setTargetAudience] = useState("Undergraduate");
  const [explanationDetail, setExplanationDetail] = useState("detailed");
  const [count, setCount] = useState(25);
  const [referenceNotes, setReferenceNotes] = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // File Ingestion / PYQ Parser State
  const [selectedFile, setSelectedFile] = useState(null);
  const [ingestSubject, setIngestSubject] = useState("");
  const [autoApproveFile, setAutoApproveFile] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestionResult, setIngestionResult] = useState(null);

  // Drafts & Key State
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftTypeFilter, setDraftTypeFilter] = useState("all");
  const [draftPage, setDraftPage] = useState(1);
  const draftPageSize = 10;
  const [statusMsg, setStatusMsg] = useState(null);
  const [groqApiKey, setGroqApiKey] = useState(localStorage.getItem("lunaris_groq_api_key") || "");
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, [organizationId]);

  useEffect(() => {
    setDraftPage(1);
  }, [draftTypeFilter, draftSearch]);

  async function loadSubjects() {
    if (!organizationId) return;
    try {
      const res = await api.getOrgSubjects(organizationId);
      const list = res || [];
      setCustomSubjects(list);
      if (list.length > 0) {
        setSubject(list[0].name);
        setIngestSubject(list[0].name);
      } else {
        setSubject("General");
        setIngestSubject("General");
      }
    } catch (e) {
      console.warn("Could not load organization subjects:", e);
    }
  }

  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      const res = await api.getAiDrafts(organizationId);
      setDrafts(res || []);
    } catch (err) {
      console.error("Error loading drafts:", err);
    } finally {
      setLoadingDrafts(false);
    }
  }

  function handleSaveGroqKey(keyVal) {
    setGroqApiKey(keyVal);
    localStorage.setItem("lunaris_groq_api_key", keyVal);
  }

  function toggleFormat(id) {
    setSelectedFormats((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((f) => f !== id);
      } else {
        return [...prev, id];
      }
    });
  }

  function handleSelectAllFormats() {
    setSelectedFormats(QUESTION_FORMAT_OPTIONS.map((f) => f.id));
  }

  function handleSelectCoreFormats() {
    setSelectedFormats(["single_mcq", "multi_mcq", "numerical", "assertion_reason"]);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please provide a curriculum topic or concept");
      return;
    }
    const numQ = parseInt(count, 10);
    if (!numQ || numQ < 1) {
      toast.error("Please specify a valid number of questions (1-100)");
      return;
    }
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await api.generateAiQuestions({
        organization_id: organizationId,
        topic: topic.trim(),
        subject: subject || "General",
        difficulty,
        question_format: selectedFormats.length === 1 ? selectedFormats[0] : "mixed",
        selected_formats: selectedFormats,
        bloom_level: bloomLevel,
        target_audience: targetAudience,
        explanation_detail: explanationDetail,
        reference_notes: referenceNotes.trim() || undefined,
        count: numQ,
        include_numerical: selectedFormats.includes("numerical"),
        groq_api_key: groqApiKey.trim() || undefined
      });
      const engineName = res.engine === "groq_llama_3.3_70b" ? "Groq LLaMA-3.3-70B Universal Engine" : "Curriculum Engine";
      toast.success(`Successfully synthesized ${res.drafts_count} questions across ${selectedFormats.length} categories!`);
      setStatusMsg(`Generated ${res.drafts_count} items via ${engineName}`);
      loadDrafts();
    } catch (err) {
      toast.error("AI Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleIngestFile(e) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file (PDF, TXT, CSV, JSON) to analyze");
      return;
    }
    setIngesting(true);
    setIngestionResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("organization_id", organizationId);
      formData.append("subject", ingestSubject || subject || "General");
      formData.append("auto_approve", autoApproveFile ? "true" : "false");
      if (groqApiKey.trim()) {
        formData.append("groq_api_key", groqApiKey.trim());
      }

      const res = await api.ingestQuestionFile(formData);
      setIngestionResult(res);
      toast.success(res.message || `Analyzed file and extracted ${res.questions_extracted} categorized questions!`);
      setSelectedFile(null);
      await loadDrafts();
      if (autoApproveFile && onQuestionApproved) {
        onQuestionApproved();
      }
    } catch (err) {
      toast.error("File Ingestion failed: " + err.message);
    } finally {
      setIngesting(false);
    }
  }

  async function handleApprove(draftId) {
    try {
      await api.approveAiDraft(draftId);
      toast.success("Question approved and added to active Question Bank!");
      loadDrafts();
      if (onQuestionApproved) onQuestionApproved();
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    }
  }

  async function confirmBulkApproveAction() {
    if (filteredDrafts.length === 0) return;
    setBulkApproving(true);
    try {
      const ids = filteredDrafts.map((d) => d.id);
      const res = await api.bulkApproveAiDrafts(organizationId, ids);
      toast.success(res.message || `Approved ${ids.length} questions into Question Bank!`);
      setShowBulkApproveConfirm(false);
      await loadDrafts();
      if (onQuestionApproved) onQuestionApproved();
    } catch (err) {
      toast.error("Bulk approval failed: " + err.message);
    } finally {
      setBulkApproving(false);
    }
  }

  function handleBulkApprove() {
    if (filteredDrafts.length === 0) return;
    setShowBulkApproveConfirm(true);
  }

  async function handleReject(draftId) {
    try {
      await api.rejectAiDraft(draftId);
      loadDrafts();
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    }
  }

  async function handleDeleteDraft(draftId) {
    try {
      await api.deleteAiDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success("Draft removed");
    } catch (err) {
      toast.error("Failed to delete draft: " + err.message);
    }
  }

  async function confirmClearAllDraftsAction() {
    setClearingDrafts(true);
    try {
      await api.clearAiDrafts(organizationId);
      setDrafts([]);
      setShowClearConfirm(false);
      toast.success("All pending drafts cleared");
    } catch (err) {
      toast.error("Failed to clear drafts: " + err.message);
    } finally {
      setClearingDrafts(false);
    }
  }

  function handleClearAllDrafts() {
    setShowClearConfirm(true);
  }

  const filteredDrafts = drafts.filter((d) => {
    if (draftTypeFilter !== "all" && d.type !== draftTypeFilter) return false;
    if (!draftSearch.trim()) return true;
    const q = draftSearch.toLowerCase();
    const txt = d.content?.text || "";
    const top = d.topic || "";
    return txt.toLowerCase().includes(q) || top.toLowerCase().includes(q);
  });
  const totalDraftPages = Math.ceil(filteredDrafts.length / draftPageSize) || 1;
  const pagedDrafts = filteredDrafts.slice(
    (draftPage - 1) * draftPageSize,
    draftPage * draftPageSize
  );


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Studio Header Card */}
      <div className="dash-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                display: "grid",
                placeItems: "center"
              }}>
                <BotIcon size={16} />
              </span>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                AI Question Generation Studio & PYQ Ingestor
              </h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Synthesize curriculum-aligned assessments across multiple categories, or upload Past Year Papers (PYQs) to automatically extract, categorize, and ingest questions.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              padding: "4px 12px",
              background: groqApiKey ? "var(--accent-emerald-subtle)" : "var(--accent-blue-subtle)",
              color: groqApiKey ? "var(--accent-emerald)" : "var(--accent-blue)",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: "700"
            }}>
              {groqApiKey ? " Groq LLaMA-3.3-70B Active" : " Curriculum Engine Active"}
            </span>
            <button
              type="button"
              onClick={() => setShowKeyConfig((prev) => !prev)}
              style={{
                padding: "5px 12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              {showKeyConfig ? "Hide API Key" : "Configure Groq API Key"}
            </button>
          </div>
        </div>

        {/* Expandable Groq API Key Configuration Box */}
        {showKeyConfig && (
          <div style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "20px",
            fontSize: "13px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "12px" }}>
                Groq Cloud API Key (gsk_...)
              </label>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Key is stored securely in your browser session for high-speed synthesis
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="password"
                value={groqApiKey}
                onChange={(e) => handleSaveGroqKey(e.target.value)}
                placeholder="Paste your Groq API Key (e.g. gsk_...)"
                className="lunaris-input"
                style={{ flex: 1, fontFamily: "monospace" }}
              />
              <button
                type="button"
                onClick={() => {
                  if (groqApiKey) {
                    toast.success("Groq API Key saved! Synthesis will use Groq LLaMA-3.3-70B.");
                  } else {
                    toast.info("Groq API Key cleared. Studio will use built-in curriculum templates.");
                  }
                  setShowKeyConfig(false);
                }}
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Save Key
              </button>
            </div>
          </div>
        )}

        {/* Studio Mode Selector Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", marginBottom: "20px", gap: "20px" }}>
          <button
            type="button"
            onClick={() => setStudioMode("synthesizer")}
            style={{
              padding: "10px 0",
              fontSize: "13px",
              fontWeight: studioMode === "synthesizer" ? "800" : "600",
              color: studioMode === "synthesizer" ? "var(--accent-blue)" : "var(--text-secondary)",
              borderBottom: studioMode === "synthesizer" ? "2px solid var(--accent-blue)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <ZapIcon size={14} />
            <span>AI Curriculum Synthesizer</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode("file_ingestion")}
            style={{
              padding: "10px 0",
              fontSize: "13px",
              fontWeight: studioMode === "file_ingestion" ? "800" : "600",
              color: studioMode === "file_ingestion" ? "var(--accent-blue)" : "var(--text-secondary)",
              borderBottom: studioMode === "file_ingestion" ? "2px solid var(--accent-blue)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <UploadIcon size={14} />
            <span>Universal File & PYQ Ingestor</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* MODE 1: AI CURRICULUM SYNTHESIZER                        */}
        {/* ======================================================== */}
        {studioMode === "synthesizer" && (
          <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Primary Topic & Subject Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Topic / Chapter / Skill Concept *
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Binary Search Trees, Constitutional Law, Macroeconomics"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Subject / Academic Domain
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                >
                  {customSubjects.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name} ({s.category || "General"})
                    </option>
                  ))}
                  {customSubjects.length === 0 && (
                    <>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Law">Law</option>
                      <option value="Medical & Clinical">Medical & Clinical</option>
                      <option value="Commerce & Finance">Commerce & Finance</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Question Quantity (No. of Qs)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "700"
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>Qs</span>
                </div>
              </div>
            </div>

            {/* Quick Quantity Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "11px" }}>
              <span style={{ color: "#64748b", fontWeight: "600" }}>Quantity Presets:</span>
              {[5, 10, 15, 20, 25, 30, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCount(preset)}
                  style={{
                    padding: "2px 8px",
                    background: parseInt(count, 10) === preset ? "var(--accent-blue)" : "#ffffff",
                    color: parseInt(count, 10) === preset ? "#ffffff" : "#334155",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "4px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  {preset} Qs
                </button>
              ))}
            </div>

            {/* Multiple Categories Simultaneously */}
            <div style={{
              background: "#f8fafc",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "14px 16px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>
                    Question Categories & Formats (Simultaneous Multiple Selection)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Select multiple categories to generate a balanced multi-format assessment pack.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={handleSelectCoreFormats}
                    style={{
                      padding: "3px 8px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    Core Mix
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllFormats}
                    style={{
                      padding: "3px 8px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    Select All
                  </button>
                </div>
              </div>

              {/* Grid of category checkboxes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                {QUESTION_FORMAT_OPTIONS.map((fmt) => {
                  const isChecked = selectedFormats.includes(fmt.id);
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => toggleFormat(fmt.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: isChecked ? "1.5px solid var(--accent-blue)" : "1px solid #e2e8f0",
                        background: isChecked ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        transition: "all 0.12s ease"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: "2px", accentColor: "var(--accent-blue)" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: isChecked ? "#1d4ed8" : "#1e293b" }}>
                          {fmt.label}
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748b", marginTop: "1px", lineHeight: "1.2" }}>
                          {fmt.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cognitive Depth & Pedagogical Options */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Cognitive Depth (Bloom's Taxonomy)
                </label>
                <select
                  value={bloomLevel}
                  onChange={(e) => setBloomLevel(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "var(--bg-secondary)" }}
                >
                  <option value="recall">Foundational (Recall & Definitions)</option>
                  <option value="comprehension">Conceptual (Comprehension & Translation)</option>
                  <option value="analytical">Analytical (Applied Problem Solving)</option>
                  <option value="problem_solving">Advanced Synthesis & Evaluation</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Target Academic Tier
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "var(--bg-secondary)" }}
                >
                  <option value="K-12 / Secondary">Secondary / K-12 Foundation</option>
                  <option value="Undergraduate">Undergraduate / College</option>
                  <option value="Graduate / Advanced">Graduate / Postgraduate</option>
                  <option value="Professional Licensing">Professional & Certification</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Explanation Style
                </label>
                <select
                  value={explanationDetail}
                  onChange={(e) => setExplanationDetail(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "var(--bg-secondary)" }}
                >
                  <option value="detailed">Step-by-step Full Derivation</option>
                  <option value="concise">Concise Pedagogical Rationale</option>
                  <option value="formula">Formula & Answer Key Only</option>
                </select>
              </div>
            </div>

            {/* Reference Notes / Grounding Excerpt Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotesInput(!showNotesInput)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  color: "var(--accent-blue)",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                {showNotesInput ? "▼ Hide Lecture Notes / Syllabus Excerpt" : "▶ + Ground generation on Lecture Notes / Text Excerpt (RAG)"}
              </button>
              {showNotesInput && (
                <textarea
                  value={referenceNotes}
                  onChange={(e) => setReferenceNotes(e.target.value)}
                  placeholder="Paste reference text, lecture transcript, syllabus bullets, or code snippets to ground the generated questions specifically on your institution's materials..."
                  rows={3}
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    padding: "8px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontFamily: "inherit"
                  }}
                />
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={generating}
                style={{
                  padding: "10px 24px",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: generating ? "not-allowed" : "pointer"
                }}
              >
                <BotIcon size={16} />
                <span>{generating ? `Synthesizing ${count} Questions...` : `Synthesize ${count} Questions Across ${selectedFormats.length} Formats`}</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* MODE 2: UNIVERSAL FILE & PYQ INGESTION                   */}
        {/* ======================================================== */}
        {studioMode === "file_ingestion" && (
          <form onSubmit={handleIngestFile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                border: "2px dashed var(--accent-blue)",
                borderRadius: "12px",
                padding: "36px 20px",
                background: "#f8fafc",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px"
              }}
            >
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#eff6ff", color: "var(--accent-blue)", display: "grid", placeItems: "center" }}>
                <UploadIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                  Upload Past Year Question Paper (PYQ) or Assessment Document
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Supports PDF documents, Word notes, CSV question sheets, JSON banks, or TXT papers.
                </p>
              </div>

              <input
                type="file"
                accept=".pdf,.docx,.txt,.csv,.json,.md"
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                style={{ marginTop: "8px", fontSize: "12px" }}
              />

              {selectedFile && (
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#166534", background: "#dcfce7", padding: "4px 12px", borderRadius: "6px" }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Ingestion Options */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Assign to Subject / Department
                </label>
                <select
                  value={ingestSubject}
                  onChange={(e) => setIngestSubject(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "var(--bg-secondary)" }}
                >
                  {customSubjects.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name} ({s.category || "General"})
                    </option>
                  ))}
                  {customSubjects.length === 0 && (
                    <option value="General">General Curriculum</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Ingestion Target
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                  <input
                    type="checkbox"
                    id="autoApproveCheck"
                    checked={autoApproveFile}
                    onChange={(e) => setAutoApproveFile(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-blue)" }}
                  />
                  <label htmlFor="autoApproveCheck" style={{ fontSize: "12px", color: "#1e293b", cursor: "pointer", fontWeight: "600" }}>
                    Directly add approved questions to Question Bank immediately
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Ingestion */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={ingesting || !selectedFile}
                style={{
                  padding: "10px 24px",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: (ingesting || !selectedFile) ? "not-allowed" : "pointer",
                  opacity: (ingesting || !selectedFile) ? 0.6 : 1
                }}
              >
                <FileTextIcon size={16} />
                <span>{ingesting ? "Analyzing & Categorizing Questions..." : "Analyze, Categorize & Ingest Questions"}</span>
              </button>
            </div>

            {/* Ingestion Report Card */}
            {ingestionResult && (
              <div style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "12px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontWeight: "800", fontSize: "13px" }}>
                  <CheckIcon size={16} />
                  <span>Ingestion Complete: {ingestionResult.questions_extracted} Questions Extracted</span>
                </div>
                <p style={{ fontSize: "12px", color: "#166534", marginTop: "4px" }}>
                  Parsed from file <strong>{ingestionResult.filename}</strong> and categorized by subject and concept.
                </p>
                {ingestionResult.categories_breakdown && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                    {Object.entries(ingestionResult.categories_breakdown).map(([cat, qty]) => (
                      <span key={cat} style={{ background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                        {cat.toUpperCase()}: {qty}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      {/* ======================================================== */}
      {/* PENDING DRAFTS & FACULTY REVIEW SECTION                   */}
      {/* ======================================================== */}
      <div className="dash-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
              Pending AI & Imported Drafts for Review ({drafts.length})
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Verify accuracy and approve questions individually or in bulk to make them active in the Question Bank.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {drafts.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={bulkApproving}
                  onClick={handleBulkApprove}
                  style={{
                    padding: "6px 14px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#059669",
                    cursor: bulkApproving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <CheckIcon size={14} />
                  <span>{bulkApproving ? "Approving..." : `Approve All (${filteredDrafts.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllDrafts}
                  style={{
                    padding: "6px 12px",
                    background: "#fff5f5",
                    border: "1px solid #fca5a5",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#dc2626",
                    cursor: "pointer"
                  }}
                >
                  Clear Drafts
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadDrafts}
              style={{
                padding: "6px 12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <RefreshIcon size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Drafts Filter Bar */}
        {drafts.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search draft text, formulas, or topics..."
                style={{ width: "100%", padding: "6px 10px 6px 30px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
              />
              <span style={{ position: "absolute", left: "9px", top: "7px", color: "#94a3b8" }}>
                <SearchIcon size={13} />
              </span>
            </div>

            <select
              value={draftTypeFilter}
              onChange={(e) => setDraftTypeFilter(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "#ffffff" }}
            >
              <option value="all">All Question Types</option>
              <option value="single_mcq">Single MCQ</option>
              <option value="multi_mcq">Multiple Choice</option>
              <option value="numerical">Numerical (NVQ)</option>
              <option value="assertion_reason">Assertion & Reason</option>
              <option value="true_false">True / False</option>
              <option value="coding">Coding Sandbox</option>
            </select>
          </div>
        )}

        {/* Drafts List */}
        {loadingDrafts ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            Loading drafts...
          </div>
        ) : drafts.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            <div style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "14px" }}>No Pending Drafts</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Use the AI Curriculum Synthesizer or upload a Past Year Question paper above to generate or ingest assessment items.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {pagedDrafts.map((draft, idx) => {
              const content = draft.content || {};
              return (
                <div
                  key={draft.id}
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "16px",
                    background: "var(--bg-surface)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        background: "var(--accent-blue-subtle)",
                        color: "var(--accent-blue)"
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        background: "#f1f5f9",
                        color: "#334155"
                      }}>
                        {draft.type?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                        {draft.subject} • {draft.topic}
                      </span>
                      {content.source_file && (
                        <span style={{ fontSize: "11px", color: "#166534", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }}>
                          Source: {content.source_file}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(draft.id)}
                        style={{
                          padding: "4px 10px",
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "700",
                          color: "#059669",
                          cursor: "pointer"
                        }}
                      >
                        ✓ Approve to Q-Bank
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(draft.id)}
                        style={{
                          padding: "4px 8px",
                          background: "#fee2e2",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "11px",
                          color: "#dc2626",
                          cursor: "pointer"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Question Statement */}
                  <div style={{ fontSize: "13px", color: "#0f172a", lineHeight: "1.5", marginBottom: "10px", fontWeight: "600" }}>
                    {content.text}
                  </div>

                  {/* Options rendering */}
                  {content.options && content.options.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                      {content.options.map((opt) => {
                        const isCorrect = (content.correct_option_id === opt.id) || (content.correct_option_ids && content.correct_option_ids.includes(opt.id));
                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              background: isCorrect ? "#ecfdf5" : "#f8fafc",
                              border: isCorrect ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                              color: isCorrect ? "#065f46" : "#334155",
                              fontWeight: isCorrect ? "700" : "400"
                            }}
                          >
                            {isCorrect && "✓ "} {opt.text}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Numerical Answer */}
                  {draft.type === "numerical" && (
                    <div style={{ fontSize: "12px", color: "#0891b2", background: "#ecfeff", padding: "6px 10px", borderRadius: "4px", marginBottom: "10px", fontWeight: "600" }}>
                      Answer: {content.numerical_answer} (Tolerance: ±{content.tolerance || 0.1})
                    </div>
                  )}

                  {/* True / False */}
                  {draft.type === "true_false" && (
                    <div style={{ fontSize: "12px", color: "#059669", background: "#ecfdf5", padding: "6px 10px", borderRadius: "4px", marginBottom: "10px", fontWeight: "600" }}>
                      Correct Answer: {String(content.correct_answer).toUpperCase()}
                    </div>
                  )}

                  {/* Explanation */}
                  {content.explanation && (
                    <div style={{ fontSize: "11px", color: "#64748b", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px", borderLeft: "3px solid var(--accent-blue)" }}>
                      <strong>Solution / Rationale:</strong> {content.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            {/* AI Drafts Pagination Controls */}
            {filteredDrafts.length > draftPageSize && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 18px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  background: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Showing <strong>{((draftPage - 1) * draftPageSize) + 1}</strong> - <strong>{Math.min(draftPage * draftPageSize, filteredDrafts.length)}</strong> of <strong>{filteredDrafts.length}</strong> question drafts
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    disabled={draftPage <= 1}
                    onClick={() => setDraftPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      background: draftPage <= 1 ? "#f1f5f9" : "#ffffff",
                      color: draftPage <= 1 ? "#94a3b8" : "#334155",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: draftPage <= 1 ? "not-allowed" : "pointer"
                    }}
                  >
                    ← Previous
                  </button>
                  {Array.from({ length: totalDraftPages }, (_, i) => i + 1).map((num) => {
                    if (totalDraftPages > 7 && Math.abs(num - draftPage) > 2 && num !== 1 && num !== totalDraftPages) {
                      if (Math.abs(num - draftPage) === 3) {
                        return <span key={num} style={{ fontSize: "11px", color: "#94a3b8", padding: "0 2px" }}>...</span>;
                      }
                      return null;
                    }
                    const isCur = num === draftPage;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDraftPage(num)}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "5px",
                          border: `1px solid ${isCur ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                          background: isCur ? "var(--accent-blue)" : "#ffffff",
                          color: isCur ? "#ffffff" : "#334155",
                          fontSize: "12px",
                          fontWeight: isCur ? "700" : "500",
                          cursor: "pointer"
                        }}
                      >
                        {num}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={draftPage >= totalDraftPages}
                    onClick={() => setDraftPage((p) => Math.min(totalDraftPages, p + 1))}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      background: draftPage >= totalDraftPages ? "#f1f5f9" : "#ffffff",
                      color: draftPage >= totalDraftPages ? "#94a3b8" : "#334155",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: draftPage >= totalDraftPages ? "not-allowed" : "pointer"
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    
      {/* Bulk Approve Confirmation Popup */}
      {showBulkApproveConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => !bulkApproving && setShowBulkApproveConfirm(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <CheckIcon size={22} color="var(--accent-blue)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Approve All Filtered Drafts?
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  This will approve and add <strong>{filteredDrafts.length}</strong> questions directly into your active Question Bank.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={bulkApproving}
                onClick={() => setShowBulkApproveConfirm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: bulkApproving ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkApproving}
                onClick={confirmBulkApproveAction}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: bulkApproving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {bulkApproving ? "Approving..." : `Approve ${filteredDrafts.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Drafts Confirmation Popup */}
      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => !clearingDrafts && setShowClearConfirm(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <TrashIcon size={22} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Clear All AI Question Drafts?
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  Are you sure you want to permanently clear all {drafts.length} AI-generated drafts?
                </p>
                <div style={{ marginTop: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "#64748b" }}>
                  Questions already approved into your active Question Bank will remain safe and unaffected.
                </div>
              </div>
            </div>

            <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={clearingDrafts}
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: clearingDrafts ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingDrafts}
                onClick={confirmClearAllDraftsAction}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: clearingDrafts ? "not-allowed" : "pointer"
                }}
              >
                {clearingDrafts ? "Clearing..." : "Clear Drafts"}
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
