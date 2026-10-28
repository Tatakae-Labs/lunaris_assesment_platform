import React, { useState } from "react";
import { api } from "../shared/api";

export default function CreateQuestionModal({ organizationId, onClose, onCreated }) {
  const [subject, setSubject] = useState("Physics");
  const [type, setType] = useState("single_mcq");
  const [text, setText] = useState("");
  
  // MCQ Options
  const [options, setOptions] = useState([
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" }
  ]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);

  // Numerical Question
  const [numericalAnswer, setNumericalAnswer] = useState("");
  const [tolerance, setTolerance] = useState("0.01");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleOptionTextChange(idx, val) {
    const updated = [...options];
    updated[idx].text = val;
    setOptions(updated);
  }

  async function handleSave() {
    if (!text.trim()) {
      setError("Please enter the question text");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let contentPayload = { text };

      if (type === "single_mcq" || type === "multi_mcq") {
        const validOptions = options.map((opt, i) => ({
          id: `opt_${i + 1}`,
          text: opt.text.trim() || `Option ${i + 1}`
        }));
        contentPayload.options = validOptions;
        contentPayload.correct_option_id = validOptions[correctOptionIndex].id;
      } else if (type === "numerical") {
        if (!numericalAnswer.trim()) {
          throw new Error("Please specify the numerical target answer");
        }
        contentPayload.numerical_answer = parseFloat(numericalAnswer);
        contentPayload.tolerance = parseFloat(tolerance) || 0.01;
      }

      await api.createQuestion({
        organization_id: organizationId,
        subject,
        question_type: type,
        content: contentPayload
      });

      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "640px",
        width: "100%",
        maxHeight: "90vh",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "14px",
        boxShadow: "var(--card-shadow-hover)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Author New Question
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Add to Organization Question Bank with JEE marking rules
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", color: "var(--text-muted)", fontSize: "20px", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "var(--accent-rose-subtle)", color: "var(--accent-rose)", borderRadius: "6px", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "13px"
                }}
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Question Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "13px"
                }}
              >
                <option value="single_mcq">Single-Correct MCQ (+4 / -1)</option>
                <option value="multi_mcq">Multiple-Correct MCQ (+4 / -2)</option>
                <option value="numerical">Numerical Value Question (NVQ)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Question Stem / Formulation
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. A body of mass m is released from the top of an inclined plane..."
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "14px",
                lineHeight: "1.5"
              }}
            />
          </div>

          {/* Type Specific Fields */}
          {type === "numerical" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Target Numerical Answer
                </label>
                <input
                  type="number"
                  step="any"
                  value={numericalAnswer}
                  onChange={(e) => setNumericalAnswer(e.target.value)}
                  placeholder="e.g. 9.81 or 24"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Accepted Tolerance (±)
                </label>
                <input
                  type="number"
                  step="any"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  placeholder="0.01"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>
                Options & Correct Answer Selection
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="radio"
                      name="correct_opt"
                      checked={correctOptionIndex === i}
                      onChange={() => setCorrectOptionIndex(i)}
                      style={{ width: "18px", height: "18px", accentColor: "var(--accent-blue)" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "bold", width: "24px" }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)} description`}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "6px",
                        fontSize: "13px"
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px"
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 18px",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 20px",
              background: "var(--accent-blue)",
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "bold"
            }}
          >
            {saving ? "Saving..." : "Save Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
