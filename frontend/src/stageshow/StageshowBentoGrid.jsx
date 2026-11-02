import React, { useState } from "react";

/**
 * Stageshow-grade Bento Grid
 * Follows the Stageshow golden rule:
 * "Only a third to a half of the tiles show UI, window chrome appears once,
 * and no tile sits next to another of the same kind:
 * One window, a stat on the dark tile, a card as an object, one control and a diagram."
 */
export default function StageshowBentoGrid() {
  const [activeMode, setActiveMode] = useState("proctored_cbt");
  const [selectedQ, setSelectedQ] = useState(4);
  const [telemetryPulse, setTelemetryPulse] = useState(true);

  return (
    <section style={{ padding: "60px 24px", maxWidth: "1180px", margin: "0 auto" }}>
      {/* Section Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(37, 99, 235, 0.08)",
            color: "#2563eb",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.5px",
            marginBottom: "12px"
          }}
        >
          <span></span> STAGESHOW ARCHITECTURE GRID
        </div>
        <h2
          style={{
            fontSize: "34px",
            fontWeight: "900",
            letterSpacing: "-0.6px",
            color: "#0f172a",
            lineHeight: "1.2"
          }}
        >
          Engineered for High-Stakes Integrity & Zero Friction
        </h2>
        <p style={{ color: "#64748b", fontSize: "15px", marginTop: "8px", maxWidth: "640px", margin: "8px auto 0" }}>
          Everything you need to deliver institutional-grade computer-based assessments, automatic grading, and AI integrity monitoring.
        </p>
      </div>

      {/* Bento Grid (CSS Grid with distinct tile types) */}
      <div
        className="stageshow-bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gridAutoRows: "minmax(180px, auto)",
          gap: "20px"
        }}
      >
        {/* TILE 1: THE ONE WINDOW (CBT Solver, cropped and running off bottom-right edge) */}
        {/* Spans 8 cols, 2 rows */}
        <div
          className="dash-card stageshow-bento-tile"
          style={{
            gridColumn: "span 8",
            gridRow: "span 2",
            background: "#ffffff",
            padding: "28px 28px 0 28px",
            borderRadius: "16px",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ marginBottom: "16px", zIndex: 2 }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "#2563eb",
                background: "#eff6ff",
                padding: "3px 8px",
                borderRadius: "4px"
              }}
            >
              SPECIALIZED CBT INTERFACE
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginTop: "6px" }}>
              Specialized Computer-Based Assessment Runner
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "520px", marginTop: "4px" }}>
              Accurate 5-color question palettes, question status legends, and sectional locks that candidates already trust.
            </p>
          </div>

          {/* The cropped window running off the bottom-right edge */}
          <div
            style={{
              flex: 1,
              background: "#0a0f1d",
              borderTop: "1px solid #1e293b",
              borderLeft: "1px solid #1e293b",
              borderTopLeftRadius: "12px",
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              marginTop: "8px",
              marginRight: "-28px",
              marginBottom: "-1px"
            }}
          >
            {/* Mini window chrome */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "10px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f56" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ffbd2e" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#27c93f" }} />
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#38bdf8", fontWeight: "700" }}>
                SECTION: MATHEMATICS (Q{selectedQ} OF 30)
              </span>
              <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                02:45:12 REMAINING
              </span>
            </div>

            {/* Split: Question on Left, 5-Color Matrix on Right */}
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc", marginBottom: "10px" }}>
                  Let f(x) = ∫₀ˣ (t² - 3t + 2) dt. Find the local maxima and minima points:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    "Maxima at x = 1, Minima at x = 2",
                    "Maxima at x = 2, Minima at x = 1",
                    "No extremum in real domain",
                    "Inflection at x = 1.5 only"
                  ].map((ans, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px 10px",
                        background: i === 0 ? "rgba(59, 130, 246, 0.16)" : "#0f172a",
                        border: i === 0 ? "1px solid #3b82f6" : "1px solid #1e293b",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: i === 0 ? "#ffffff" : "#cbd5e1",
                        fontWeight: i === 0 ? "700" : "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: i === 0 ? "#38bdf8" : "#475569" }} />
                      {ans}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini Interactive Palette */}
              <div style={{ width: "150px", background: "#0b1329", padding: "10px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", marginBottom: "6px" }}>
                  PALETTE (CLICK TO JUMP)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
                    let bg = "#334155";
                    let c = "#f8fafc";
                    if (n === 1 || n === 2) { bg = "#16a34a"; }
                    else if (n === 3) { bg = "#dc2626"; }
                    else if (n === 4) { bg = "#9333ea"; }
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSelectedQ(n)}
                        style={{
                          height: "22px",
                          borderRadius: "3px",
                          background: selectedQ === n ? "#2563eb" : bg,
                          color: c,
                          fontSize: "10px",
                          fontWeight: "700",
                          border: selectedQ === n ? "1px solid #38bdf8" : "none",
                          cursor: "pointer"
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TILE 2: THE ROLLING STAT (High contrast dark tile) */}
        {/* Spans 4 cols */}
        <div
          className="stageshow-bento-tile"
          style={{
            gridColumn: "span 4",
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
            border: "1px solid #1e293b"
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", letterSpacing: "0.5px" }}>
              ENTERPRISE RELIABILITY
            </div>
            <div
              style={{
                fontSize: "44px",
                fontWeight: "900",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                color: "#38bdf8",
                marginTop: "8px",
                lineHeight: "1"
              }}
            >
              99.99%
            </div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", marginTop: "8px" }}>
              Server Authoritative Clock Sync
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.5" }}>
              Zero clock-skew vulnerability. Answers and incident timestamps sync seamlessly even under packet loss or reconnection.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", borderTop: "1px solid #1e293b", paddingTop: "14px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span style={{ fontSize: "11px", color: "#cbd5e1" }}>45ms Round-Trip Telemetry Heartbeat</span>
          </div>
        </div>

        {/* TILE 3: THE PHYSICAL OBJECT (Candidate Access Pass card with seal & barcode) */}
        {/* Spans 4 cols */}
        <div
          className="dash-card stageshow-bento-tile"
          style={{
            gridColumn: "span 4",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid #e2e8f0",
            position: "relative"
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "10px", fontWeight: "800", color: "#2563eb", background: "#eff6ff", padding: "3px 8px", borderRadius: "4px" }}>
                ZERO-FRICTION JOIN
              </span>
              <span style={{ fontSize: "12px" }}></span>
            </div>
            <h4 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
              Candidate Pass System
            </h4>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              Students enter using ephemeral UIDs and PINs. No Google or platform sign-up needed.
            </p>

            {/* Visual Physical Pass Badge */}
            <div
              style={{
                marginTop: "16px",
                background: "#f8fafc",
                border: "1.5px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "12px 14px",
                fontFamily: "var(--font-mono)"
              }}
            >
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>CANDIDATE PASS</div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b" }}>UID: LN-2026-9812</div>
              <div style={{ fontSize: "11px", color: "#059669", fontWeight: "700", marginTop: "2px" }}>
                PASSCODE: 8492
              </div>
              <div style={{ fontSize: "9px", color: "#64748b", marginTop: "6px" }}>
                |||| | |||||| || ||||| | ||| ||
              </div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: "700", marginTop: "12px" }}>
            PDF Roster Auto-Generated →
          </div>
        </div>

        {/* TILE 4: THE DIAGRAM (MediaPipe On-Device Vision Radar) */}
        {/* Spans 4 cols */}
        <div
          className="dash-card stageshow-bento-tile"
          style={{
            gridColumn: "span 4",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #e2e8f0",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "10px", fontWeight: "800", color: "#059669", background: "#ecfdf5", padding: "3px 8px", borderRadius: "4px" }}>
              AI VISION TELEMETRY
            </span>
            <span style={{ fontSize: "12px" }}></span>
          </div>

          <h4 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
            On-Device MediaPipe
          </h4>
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", marginBottom: "16px" }}>
            Runs inside the candidate's browser. Zero video stream bandwidth cost.
          </p>

          {/* Interactive Radar Diagram */}
          <div
            style={{
              flex: 1,
              background: "#0f172a",
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {/* Radar Circle */}
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                border: "1px solid rgba(52, 211, 153, 0.4)",
                display: "grid",
                placeItems: "center",
                position: "relative"
              }}
            >
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", border: "1px dashed rgba(52, 211, 153, 0.6)" }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "12px", fontSize: "10px", color: "#34d399", fontFamily: "var(--font-mono)" }}>
              <span>Face: PRESENT</span>
              <span>•</span>
              <span>Gaze: CENTER</span>
            </div>
          </div>
        </div>

        {/* TILE 5: THE INTERACTIVE CONTROL (3-Mode Assessment Engine Switcher) */}
        {/* Spans 4 cols */}
        <div
          className="dash-card stageshow-bento-tile"
          style={{
            gridColumn: "span 4",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #e2e8f0"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "10px", fontWeight: "800", color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: "4px" }}>
              ASSESSMENT VERSATILITY
            </span>
            <span style={{ fontSize: "12px" }}></span>
          </div>

          <h4 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
            Three Native Exam Engines
          </h4>
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", marginBottom: "14px" }}>
            Choose the strictness and atmosphere required for your batch:
          </p>

          {/* Interactive Switcher Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { id: "proctored_cbt", title: "Proctored Assessment", badge: "Institutional CBT", icon: "" },
              { id: "quick_quiz", title: "Quick Quiz Arena", badge: "Kahoot Speed", icon: "" },
              { id: "standard_quiz", title: "Standard Practice", badge: "Self-Paced Check", icon: "" }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMode(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: activeMode === m.id ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                  background: activeMode === m.id ? "#eff6ff" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: activeMode === m.id ? "#1d4ed8" : "#1e293b" }}>
                      {m.title}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "10px", color: activeMode === m.id ? "#2563eb" : "#64748b", fontWeight: "600" }}>
                  {m.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

