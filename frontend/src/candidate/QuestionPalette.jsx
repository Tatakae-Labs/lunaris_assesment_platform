import React from "react";

export default function QuestionPalette({
  questions,
  currentIndex,
  onSelectIndex,
  questionStates, // { [qId]: 'unvisited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked' }
  activeSubject
}) {
  // Filter questions for the current subject
  const subjectQuestions = questions
    .map((q, idx) => ({ ...q, originalIndex: idx }))
    .filter((q) => q.subject === activeSubject);

  const stats = {
    unvisited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0
  };

  questions.forEach((q) => {
    const s = questionStates[q.id] || "unvisited";
    stats[s] = (stats[s] || 0) + 1;
  });

  function getBadgeStyle(state) {
    switch (state) {
      case "answered":
        return { background: "#16a34a", color: "#fff", clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)" };
      case "not_answered":
        return { background: "#dc2626", color: "#fff", clipPath: "polygon(50% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%)" };
      case "marked":
        return { background: "#9333ea", color: "#fff", borderRadius: "50%" };
      case "answered_marked":
        return { background: "#7e22ce", color: "#fff", borderRadius: "50%", border: "2px solid #22c55e" };
      default:
        return { background: "#475569", color: "#e2e8f0", borderRadius: "4px" };
    }
  }

  return (
    <div style={{
      width: "320px",
      background: "#0f172a",
      borderLeft: "1px solid #1e293b",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "16px",
      userSelect: "none"
    }}>
      {/* Legend Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px",
        paddingBottom: "14px",
        borderBottom: "1px solid #1e293b",
        fontSize: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", ...getBadgeStyle("answered") }}>
            {stats.answered}
          </span>
          <span>Answered</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", ...getBadgeStyle("not_answered") }}>
            {stats.not_answered}
          </span>
          <span>Not Answered</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", ...getBadgeStyle("unvisited") }}>
            {stats.unvisited}
          </span>
          <span>Not Visited</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", ...getBadgeStyle("marked") }}>
            {stats.marked}
          </span>
          <span>Marked for Review</span>
        </div>
        <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
          <span style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", ...getBadgeStyle("answered_marked") }}>
            {stats.answered_marked}
          </span>
          <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Answered & Marked for Review (Evaluated)</span>
        </div>
      </div>

      {/* Section Title */}
      <div style={{ marginTop: "14px", marginBottom: "8px" }}>
        <h4 style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#38bdf8" }}>
          {activeSubject} Section Palette
        </h4>
      </div>

      {/* Question Number Tiles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "10px",
        overflowY: "auto",
        padding: "8px 2px",
        flex: 1
      }}>
        {subjectQuestions.map((q, localIdx) => {
          const state = questionStates[q.id] || "unvisited";
          const isSelected = q.originalIndex === currentIndex;

          return (
            <button
              key={q.id}
              onClick={() => onSelectIndex(q.originalIndex)}
              style={{
                height: "44px",
                fontSize: "14px",
                fontWeight: "bold",
                display: "grid",
                placeItems: "center",
                transition: "transform 0.1s, box-shadow 0.1s",
                boxShadow: isSelected ? "0 0 0 3px #38bdf8" : "none",
                ...getBadgeStyle(state)
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {localIdx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
