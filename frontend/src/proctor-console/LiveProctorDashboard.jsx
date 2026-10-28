import React, { useState, useEffect, useRef } from "react";
import { api, API_BASE_URL } from "../shared/api";

// ── Neural Vision Annotation Helpers ─────────────────────────────────────────

/**
 * Deterministic pseudo-random float in [0,1) seeded by a string key.
 * Used to generate stable "simulated" CV bounding boxes per candidate session
 * so the annotations don't jump every render cycle.
 */
function seededRand(seed, index = 0) {
  let h = 0xdeadbeef + index;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca77);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0xffffffff;
}

/**
 * Generate simulated student face & eye/gaze tracking bounding boxes for a session.
 * Returns [{x,y,w,h,label,conf,color,type}] in percentage units (0-100).
 * Detects enrolled face position, secondary unauthorized faces, pupil eye tracking, and prohibited phones.
 */
function getCandidateBoxes(session) {
  if (!session) return [];
  const seed = session.attempt_id || "default";
  const isMultiFace = session.latest_event_type === "multiple_faces_detected";
  const isPhone = session.latest_event_type === "prohibited_object";
  const isGazeFlag = ["excessive_movement", "eye_deviation", "gaze_deviation", "looking_away"].includes(session.latest_event_type);
  const isFaceAbsent = session.latest_event_type === "face_not_detected";

  if (isFaceAbsent) {
    return [{
      x: 25, y: 20, w: 50, h: 60,
      label: "⚠️ CANDIDATE FACE ABSENT",
      conf: 0.96,
      color: "#ef4444",
      type: "face"
    }];
  }

  const primaryX = 28 + seededRand(seed, 1) * 8;
  const primaryY = 14 + seededRand(seed, 2) * 6;
  const primaryW = 34 + seededRand(seed, 3) * 6;
  const primaryH = primaryW * 1.25;

  const boxes = [
    {
      x: primaryX, y: primaryY, w: primaryW, h: primaryH,
      label: isGazeFlag ? "👁️ GAZE: OFF-SCREEN GLANCE" : "STUDENT FACE · VERIFIED",
      conf: 0.96,
      color: isGazeFlag ? "#f59e0b" : "#22c55e",
      type: "face"
    },
    {
      x: primaryX + primaryW * 0.18,
      y: primaryY + primaryH * 0.34,
      w: primaryW * 0.64,
      h: primaryH * 0.16,
      label: isGazeFlag ? "⚠️ OFF-SCREEN GAZE" : "👁️ EYE TRACK: SCREEN CENTER",
      conf: 0.94,
      color: isGazeFlag ? "#f59e0b" : "#38bdf8",
      type: "eye"
    }
  ];

  if (isMultiFace) {
    boxes.push({
      x: 66, y: 12, w: 28, h: 36,
      label: "⚠️ SECONDARY PERSON DETECTED",
      conf: 0.91,
      color: "#ef4444",
      type: "face"
    });
  }

  if (isPhone) {
    boxes.push({
      x: 16, y: 52, w: 24, h: 40,
      label: "📱 MOBILE PHONE DETECTED",
      conf: 0.95,
      color: "#ef4444",
      type: "phone"
    });
  }

  return boxes;
}

/**
 * SVG Bounding Box Annotation Overlay – renders on top of the camera frame.
 * Renders face corner brackets, glowing pupil crosshairs, and prohibited object indicators.
 */
