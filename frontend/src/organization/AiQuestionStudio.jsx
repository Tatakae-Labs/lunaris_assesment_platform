import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function AiQuestionStudio({ organizationId, onQuestionApproved }) {
  const [topic, setTopic] = useState("Data Structures & Algorithms");
  const [subject, setSubject] = useState("");
  const [customSubjects, setCustomSubjects] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [questionFormat, setQuestionFormat] = useState("mixed");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [count, setCount] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Groq API Key Configuration
  const [groqApiKey, setGroqApiKey] = useState(localStorage.getItem("lunaris_groq_api_key") || "");
  const [showKeyConfig, setShowKeyConfig] = useState(false);

  useEffect(() => {
    loadDrafts();
    loadSubjects();
  }, [organizationId]);

  async function loadSubjects() {
    if (!organizationId) return;
    try {
      const res = await api.getOrgSubjects(organizationId);
      const list = res || [];
      setCustomSubjects(list);
      if (list.length > 0) {
        setSubject(list[0].name);
      } else {
        setSubject("General");
      }
    } catch (e) {
      console.warn("Could not load organization subjects in AI Studio:", e);
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

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) {
      alert("Please provide a curriculum topic or concept");
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
        question_format: questionFormat,
        reference_notes: referenceNotes.trim() || undefined,
        count: parseInt(count, 10) || 4,
        include_numerical: true,
        groq_api_key: groqApiKey.trim() || undefined
      });
      const engineName = res.engine === "groq_llama_3.3_70b" ? "Groq LLaMA-3.3-70B Universal Engine" : "Curriculum Engine";
      setStatusMsg(`🎉 Successfully synthesized ${res.drafts_count} questions via ${engineName}!`);
      loadDrafts();
    } catch (err) {
      alert("AI Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(draftId) {
    try {
      await api.approveAiDraft(draftId);
      setStatusMsg("Question approved and added to active Question Bank!");
      loadDrafts();
      if (onQuestionApproved) onQuestionApproved();
    } catch (err) {
      alert("Approval failed: " + err.message);
    }
  }

  async function handleReject(draftId) {
    try {
      await api.rejectAiDraft(draftId);
      loadDrafts();
    } catch (err) {
      alert("Rejection failed: " + err.message);
    }
  }

  async function handleDeleteDraft(draftId) {
    try {
      await api.deleteAiDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setStatusMsg("Draft deleted.");
    } catch (err) {
      alert("Failed to delete draft: " + err.message);
    }
  }

  async function handleClearAllDrafts() {
    if (!window.confirm("Permanently clear all AI-generated drafts? Approved questions in your active Question Bank will remain safe.")) {
      return;
    }
    try {
      await api.clearAiDrafts(organizationId);
      setDrafts([]);
      setStatusMsg("All pending drafts cleared.");
    } catch (err) {
      alert("Failed to clear drafts: " + err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Studio Header Card */}
      <div className="dash-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              🤖 AI Question Generation Studio
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Synthesize JEE-aligned single MCQs and numerical value questions (NVQs) with human review prior to publication.
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
              {groqApiKey ? "⚡ Groq LLaMA-3.3-70B Active" : "💡 Curriculum Engine Active"}
            </span>
            <button
              type="button"
              onClick={() => setShowKeyConfig((prev) => !prev)}
              style={{
                padding: "4px 10px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              {showKeyConfig ? "Hide API Key" : "🔑 Groq API Key"}
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
            marginBottom: "16px",
            fontSize: "13px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "12px" }}>
                Groq API Key (gsk_...)
              </label>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Key is stored securely in your browser and used for real-time question synthesis
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
                    alert("Groq API Key saved successfully! Questions will now be generated using Groq LLaMA-3.3-70B.");
                  } else {
                    alert("Groq API Key cleared. Studio will use built-in curriculum templates.");
                  }
                  setShowKeyConfig(false);
                }}
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Generator Form */}
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Topic / Chapter / Skill Concept
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Binary Search Trees, Constitutional Law, Macroeconomics"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Subject / Domain
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
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
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Question Format
              </label>
              <select
                value={questionFormat}
                onChange={(e) => setQuestionFormat(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              >
                <option value="mixed">Mixed (Balanced)</option>
                <option value="single_mcq">Single Choice (MCQ)</option>
                <option value="multi_mcq">Multiple Choice</option>
                <option value="coding">Coding Sandbox (IDE)</option>
                <option value="numerical">Numerical / Exact</option>
                <option value="one_word">One-Word Answer</option>
                <option value="crossword">Crossword Clues</option>
                <option value="true_false">True / False</option>
                <option value="match_following">Match the Following</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Cognitive Depth
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              >
                <option value="easy">Easy (Recall / Foundational)</option>
                <option value="medium">Medium (Analytical / Conceptual)</option>
                <option value="hard">Hard (Advanced Synthesis / Rigorous)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Drafts
              </label>
              <select
                value={count}
                onChange={(e) => setCount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              >
                <option value="5">5 Qs</option>
                <option value="10">10 Qs</option>
                <option value="15">15 Qs</option>
                <option value="20">20 Qs</option>
                <option value="25">25 Qs (Batch Standard)</option>
                <option value="30">30 Qs</option>
                <option value="50">50 Qs (Full Exam Pack)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={generating}
              style={{
                padding: "9px 18px",
                background: "var(--accent-blue)",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "700",
                height: "38px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: generating ? "not-allowed" : "pointer"
              }}
            >
              {generating ? "Generating..." : "⚡ Synthesize"}
            </button>
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
        </form>

        {statusMsg && (
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "var(--accent-emerald-subtle)", color: "var(--accent-emerald)", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
            ✓ {statusMsg}
          </div>
        )}
      </div>

      {/* Drafts Review Section */}
      <div className="dash-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
              Pending AI Drafts for Faculty Verification ({drafts.length})
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              All AI questions remain unlisted in exams until an authorized instructor verifies accuracy and approves.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {drafts.length > 0 && (
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
                🗑️ Clear All Drafts
              </button>
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
                color: "var(--text-secondary)"
              }}
            >
              ↻ Refresh Drafts
            </button>
          </div>
        </div>

        {loadingDrafts ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            Loading drafts...
          </div>
        ) : drafts.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>✨</div>
            <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>No Pending Drafts</div>
            <div style={{ fontSize: "13px" }}>Use the synthesis form above to generate questions on any JEE topic.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {drafts.map((draft, idx) => (
              <div
                key={draft.id}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "18px",
                  background: "var(--bg-surface)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      background: "var(--accent-blue-subtle)",
                      color: "var(--accent-blue)"
                    }}>
                      Draft #{idx + 1}
                    </span>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      background: draft.type === "numerical" ? "var(--accent-cyan-subtle, rgba(8, 145, 178, 0.1))" : "var(--accent-emerald-subtle)",
                      color: draft.type === "numerical" ? "var(--accent-cyan)" : "var(--accent-emerald)"
                    }}>
                      {draft.type === "numerical" ? "Numerical (NVQ)" : "Single MCQ"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                      {draft.subject} • {draft.topic}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      title="Delete draft"
                      style={{
                        padding: "6px 10px",
                        background: "#fee2e2",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      🗑️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(draft.id)}
                      style={{
                        padding: "6px 12px",
                        background: "var(--accent-rose-subtle)",
                        color: "var(--accent-rose)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700"
                      }}
                    >
                      ✕ Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(draft.id)}
                      style={{
                        padding: "6px 14px",
                        background: "var(--accent-emerald)",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700"
                      }}
                    >
                      ✓ Approve into Bank
                    </button>
                  </div>
                </div>

                {/* Question Statement */}
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "12px", lineHeight: "1.6" }}>
                  {draft.content.text}
                </div>

                {/* Options or Numerical Spec */}
                {draft.type === "numerical" ? (
                  <div style={{
                    padding: "10px 14px",
                    background: "var(--bg-secondary)",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-cyan)",
                    marginBottom: "10px"
                  }}>
                    Exact Answer Key: <strong>{draft.content.numerical_answer}</strong> (Tolerance: ±{draft.content.tolerance || 0.0})
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                    {draft.content.options?.map((opt) => {
                      const isCorrect = opt.id === draft.content.correct_option_id;
                      return (
                        <div
                          key={opt.id}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            border: isCorrect ? "1px solid var(--accent-emerald)" : "1px solid var(--border-subtle)",
                            background: isCorrect ? "var(--accent-emerald-subtle)" : "var(--bg-secondary)",
                            color: isCorrect ? "var(--accent-emerald)" : "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}
                        >
                          <span style={{ fontWeight: "bold" }}>{isCorrect ? "✓" : "•"}</span>
                          <span>{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {draft.content.explanation && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: "6px" }}>
                    <strong style={{ color: "var(--text-secondary)" }}>Explanation: </strong> {draft.content.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
