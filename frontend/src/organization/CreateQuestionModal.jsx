import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function CreateQuestionModal({ organizationId, onClose, onCreated }) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("single_mcq");
  const [text, setText] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("medium");

  // Dynamic Organization Subjects & Inline Creator
  const [customSubjects, setCustomSubjects] = useState([]);
  const [showAddSubjectInline, setShowAddSubjectInline] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubCode, setNewSubCode] = useState("");
  const [creatingSub, setCreatingSub] = useState(false);

  useEffect(() => {
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
      console.warn("Could not load organization subjects:", e);
    }
  }

  async function handleAddInlineSubject(e) {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setCreatingSub(true);
    try {
      const res = await api.createOrgSubject(organizationId, {
        name: newSubName.trim(),
        code: newSubCode.trim().toUpperCase() || undefined
      });
      await loadSubjects();
      setSubject(newSubName.trim());
      setNewSubName("");
      setNewSubCode("");
      setShowAddSubjectInline(false);
    } catch (err) {
      alert("Failed to create subject: " + err.message);
    } finally {
      setCreatingSub(false);
    }
  }

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

  // One-Word / Definition ("One word for above")
  const [oneWordAnswer, setOneWordAnswer] = useState("");
  const [acceptableWords, setAcceptableWords] = useState("");
  const [oneWordHint, setOneWordHint] = useState("");

  // True / False
  const [trueFalseAnswer, setTrueFalseAnswer] = useState("true");

  // Match the Following
  const [matchPairs, setMatchPairs] = useState([
    { id: "1", left: "Force", right: "Newton" },
    { id: "2", left: "Energy", right: "Joule" },
    { id: "3", left: "Pressure", right: "Pascal" }
  ]);

  // Crossword Quiz
  const [crosswordClues, setCrosswordClues] = useState([
    { id: "1", direction: "across", clue: "Universal powerhouse of cell", answer: "MITOCHONDRIA", row: 0, col: 0 },
    { id: "2", direction: "down", clue: "Genetic blueprint carrier", answer: "DNA", row: 0, col: 5 }
  ]);

  // Coding & Algorithm Sandbox Question
  const [codingStarterCode, setCodingStarterCode] = useState({
    python: "import sys\n\ndef solve():\n    lines = sys.stdin.read().split()\n    if not lines: return\n    a, b = int(lines[0]), int(lines[1])\n    print(a + b)\n\nif __name__ == '__main__':\n    solve()\n",
    javascript: "const fs = require('fs');\n\nfunction solve() {\n    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n    if (!input || input[0] === '') return;\n    console.log(parseInt(input[0]) + parseInt(input[1]));\n}\nsolve();\n",
    cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    if (cin >> a >> b) {\n        cout << a + b << endl;\n    }\n    return 0;\n}\n",
    java: "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int a = sc.nextInt();\n            int b = sc.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}\n"
  });
  const [codingActiveLang, setCodingActiveLang] = useState("python");
  const [codingTimeLimit, setCodingTimeLimit] = useState("2.0");
  const [codingMemoryLimit, setCodingMemoryLimit] = useState("256");
  const [codingTestCases, setCodingTestCases] = useState([
    { id: "1", input: "5 7\n", expected_output: "12", is_hidden: false, explanation: "5 + 7 = 12" },
    { id: "2", input: "-10 20\n", expected_output: "10", is_hidden: true, explanation: "Negative numbers handling" }
  ]);

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
      } else if (type === "one_word") {
        if (!oneWordAnswer.trim()) {
          throw new Error("Please specify the target one-word answer");
        }
        contentPayload.target_word = oneWordAnswer.trim();
        contentPayload.acceptable_words = acceptableWords
          ? acceptableWords.split(",").map(w => w.trim()).filter(Boolean)
          : [];
        if (oneWordHint.trim()) {
          contentPayload.hint = oneWordHint.trim();
        }
      } else if (type === "true_false") {
        contentPayload.correct_answer = trueFalseAnswer;
      } else if (type === "match_following") {
        const validPairs = matchPairs.filter(p => p.left.trim() && p.right.trim());
        if (validPairs.length < 2) {
          throw new Error("Please specify at least 2 matching pairs");
        }
        contentPayload.pairs = validPairs.map((p, idx) => ({
          id: String(idx + 1),
          left: p.left.trim(),
          right: p.right.trim()
        }));
      } else if (type === "crossword") {
        const validClues = crosswordClues.filter(c => c.clue.trim() && c.answer.trim());
        if (validClues.length === 0) {
          throw new Error("Please add at least one crossword clue and answer");
        }
        const solutionGrid = {};
        validClues.forEach(c => {
          const ans = c.answer.trim().toUpperCase();
          const isDown = c.direction === "down";
          const r = parseInt(c.row) || 0;
          const col = parseInt(c.col) || 0;
          for (let i = 0; i < ans.length; i++) {
            const cellKey = `${isDown ? r + i : r},${isDown ? col : col + i}`;
            solutionGrid[cellKey] = ans[i];
          }
        });
        contentPayload.clues = validClues.map(c => ({
          ...c,
          answer: c.answer.trim().toUpperCase(),
          row: parseInt(c.row) || 0,
          col: parseInt(c.col) || 0
        }));
        contentPayload.solution = solutionGrid;
      } else if (type === "coding") {
        const validCases = codingTestCases.filter(tc => tc.expected_output && tc.expected_output.trim());
        if (validCases.length === 0) {
          throw new Error("Please specify at least 1 test case with an expected output");
        }
        contentPayload.time_limit_sec = parseFloat(codingTimeLimit) || 2.0;
        contentPayload.memory_limit_mb = parseInt(codingMemoryLimit) || 256;
        contentPayload.starter_code = codingStarterCode;
        contentPayload.allowed_languages = ["python", "javascript", "cpp", "java"];
        contentPayload.test_cases = validCases.map((tc, idx) => ({
          id: String(idx + 1),
          input: tc.input || "",
          expected_output: tc.expected_output.trim(),
          is_hidden: Boolean(tc.is_hidden),
          explanation: tc.explanation || ""
        }));
      }

      await api.createQuestion({
        organization_id: organizationId,
        subject: subject || "General",
        question_type: type,
        content: {
          ...contentPayload,
          topic: questionTopic.trim() || undefined,
          difficulty: difficultyLevel
        }
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
              Add to Organization Question Bank with custom assessment marking rules
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", color: "var(--text-muted)", fontSize: "20px", fontWeight: "bold" }}
          >
            
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Curriculum Subject
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSubjectInline(!showAddSubjectInline)}
                  style={{ background: "none", border: "none", color: "var(--accent-blue)", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: 0 }}
                >
                  {showAddSubjectInline ? "Cancel" : "+ Add Subject"}
                </button>
              </div>

              {showAddSubjectInline && (
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <input
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="Subject Name (e.g. Constitutional Law)"
                    style={{ padding: "6px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value.toUpperCase())}
                      placeholder="Code (e.g. LAW101)"
                      style={{ flex: 1, padding: "6px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                    />
                    <button
                      type="button"
                      onClick={handleAddInlineSubject}
                      disabled={creatingSub || !newSubName.trim()}
                      className="btn-primary"
                      style={{ padding: "4px 12px", fontSize: "11px" }}
                    >
                      {creatingSub ? "Saving..." : "Save Subject"}
                    </button>
                  </div>
                </div>
              )}

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
                {customSubjects.length > 0 ? (
                  customSubjects.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.code ? `[${s.code}] ` : ""}{s.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="General">General</option>
                  </>
                )}
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
                <option value="coding"> Coding Problem & Test Cases (Python, JS, C++, Java)</option>
                <option value="one_word">One-Word Answer / Definition ("One word for above")</option>
                <option value="crossword">Crossword Puzzle Quiz</option>
                <option value="match_following">Match the Following (Column A & B)</option>
                <option value="true_false">True / False Statement Verification</option>
              </select>
            </div>
          </div>

          {/* Topic & Difficulty Row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Topic / Unit / Chapter (Optional)
              </label>
              <input
                type="text"
                value={questionTopic}
                onChange={(e) => setQuestionTopic(e.target.value)}
                placeholder="e.g. Fundamental Rights, Graph Algorithms, Cardiovascular System..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "13px"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Difficulty Level
              </label>
              <select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "13px"
                }}
              >
                <option value="easy"> Easy / Foundational</option>
                <option value="medium"> Medium / Standard</option>
                <option value="hard"> Hard / Advanced</option>
                <option value="olympiad"> Expert / Olympiad</option>
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
          ) : type === "one_word" ? (
            <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Target One-Word Answer / Term (Primary)
                </label>
                <input
                  type="text"
                  value={oneWordAnswer}
                  onChange={(e) => setOneWordAnswer(e.target.value)}
                  placeholder="e.g. Mitochondria, Osmosis, Velocity"
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
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Acceptable Alternative Words / Synonyms (comma-separated)
                </label>
                <input
                  type="text"
                  value={acceptableWords}
                  onChange={(e) => setAcceptableWords(e.target.value)}
                  placeholder="e.g. chondriosome, powerhouse"
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
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Optional Clue / Letter Count Hint
                </label>
                <input
                  type="text"
                  value={oneWordHint}
                  onChange={(e) => setOneWordHint(e.target.value)}
                  placeholder="e.g. (12 letters, starts with M)"
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
          ) : type === "true_false" ? (
            <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>
                Correct Answer for Statement
              </label>
              <div style={{ display: "flex", gap: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#059669" }}>
                  <input
                    type="radio"
                    name="tf_answer"
                    value="true"
                    checked={trueFalseAnswer === "true"}
                    onChange={(e) => setTrueFalseAnswer(e.target.value)}
                  />
                  TRUE
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#dc2626" }}>
                  <input
                    type="radio"
                    name="tf_answer"
                    value="false"
                    checked={trueFalseAnswer === "false"}
                    onChange={(e) => setTrueFalseAnswer(e.target.value)}
                  />
                  FALSE
                </label>
              </div>
            </div>
          ) : type === "match_following" ? (
            <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Column A and Column B Pairs
                </label>
                <button
                  type="button"
                  onClick={() => setMatchPairs([...matchPairs, { id: String(matchPairs.length + 1), left: "", right: "" }])}
                  style={{ padding: "4px 8px", background: "var(--accent-blue)", color: "#fff", borderRadius: "4px", fontSize: "11px", border: "none", cursor: "pointer" }}
                >
                  ＋ Add Pair
                </button>
              </div>
              {matchPairs.map((pair, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", width: "20px", color: "var(--text-secondary)" }}>{idx + 1}.</span>
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => {
                      const updated = [...matchPairs];
                      updated[idx].left = e.target.value;
                      setMatchPairs(updated);
                    }}
                    placeholder={`Column A #${idx + 1}`}
                    style={{ flex: 1, padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>➔</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => {
                      const updated = [...matchPairs];
                      updated[idx].right = e.target.value;
                      setMatchPairs(updated);
                    }}
                    placeholder={`Matches Column B`}
                    style={{ flex: 1, padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}
                  />
                  {matchPairs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setMatchPairs(matchPairs.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px" }}
                    >
                      
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : type === "crossword" ? (
            <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Crossword Clues & Solution Words
                </label>
                <button
                  type="button"
                  onClick={() => setCrosswordClues([...crosswordClues, { id: String(crosswordClues.length + 1), direction: "across", clue: "", answer: "", row: 0, col: 0 }])}
                  style={{ padding: "4px 8px", background: "var(--accent-blue)", color: "#fff", borderRadius: "4px", fontSize: "11px", border: "none", cursor: "pointer" }}
                >
                  ＋ Add Clue
                </button>
              </div>
              {crosswordClues.map((c, idx) => (
                <div key={idx} style={{ background: "var(--bg-surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      value={c.direction}
                      onChange={(e) => {
                        const updated = [...crosswordClues];
                        updated[idx].direction = e.target.value;
                        setCrosswordClues(updated);
                      }}
                      style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "12px", background: "var(--bg-secondary)" }}
                    >
                      <option value="across">Across</option>
                      <option value="down">Down</option>
                    </select>
                    <input
                      type="text"
                      value={c.answer}
                      onChange={(e) => {
                        const updated = [...crosswordClues];
                        updated[idx].answer = e.target.value.toUpperCase();
                        setCrosswordClues(updated);
                      }}
                      placeholder="ANSWER WORD"
                      style={{ width: "140px", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Row:</span>
                    <input
                      type="number"
                      value={c.row}
                      onChange={(e) => {
                        const updated = [...crosswordClues];
                        updated[idx].row = e.target.value;
                        setCrosswordClues(updated);
                      }}
                      style={{ width: "50px", padding: "4px 6px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "11px" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Col:</span>
                    <input
                      type="number"
                      value={c.col}
                      onChange={(e) => {
                        const updated = [...crosswordClues];
                        updated[idx].col = e.target.value;
                        setCrosswordClues(updated);
                      }}
                      style={{ width: "50px", padding: "4px 6px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "11px" }}
                    />
                    {crosswordClues.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCrosswordClues(crosswordClues.filter((_, i) => i !== idx))}
                        style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "13px" }}
                      >
                        
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={c.clue}
                    onChange={(e) => {
                      const updated = [...crosswordClues];
                      updated[idx].clue = e.target.value;
                      setCrosswordClues(updated);
                    }}
                    placeholder={`Clue prompt (e.g. Organelle generating cellular ATP)`}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                  />
                </div>
              ))}
            </div>
          ) : type === "coding" ? (
            /* Coding & Algorithm Problem Configuration */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--bg-secondary)", padding: "18px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                   Multi-Language Starter Code Templates
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {["python", "javascript", "cpp", "java"].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setCodingActiveLang(l)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        background: codingActiveLang === l ? "var(--accent-blue)" : "#ffffff",
                        color: codingActiveLang === l ? "#ffffff" : "var(--text-secondary)",
                        border: codingActiveLang === l ? "none" : "1px solid var(--border-subtle)"
                      }}
                    >
                      {l === "cpp" ? "C++17" : l === "javascript" ? "JS Node" : l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Initial starter code presented to candidate for <strong>{codingActiveLang.toUpperCase()}</strong>:
                </span>
                <textarea
                  rows={6}
                  value={codingStarterCode[codingActiveLang] || ""}
                  onChange={(e) => setCodingStarterCode({ ...codingStarterCode, [codingActiveLang]: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    background: "#0f172a",
                    color: "#38bdf8",
                    borderRadius: "6px",
                    border: "1px solid #1e293b",
                    lineHeight: "1.4"
                  }}
                />
              </div>

              {/* Execution Constraints */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Time Limit (Seconds)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10.0"
                    value={codingTimeLimit}
                    onChange={(e) => setCodingTimeLimit(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Memory Limit (MB)
                  </label>
                  <input
                    type="number"
                    value={codingMemoryLimit}
                    onChange={(e) => setCodingMemoryLimit(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "12px" }}
                  />
                </div>
              </div>

              {/* Automated Test Cases */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
                    Automated Test Cases ({codingTestCases.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setCodingTestCases([
                      ...codingTestCases,
                      { id: String(codingTestCases.length + 1), input: "", expected_output: "", is_hidden: true, explanation: "" }
                    ])}
                    style={{ background: "none", border: "none", color: "var(--accent-blue)", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    + Add Test Case
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {codingTestCases.map((tc, idx) => (
                    <div key={idx} style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700" }}>Test Case #{idx + 1}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={tc.is_hidden}
                              onChange={(e) => {
                                const updated = [...codingTestCases];
                                updated[idx].is_hidden = e.target.checked;
                                setCodingTestCases(updated);
                              }}
                            />
                            Hidden Evaluation Case (Not visible to student)
                          </label>
                          {codingTestCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCodingTestCases(codingTestCases.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}
                            >
                              
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>Input (stdin)</span>
                          <textarea
                            rows={3}
                            value={tc.input}
                            onChange={(e) => {
                              const updated = [...codingTestCases];
                              updated[idx].input = e.target.value;
                              setCodingTestCases(updated);
                            }}
                            placeholder="e.g. 5 7"
                            style={{ width: "100%", padding: "6px", fontFamily: "monospace", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>Expected Output (stdout)</span>
                          <textarea
                            rows={3}
                            value={tc.expected_output}
                            onChange={(e) => {
                              const updated = [...codingTestCases];
                              updated[idx].expected_output = e.target.value;
                              setCodingTestCases(updated);
                            }}
                            placeholder="e.g. 12"
                            style={{ width: "100%", padding: "6px", fontFamily: "monospace", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>
                      </div>

                      {!tc.is_hidden && (
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>Sample Explanation (Optional)</span>
                          <input
                            type="text"
                            value={tc.explanation || ""}
                            onChange={(e) => {
                              const updated = [...codingTestCases];
                              updated[idx].explanation = e.target.value;
                              setCodingTestCases(updated);
                            }}
                            placeholder="e.g. Explanation: 5 + 7 equals 12"
                            style={{ width: "100%", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