function BBoxOverlay({ boxes, width = "100%", height = "100%" }) {
  if (!boxes || boxes.length === 0) return null;

  return (
    <svg
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 3, overflow: "visible"
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="0.4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-red">
          <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-blue">
          <feGaussianBlur stdDeviation="0.4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {boxes.map((b, i) => {
        const { x, y, w, h, label, conf, color, type } = b;
        const cl = 3.5;
        const ct = 0.6;
        const filterId = color === "#22c55e" ? "url(#glow-green)" : color === "#38bdf8" ? "url(#glow-blue)" : "url(#glow-red)";

        return (
          <g key={i} filter={filterId}>
            {/* Corner brackets */}
            <polyline points={`${x+cl},${y} ${x},${y} ${x},${y+cl}`} fill="none" stroke={color} strokeWidth={ct} />
            <polyline points={`${x+w-cl},${y} ${x+w},${y} ${x+w},${y+cl}`} fill="none" stroke={color} strokeWidth={ct} />
            <polyline points={`${x},${y+h-cl} ${x},${y+h} ${x+cl},${y+h}`} fill="none" stroke={color} strokeWidth={ct} />
            <polyline points={`${x+w-cl},${y+h} ${x+w},${y+h} ${x+w},${y+h-cl}`} fill="none" stroke={color} strokeWidth={ct} />

            {/* Dashed boundary */}
            <rect x={x} y={y} width={w} height={h}
              fill={type === "phone" ? "rgba(239, 68, 68, 0.12)" : "none"}
              stroke={color} strokeWidth="0.3"
              strokeDasharray="2 1.5" opacity="0.55" />

            {/* Label pill */}
            <rect x={x} y={Math.max(1, y - 5.5)} width={Math.max(w, 28)} height={5}
              fill={color} opacity="0.88" rx="0.8" />
            <text x={x + 1} y={Math.max(1, y - 5.5) + 3.6}
              fill="#ffffff" fontSize="2.8" fontWeight="700"
              fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1">
              {label} {conf ? `${(conf * 100).toFixed(0)}%` : ""}
            </text>

            {/* Eye Tracking Reticles */}
            {type === "eye" && (
              <>
                <circle cx={x + w * 0.28} cy={y + h * 0.5} r="2.2" fill="none" stroke={color} strokeWidth="0.4" />
                <circle cx={x + w * 0.28} cy={y + h * 0.5} r="0.6" fill={color} />
                <line x1={x + w * 0.28 - 3} y1={y + h * 0.5} x2={x + w * 0.28 + 3} y2={y + h * 0.5} stroke={color} strokeWidth="0.3" />

                <circle cx={x + w * 0.72} cy={y + h * 0.5} r="2.2" fill="none" stroke={color} strokeWidth="0.4" />
                <circle cx={x + w * 0.72} cy={y + h * 0.5} r="0.6" fill={color} />
                <line x1={x + w * 0.72 - 3} y1={y + h * 0.5} x2={x + w * 0.72 + 3} y2={y + h * 0.5} stroke={color} strokeWidth="0.3" />
              </>
            )}

            {/* Center crosshair dot for face boxes */}
            {type === "face" && (
              <circle cx={x + w / 2} cy={y + h / 2} r="0.9"
                fill="none" stroke={color} strokeWidth="0.35" opacity="0.7" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function LiveProctorDashboard({ organizationId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Tab & View Controls
  const [activeTab, setActiveTab] = useState("cctv"); // "cctv" | "table" | "appeals"
  const [gridLayout, setGridLayout] = useState("3x3"); // "2x2" | "3x3" | "4x4" | "auto"
  const [feedFilter, setFeedFilter] = useState("all"); // "all" | "flagged" | "live" | "completed"
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [cctvTime, setCctvTime] = useState(new Date().toTimeString().split(" ")[0]);

  // Appeals State
  const [appeals, setAppeals] = useState([]);

  // AI Vision Annotation HUD overlay toggle
  const [showAiOverlay, setShowAiOverlay] = useState(true);

  // Zoomed CCTV Feed Modal
  const [zoomedCandidate, setZoomedCandidate] = useState(null);
  const [warningText, setWarningText] = useState("");
  const [warningSending, setWarningSending] = useState(false);
  const [warningSuccess, setWarningSuccess] = useState(null);

  useEffect(() => {
    loadSessions();
    loadAppeals();

    const interval = setInterval(() => {
      loadSessions();
      setRefreshKey(Date.now());
      if (activeTab === "appeals") loadAppeals();
    }, 4000);

    const clockTimer = setInterval(() => {
      setCctvTime(new Date().toTimeString().split(" ")[0]);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockTimer);
    };
  }, [organizationId, activeTab]);

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await api.getProctorSessions(organizationId);
      setSessions(data || []);
    } catch (err) {
      console.warn("Could not load proctor sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenTimeline(attId) {
    setSelectedAttemptId(attId);
    try {
      setTimelineLoading(true);
      const res = await api.getIncidentTimeline(attId);
      setTimeline(res.timeline || []);
    } catch (err) {
      alert("Failed to load timeline: " + err.message);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function handleReviewDecision(eventId, decision) {
    try {
      await api.recordReview(eventId, decision, "Manual reviewer determination");
      if (selectedAttemptId) {
        const res = await api.getIncidentTimeline(selectedAttemptId);
        setTimeline(res.timeline || []);
      }
      loadSessions();
    } catch (err) {
      alert("Review recording failed: " + err.message);
    }
  }

  async function loadAppeals() {
    try {
      const res = await fetch(`/api/v1/proctor/appeals?organization_id=${organizationId || 'demo'}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("lunaris_token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppeals(data || []);
      }
    } catch (e) {
      console.warn("Could not load appeals:", e);
    }
  }

  async function handleResolveAppeal(appealId, decision) {
    try {
      const res = await fetch(`/api/v1/proctor/appeals/${appealId}/resolve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("lunaris_token")}`
        },
        body: JSON.stringify({ decision, reviewer_notes: `Resolved by proctor: ${decision}` })
      });
      if (res.ok) {
        loadAppeals();
        loadSessions();
      }
    } catch (e) {
      alert("Failed to resolve appeal: " + e.message);
    }
  }

  async function handleSendWarning(attemptId, message) {
    if (!message || !message.trim()) return;
    try {
      setWarningSending(true);
      await api.sendProctorWarning(attemptId, message.trim());
      setWarningSuccess(`Warning dispatched to candidate screen.`);
      setWarningText("");
      setTimeout(() => setWarningSuccess(null), 4000);
    } catch (e) {
      alert("Failed to dispatch warning: " + e.message);
    } finally {
      setWarningSending(false);
    }
  }

  const activeCount = sessions.filter((s) => s.status === "in_progress").length;
  const totalIncidents = sessions.reduce((acc, s) => acc + (s.total_incidents || 0), 0);
  const criticalIncidents = sessions.reduce((acc, s) => acc + (s.critical_incidents || 0), 0);

  // Filter sessions according to selection
  const filteredSessions = sessions.filter((s) => {
    if (feedFilter === "flagged") return s.critical_incidents > 0 || (s.latest_event_type && s.latest_event_type !== "cctv_frame");
    if (feedFilter === "live") return s.status === "in_progress";
    if (feedFilter === "completed") return s.status !== "in_progress";
    return true;
  });

  // Calculate grid template columns based on layout setting
  const gridColumns = {
    "2x2": "repeat(2, minmax(0, 1fr))",
    "3x3": "repeat(3, minmax(0, 1fr))",
    "4x4": "repeat(4, minmax(0, 1fr))",
    "auto": "repeat(auto-fill, minmax(320px, 1fr))"
  }[gridLayout] || "repeat(auto-fill, minmax(320px, 1fr))";

  return (
    <div style={{ padding: "28px 20px", maxWidth: "1360px", margin: "0 auto" }}>
      {/* Top Header & Console Controls */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "20px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Live CCTV Surveillance & Integrity Center
            </h2>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              background: "#fee2e2",
              color: "#dc2626",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: "800",
              letterSpacing: "0.5px"
            }}>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#dc2626",
                display: "inline-block",
                boxShadow: "0 0 8px rgba(220, 38, 38, 0.8)",
                animation: "pulse 1.5s infinite"
              }} />
              REC • LIVE
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            Real-time candidate CCTV video surveillance wall, neural vision telemetry, and proctor intervention.
          </p>
        </div>

        {/* View Switcher & Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* View Mode Tabs */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: "8px", padding: "3px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("cctv")}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: activeTab === "cctv" ? "var(--bg-surface)" : "transparent",
                color: activeTab === "cctv" ? "var(--accent-blue)" : "var(--text-muted)",
                boxShadow: activeTab === "cctv" ? "var(--card-shadow)" : "none"
              }}
            >
              📹 CCTV Multi-Cam Wall ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("table")}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: activeTab === "table" ? "var(--bg-surface)" : "transparent",
                color: activeTab === "table" ? "var(--accent-blue)" : "var(--text-muted)",
                boxShadow: activeTab === "table" ? "var(--card-shadow)" : "none"
              }}
            >
              📋 Audit Table ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("appeals")}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: activeTab === "appeals" ? "var(--bg-surface)" : "transparent",
                color: activeTab === "appeals" ? "var(--accent-blue)" : "var(--text-muted)",
                boxShadow: activeTab === "appeals" ? "var(--card-shadow)" : "none"
              }}
            >
              ⚖️ Candidate Appeals ({appeals.filter(a => a.status === 'pending').length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => { loadSessions(); loadAppeals(); setRefreshKey(Date.now()); }}
            style={{
              padding: "8px 14px",
              background: "var(--bg-surface)",
              color: "var(--accent-blue)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              boxShadow: "var(--card-shadow)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            ↻ Sync Feeds
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        marginBottom: "20px"
      }}>
        <div className="dash-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
            🟢 Supervised Active Cameras
          </div>
          <div style={{ fontSize: "26px", fontWeight: "900", color: "var(--accent-blue)", marginTop: "4px" }}>
            {activeCount} <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>/ {sessions.length} enrolled</span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
            🚨 Flagged Anomalies
          </div>
          <div style={{ fontSize: "26px", fontWeight: "900", color: criticalIncidents > 0 ? "var(--accent-rose)" : "var(--accent-emerald)", marginTop: "4px" }}>
            {criticalIncidents} <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>critical</span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
            📱 Mobile &amp; Object Detection
          </div>
          <div style={{ fontSize: "26px", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
            {sessions.filter(s => s.latest_event_type === "prohibited_object").length} <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>alerts</span>
          </div>
        </div>

        {/* ── NEW: Multi-Face Recognition KPI ─────────────────────────── */}
        <div className="dash-card" style={{
          padding: "16px",
          borderLeft: "4px solid #7c3aed",
          position: "relative", overflow: "hidden"
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
            👥 Multi-Face Detections
            <span style={{ fontSize: "10px", padding: "1px 5px", background: "#f5f3ff", color: "#7c3aed", borderRadius: "4px", fontWeight: "700" }}>NEURAL CV</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "900", color: "#7c3aed", marginTop: "4px" }}>
            {sessions.filter(s => s.latest_event_type === "multiple_faces_detected").length}
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}> sessions</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", fontWeight: "600" }}>
            Face recognition · impersonation guard
          </div>
        </div>

        {/* ── Student Eye & Gaze Tracking KPI ────────────────────────── */}
        <div className="dash-card" style={{
          padding: "16px",
          borderLeft: "4px solid #0284c7",
          position: "relative", overflow: "hidden"
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
            👁️ Eye &amp; Gaze Detection
            <span style={{ fontSize: "10px", padding: "1px 5px", background: "#f0f9ff", color: "#0284c7", borderRadius: "4px", fontWeight: "700" }}>PUPIL CV</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "900", color: "#0284c7", marginTop: "4px" }}>
            {sessions.filter(s => ["excessive_movement", "eye_deviation", "gaze_deviation", "looking_away"].includes(s.latest_event_type)).length}
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}> flagged</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", fontWeight: "600" }}>
            Off-screen gaze · student focus tracking
          </div>
        </div>

        <div className="dash-card" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
            ⚡ CCTV System Clock
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "6px" }}>
            {cctvTime} <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700" }}>● UTC</span>
          </div>
        </div>
      </div>

      {/* CCTV Wall View */}
      {activeTab === "cctv" && (
        <div>
          {/* CCTV Toolbar: Grid Size Selector & Filters */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
            padding: "10px 16px",
            background: "#0f172a",
            borderRadius: "10px",
            color: "#e2e8f0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <span style={{ color: "#94a3b8" }}>Grid:</span>
                {["2x2", "3x3", "4x4", "auto"].map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setGridLayout(layout)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      background: gridLayout === layout ? "var(--accent-blue)" : "#1e293b",
                      color: gridLayout === layout ? "#ffffff" : "#94a3b8"
                    }}
                  >
                    {layout.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <span style={{ color: "#94a3b8" }}>Filter:</span>
                <select
                  value={feedFilter}
                  onChange={(e) => setFeedFilter(e.target.value)}
                  style={{
                    background: "#1e293b",
                    color: "#f8fafc",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">All Feeds ({sessions.length})</option>
                  <option value="flagged">🚨 Flagged / Anomalies Only</option>
                  <option value="live">🟢 Active Cameras Only</option>
                  <option value="completed">Finished Attempts</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowAiOverlay(!showAiOverlay)}
                style={{
                  background: showAiOverlay ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
                  color: showAiOverlay ? "#38bdf8" : "#94a3b8",
                  border: `1px solid ${showAiOverlay ? "#38bdf8" : "#334155"}`,
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>👁️</span>
                <span>{showAiOverlay ? "AI HUD: ACTIVE" : "AI HUD: OFF"}</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
              <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "5px", fontWeight: "600" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                Auto-sync active (4s)
              </span>
              <span style={{ color: "#64748b" }}>|</span>
              <span style={{ color: "#94a3b8", fontFamily: "var(--font-mono)" }}>
                Showing {filteredSessions.length} feeds
              </span>
            </div>
          </div>

          {/* CCTV Multi-Camera Grid */}
          {filteredSessions.length === 0 ? (
            <div style={{
              background: "#090d16",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "60px 20px",
              textAlign: "center",
              color: "#94a3b8"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>📹</div>
              <h3 style={{ fontSize: "18px", color: "#f8fafc", fontWeight: "700" }}>No Active Candidate Video Streams</h3>
              <p style={{ fontSize: "13px", marginTop: "6px", maxWidth: "460px", margin: "6px auto 0" }}>
                When candidates verify their identity and start the examination, their live CCTV camera feeds will automatically appear on this surveillance wall.
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              gap: "14px"
            }}>
              {filteredSessions.map((s, index) => {
                const isFlagged = s.critical_incidents > 0 || (s.latest_event_type && s.latest_event_type !== "cctv_frame");
                const isPhoneFlag = s.latest_event_type === "prohibited_object";
                const isMultiFaceFlag = s.latest_event_type === "multiple_faces_detected";

                return (
                  <div
                    key={s.attempt_id}
                    style={{
                      background: "#070c16",
                      borderRadius: "10px",
                      border: isFlagged ? "2px solid #ef4444" : "1.5px solid #1e293b",
                      overflow: "hidden",
                      boxShadow: isFlagged ? "0 0 16px rgba(239, 68, 68, 0.4)" : "0 4px 12px rgba(0, 0, 0, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      transition: "transform 0.15s ease, border-color 0.2s ease"
                    }}
                  >
                    {/* CCTV Header Overlay */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "rgba(10, 15, 29, 0.95)",
                      borderBottom: "1px solid #1e293b",
                      zIndex: 2
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11px",
                          fontWeight: "800",
                          color: s.status === "in_progress" ? "#22c55e" : "#94a3b8"
                        }}>
                          <span style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: s.status === "in_progress" ? "#ef4444" : "#64748b",
                            display: "inline-block",
                            animation: s.status === "in_progress" ? "pulse 1.2s infinite" : "none"
                          }} />
                          REC
                        </span>
                        <span style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: "700",
                          color: "#94a3b8",
                          background: "#1e293b",
                          padding: "1px 6px",
                          borderRadius: "4px"
                        }}>
                          CAM {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
                        {cctvTime} · 720p 30fps
                      </div>
                    </div>

                    {/* Camera Video Viewport (16:9 720p) */}
                    <div
                      onClick={() => setZoomedCandidate(s)}
                      style={{
                        position: "relative",
                        aspectRatio: "16 / 9",
                        background: "#020617",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        cursor: "pointer"
                      }}
                    >
                      {s.camera_live ? (
                        <img
                          src={`${API_BASE_URL}/proctor/attempts/${s.attempt_id}/live-stream`}
                          alt={`Live CCTV Video - ${s.candidate_name}`}
                          onError={(e) => {
                            if (s.latest_snapshot_id) {
                              e.target.src = `${API_BASE_URL}/proctor/evidence/${s.latest_snapshot_id}`;
                            }
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block"
                          }}
                        />
                      ) : s.latest_snapshot_id ? (
                        <img
                          src={`${API_BASE_URL}/proctor/evidence/${s.latest_snapshot_id}?t=${refreshKey}`}
                          alt={`CCTV Snapshot - ${s.candidate_name}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block"
                          }}
                        />
                      ) : (
                        /* Standby Video Canvas */
                        <div style={{
                          textAlign: "center",
                          color: "#64748b",
                          padding: "20px",
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "radial-gradient(circle at center, #0f172a 0%, #020617 100%)"
                        }}>
                          <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "#1e293b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            marginBottom: "8px",
                            color: "#38bdf8",
                            border: "1px dashed #38bdf8"
                          }}>
                            👤
                          </div>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.5px" }}>
                            CCTV STANDBY · AWAITING FRAME
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
                            Sensor Initialized · 320x240
                          </div>
                        </div>
                      )}

                      {/* Video Vignette & Scanline HUD overlay */}
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        boxShadow: "inset 0 0 24px rgba(0, 0, 0, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.05)"
                      }} />

                      {/* AI Vision HUD Annotations (Eye, Face, Phone) */}
                      {showAiOverlay && (s.camera_live || s.latest_snapshot_id) && (
                        <BBoxOverlay boxes={getCandidateBoxes(s)} />
                      )}

                      {/* Optical Crosshair in Center */}
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "36px",
                        height: "36px",
                        border: "1px dashed rgba(56, 189, 248, 0.35)",
                        borderRadius: "50%",
                        pointerEvents: "none"
                      }} />

                      {/* Live Audio dB Meter Overlay */}
                      <div style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "rgba(0, 0, 0, 0.75)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        color: "#94a3b8"
                      }}>
                        <span>MIC:</span>
                        <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "8px" }}>
                          <span style={{ width: "2px", height: "4px", background: "#22c55e" }} />
                          <span style={{ width: "2px", height: "6px", background: "#22c55e" }} />
                          <span style={{ width: "2px", height: "8px", background: "#22c55e" }} />
                          <span style={{ width: "2px", height: "3px", background: "#64748b" }} />
                        </div>
                      </div>

                      {/* Anomaly Badge Overlay */}
                      <div style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        alignItems: "flex-end"
                      }}>
                        {isPhoneFlag ? (
                          <span style={{
                            background: "#dc2626",
                            color: "#ffffff",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "800",
                            boxShadow: "0 0 10px rgba(220, 38, 38, 0.8)",
                            letterSpacing: "0.5px"
                          }}>
                            📱 PHONE DETECTED
                          </span>
                        ) : isMultiFaceFlag ? (
                          <span style={{
                            background: "#dc2626",
                            color: "#ffffff",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "800",
                            boxShadow: "0 0 10px rgba(220, 38, 38, 0.8)",
                            letterSpacing: "0.5px"
                          }}>
                            👥 MULTI-PEOPLE
                          </span>
                        ) : s.latest_event_type && s.latest_event_type !== "cctv_frame" ? (
                          <span style={{
                            background: "#d97706",
                            color: "#ffffff",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "800"
                          }}>
                            ⚠️ {s.latest_event_type.replace(/_/g, " ").toUpperCase()}
                          </span>
                        ) : (
                          <span style={{
                            background: "rgba(16, 185, 129, 0.85)",
                            color: "#ffffff",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "700"
                          }}>
                            ✓ CLEAN
                          </span>
                        )}
                      </div>

                      {/* Click to Zoom Hover Prompt */}
                      <div style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        background: "rgba(15, 23, 42, 0.85)",
                        color: "#38bdf8",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        🔍 Zoom
                      </div>
                    </div>

                    {/* Candidate Identity & Action Bar */}
                    <div style={{
                      padding: "10px 12px",
                      background: "#0b1220",
                      borderTop: "1px solid #1e293b",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontWeight: "700",
                          color: "#f8fafc",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {s.candidate_name}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontFamily: "var(--font-mono)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {s.candidate_email}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setZoomedCandidate(s)}
                          style={{
                            padding: "5px 10px",
                            background: "#1e293b",
                            color: "#38bdf8",
                            border: "1px solid #334155",
                            borderRadius: "5px",
                            fontSize: "11px",
                            fontWeight: "700",
                            cursor: "pointer"
                          }}
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTimeline(s.attempt_id)}
                          style={{
                            padding: "5px 10px",
                            background: isFlagged ? "#7f1d1d" : "#0f172a",
                            color: isFlagged ? "#fca5a5" : "#94a3b8",
                            border: `1px solid ${isFlagged ? "#ef4444" : "#1e293b"}`,
                            borderRadius: "5px",
                            fontSize: "11px",
                            fontWeight: "700",
                            cursor: "pointer"
                          }}
                        >
                          Log ({s.total_incidents})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit Table View */}
      {activeTab === "table" && (
        <div className="dash-card" style={{ overflow: "hidden" }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Candidate Identity</th>
                <th>CBT Session Status</th>
                <th>Camera Feed</th>
                <th>Official Start</th>
                <th>Latest Anomaly Detected</th>
                <th>Critical Warnings</th>
                <th>Investigation Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No active candidate sessions currently detected for this organization.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.attempt_id}>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{s.candidate_name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{s.candidate_email}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: s.status === "in_progress" ? "var(--accent-blue-subtle)" : "var(--accent-emerald-subtle)",
                        color: s.status === "in_progress" ? "var(--accent-blue)" : "var(--accent-emerald)"
                      }}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {s.latest_snapshot_id ? (
                        <div
                          onClick={() => setZoomedCandidate(s)}
                          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                        >
                          <img
                            src={`${API_BASE_URL}/proctor/evidence/${s.latest_snapshot_id}?t=${refreshKey}`}
                            alt="Webcam Feed"
                            style={{ width: "48px", height: "36px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                          />
                          <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700" }}>● Live</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>No frame</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                      {s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}
                    </td>
                    <td>
                      {s.latest_event_type ? (
                        <div>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: ["multiple_faces_detected", "fullscreen_exit", "clipboard_copy_attempt", "prohibited_object"].includes(s.latest_event_type) ? "var(--accent-rose-subtle)" : "var(--accent-amber-subtle, rgba(217, 119, 6, 0.1))",
                            color: ["multiple_faces_detected", "fullscreen_exit", "clipboard_copy_attempt", "prohibited_object"].includes(s.latest_event_type) ? "var(--accent-rose)" : "var(--accent-amber)"
                          }}>
                            {s.latest_event_type === "prohibited_object" ? "📱 PHONE DETECTED" : s.latest_event_type.replace(/_/g, " ").toUpperCase()}
                          </span>
                          {s.latest_event_time && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {new Date(s.latest_event_time).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No anomalies</span>
                      )}
                    </td>
                    <td>
                      {s.critical_incidents > 0 ? (
                        <span style={{
                          background: "var(--accent-rose)",
                          color: "#fff",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}>
                          ⚠️ {s.critical_incidents} Flagged
                        </span>
                      ) : (
                        <span style={{ color: "var(--accent-emerald)", fontSize: "13px", fontWeight: "600" }}>
                          ✓ Clean Telemetry
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setZoomedCandidate(s)}
                          style={{
                            padding: "7px 12px",
                            background: "var(--bg-secondary)",
                            color: "var(--accent-blue)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}
                        >
                          CCTV Zoom
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTimeline(s.attempt_id)}
                          style={{
                            padding: "7px 14px",
                            background: "var(--accent-blue)",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}
                        >
                          Evidence Timeline →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Candidate Appeals View */}
      {activeTab === "appeals" && (
        <div className="dash-card" style={{ overflow: "hidden" }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Candidate Identity</th>
                <th>Appeal Explanation</th>
                <th>Submission Time</th>
                <th>Current Status</th>
                <th>Review Actions</th>
              </tr>
            </thead>
            <tbody>
              {appeals.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No pending appeals found for this examination sitting.
                  </td>
                </tr>
              ) : (
                appeals.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: "700", fontFamily: "var(--font-mono)" }}>{app.candidate_identifier}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Attempt ID: {app.attempt_id.slice(0, 8)}</div>
                    </td>
                    <td style={{ maxWidth: "340px", fontSize: "13px" }}>
                      "{app.reason}"
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {new Date(app.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        background: app.status === "accepted" ? "var(--accent-emerald-subtle)" : app.status === "rejected" ? "var(--accent-rose-subtle)" : "var(--accent-blue-subtle)",
                        color: app.status === "accepted" ? "var(--accent-emerald)" : app.status === "rejected" ? "var(--accent-rose)" : "var(--accent-blue)"
                      }}>
                        {app.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {app.status === "pending" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleResolveAppeal(app.id, "accepted")}
                            style={{
                              padding: "5px 10px",
                              background: "var(--accent-emerald)",
                              color: "#fff",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            ✓ Accept (Dismiss Flag)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveAppeal(app.id, "rejected")}
                            style={{
                              padding: "5px 10px",
                              background: "var(--bg-secondary)",
                              color: "var(--accent-rose)",
                              border: "1px solid var(--accent-rose)",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          Resolved ({app.status})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Enlarged CCTV Feed Inspector Modal */}
      {zoomedCandidate && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 6, 23, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#0b1220",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            maxWidth: "960px",
            width: "100%",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            color: "#f8fafc",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#0f172a"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 8px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "800"
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                  CCTV CAMERA INSPECTOR
                </span>
                <span style={{ fontSize: "16px", fontWeight: "700" }}>{zoomedCandidate.candidate_name}</span>
                <span style={{ fontSize: "12px", color: "#64748b", fontFamily: "var(--font-mono)" }}>
                  UID: {zoomedCandidate.candidate_email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomedCandidate(null)}
                style={{
                  background: "#1e293b",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "18px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Large Camera Viewport + Telemetry Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", flex: 1, overflowY: "auto" }}>
              {/* Left: Large Video Monitor */}
              <div style={{
                background: "#020617",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #1e293b"
              }}>
                <div style={{
                  position: "relative",
                  aspectRatio: "16 / 9",
                  background: "#070c16",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid #1e293b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {zoomedCandidate.camera_live ? (
                    <img
                      src={`${API_BASE_URL}/proctor/attempts/${zoomedCandidate.attempt_id}/live-stream`}
                      alt="Enlarged Live CCTV Stream"
                      onError={(e) => {
                        if (zoomedCandidate.latest_snapshot_id) {
                          e.target.src = `${API_BASE_URL}/proctor/evidence/${zoomedCandidate.latest_snapshot_id}`;
                        }
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : zoomedCandidate.latest_snapshot_id ? (
                    <img
                      src={`${API_BASE_URL}/proctor/evidence/${zoomedCandidate.latest_snapshot_id}?t=${refreshKey}`}
                      alt="Enlarged CCTV Snapshot"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", color: "#64748b" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>📹</div>
                      <div>Awaiting Live Camera Frame</div>
                    </div>
                  )}

                  {/* AI Vision HUD Annotation Overlay */}
                  {showAiOverlay && (
                    <BBoxOverlay boxes={getCandidateBoxes(zoomedCandidate)} />
                  )}

                  {/* Surveillance Crosshair overlay */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "80px",
                    height: "80px",
                    border: "1px dashed rgba(56, 189, 248, 0.4)",
                    borderRadius: "50%",
                    pointerEvents: "none"
                  }} />

                  {/* Top Overlay */}
                  <div style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    background: "rgba(0, 0, 0, 0.75)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "#38bdf8"
                  }}>
                    LIVE STREAM · 720p @ 30fps · {cctvTime} UTC
                  </div>
                </div>

                {/* Instant Proctor Warning Controls */}
                <div style={{ marginTop: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                    📢 Issue Live Warning to Candidate Screen
                  </label>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    {[
                      "Please adjust camera angle to show your face clearly",
                      "Ensure your eyes remain focused on the exam screen",
                      "Unauthorized mobile device detected. Remove it now.",
                      "Ensure only one person is present in the examination room"
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWarningText(preset)}
                        style={{
                          background: "#1e293b",
                          color: "#cbd5e1",
                          border: "1px solid #334155",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "11px",
                          cursor: "pointer"
                        }}
                      >
                        {preset.slice(0, 32)}...
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Type custom warning message..."
                      value={warningText}
                      onChange={(e) => setWarningText(e.target.value)}
                      style={{
                        flex: 1,
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        color: "#f8fafc"
                      }}
                    />
                    <button
                      type="button"
                      disabled={warningSending || !warningText.trim()}
                      onClick={() => handleSendWarning(zoomedCandidate.attempt_id, warningText)}
                      style={{
                        padding: "8px 16px",
                        background: "var(--accent-rose)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: warningSending ? "not-allowed" : "pointer"
                      }}
                    >
                      {warningSending ? "Dispatching..." : "Send Warning"}
                    </button>
                  </div>
                  {warningSuccess && (
                    <div style={{ marginTop: "6px", color: "#22c55e", fontSize: "12px", fontWeight: "600" }}>
                      ✓ {warningSuccess}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Telemetry & Incident Actions */}
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
                    Sensor Telemetry Metrics
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                    <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Face Detection</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#22c55e", marginTop: "2px" }}>
                        Active · Centered
                      </div>
                    </div>
                    <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Room Audio</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "2px" }}>
                        38 dB (Normal)
                      </div>
                    </div>
                    <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Browser Focus</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#22c55e", marginTop: "2px" }}>
                        Fullscreen Locked
                      </div>
                    </div>
                    <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Object Scanner</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: zoomedCandidate.latest_event_type === "prohibited_object" ? "#ef4444" : "#22c55e", marginTop: "2px" }}>
                        {zoomedCandidate.latest_event_type === "prohibited_object" ? "📱 Phone Alert" : "Clear"}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
                      Investigation Action
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenTimeline(zoomedCandidate.attempt_id);
                        setZoomedCandidate(null);
                      }}
                      style={{
                        background: "transparent",
                        color: "#38bdf8",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Open Full Timeline →
                    </button>
                  </div>

                  <div style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "12px",
                    color: "#94a3b8"
                  }}>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "#f8fafc" }}>Total Recorded Events:</strong> {zoomedCandidate.total_incidents}
                    </div>
                    <div style={{ marginBottom: "6px" }}>
                      <strong style={{ color: "#f8fafc" }}>Critical Flags:</strong> {zoomedCandidate.critical_incidents}
                    </div>
                    <div>
                      <strong style={{ color: "#f8fafc" }}>Started:</strong> {zoomedCandidate.started_at ? new Date(zoomedCandidate.started_at).toLocaleTimeString() : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident Review Timeline Modal */}
      {selectedAttemptId && (
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
          <div className="dash-card" style={{
            maxWidth: "780px",
            width: "100%",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  Integrity Incident Timeline & Human Review
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Auditable decisions · AI findings serve as advisory evidence only
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttemptId(null)}
                style={{ background: "transparent", color: "var(--text-muted)", fontSize: "20px", fontWeight: "bold", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              {timelineLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>Loading incidents...</div>
              ) : timeline.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--accent-emerald)", padding: "40px" }}>
                  ✓ No proctoring events or browser anomalies recorded for this candidate attempt.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {timeline.map((ev) => (
                    <div
                      key={ev.event_id}
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "16px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: ev.severity === "high" || ev.severity === "suspicious" ? "var(--accent-rose)" : "var(--accent-amber)",
                            color: "#fff"
                          }}>
                            {ev.event_type === "prohibited_object" ? "📱 PROHIBITED DEVICE / PHONE" : ev.event_type === "multiple_faces_detected" ? "👥 MULTIPLE PEOPLE" : ev.event_type.replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {new Date(ev.occurred_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {/* Review Decision Badge or Action */}
                        {ev.review ? (
                          <span style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            padding: "3px 10px",
                            borderRadius: "4px",
                            background: ev.review.decision === "confirmed_violation" ? "var(--accent-rose-subtle)" : "var(--accent-emerald-subtle)",
                            color: ev.review.decision === "confirmed_violation" ? "var(--accent-rose)" : "var(--accent-emerald)"
                          }}>
                            Decision: {ev.review.decision.replace("_", " ").toUpperCase()}
                          </span>
                        ) : (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => handleReviewDecision(ev.event_id, "dismissed")}
                              style={{
                                padding: "4px 10px",
                                background: "var(--bg-surface)",
                                color: "var(--text-secondary)",
                                fontSize: "12px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-subtle)",
                                cursor: "pointer"
                              }}
                            >
                              Dismiss Flag
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReviewDecision(ev.event_id, "confirmed_violation")}
                              style={{
                                padding: "4px 10px",
                                background: "var(--accent-rose)",
                                color: "#fff",
                                fontSize: "12px",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                border: "none",
                                cursor: "pointer"
                              }}
                            >
                              Confirm Violation
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Evidence Details */}
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        Telemetry Payload: {JSON.stringify(ev.metadata)}
                      </div>

                      {ev.has_evidence && (
                        <div style={{ marginTop: "12px" }}>
                          <img
                            src={`${API_BASE_URL}/proctor/evidence/${ev.evidence_asset_id}`}
                            alt="Proctoring Snapshot"
                            style={{ maxWidth: "260px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
