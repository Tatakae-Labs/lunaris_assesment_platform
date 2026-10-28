import React from "react";

export default function NumericalKeypad({ value, onChange, onClear, onBackspace }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "-"];

  return (
    <div style={{
      maxWidth: "320px",
      padding: "16px",
      background: "#1e293b",
      borderRadius: "8px",
      border: "1px solid #334155"
    }}>
      <div style={{
        marginBottom: "12px",
        padding: "10px 14px",
        background: "#0f172a",
        borderRadius: "6px",
        border: "1px solid #475569",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>Numerical Answer:</span>
        <span style={{ fontSize: "18px", fontWeight: "bold", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
          {value || "0"}
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "8px"
      }}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange((value || "") + k)}
            style={{
              padding: "12px",
              background: "#334155",
              color: "#f8fafc",
              fontSize: "16px",
              fontWeight: "600",
              borderRadius: "6px",
              transition: "background 0.15s"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "#475569"}
            onMouseOut={(e) => e.currentTarget.style.background = "#334155"}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button
          type="button"
          onClick={onBackspace}
          style={{
            flex: 1,
            padding: "10px",
            background: "#dc2626",
            color: "#ffffff",
            fontWeight: "600",
            borderRadius: "6px"
          }}
        >
          Backspace
        </button>
        <button
          type="button"
          onClick={onClear}
          style={{
            flex: 1,
            padding: "10px",
            background: "#475569",
            color: "#ffffff",
            fontWeight: "600",
            borderRadius: "6px"
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
