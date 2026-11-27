import React from "react";

/**
 * Stageshow-grade Window Frame
 * Follows exact geometry: authentic traffic lights, crisp chrome,
 * subtle border, deep diffuse shadow, and optional satellite overlays.
 */
export default function StageWindow({
  title = "Lunaris Assessment Platform",
  url = "lunaris.app/exams/specialized-assessment",
  type = "browser", // 'browser' | 'app' | 'glass' | 'card'
  width = "100%",
  maxWidth = "960px",
  height = "auto",
  className = "",
  style = {},
  headerActions = null,
  satellite = null,
  children
}) {
  const isGlass = type === "glass";
  const isCard = type === "card";

  return (
    <div
      className={`stageshow-window-wrapper ${className}`}
      style={{
        position: "relative",
        width,
        maxWidth,
        margin: "0 auto",
        ...style
      }}
    >
      {/* The Primary Window */}
      <div
        style={{
          background: isGlass
            ? "rgba(255, 255, 255, 0.85)"
            : isCard
            ? "#ffffff"
            : "#ffffff",
          backdropFilter: isGlass ? "blur(16px)" : "none",
          WebkitBackdropFilter: isGlass ? "blur(16px)" : "none",
          borderRadius: "14px",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow:
            "0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
          height: height,
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Window Chrome Header */}
        {!isCard && (
          <div
            style={{
              height: "44px",
              background: "linear-gradient(180deg, #fafbfc 0%, #f4f5f8 100%)",
              borderBottom: "1px solid rgba(15, 23, 42, 0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              userSelect: "none"
            }}
          >
            {/* Traffic Lights */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "70px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#ff5f56",
                  border: "1px solid #e0443e",
                  display: "inline-block"
                }}
              />
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#ffbd2e",
                  border: "1px solid #dea123",
                  display: "inline-block"
                }}
              />
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#27c93f",
                  border: "1px solid #1aab29",
                  display: "inline-block"
                }}
              />
            </div>

            {/* Browser URL bar or App Title */}
            {type === "browser" ? (
              <div
                style={{
                  flex: 1,
                  maxWidth: "460px",
                  margin: "0 12px",
                  height: "26px",
                  background: "#ffffff",
                  border: "1px solid rgba(15, 23, 42, 0.09)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#475569",
                  boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.02)"
                }}
              >
                <span style={{ fontSize: "11px", color: "#10b981" }}></span>
                <span style={{ fontWeight: "600", color: "#0f172a" }}>https://</span>
                <span style={{ color: "#334155" }}>{url}</span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#475569",
                  letterSpacing: "-0.1px"
                }}
              >
                {title}
              </div>
            )}

            {/* Header Right Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "70px", justifyContent: "flex-end" }}>
              {headerActions || (
                <div style={{ display: "flex", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cbd5e1" }} />
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cbd5e1" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Window Content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {children}
        </div>
      </div>

      {/* Floating Satellite Card (straddles the window edge) */}
      {satellite && (
        <div
          className="stageshow-satellite"
          style={{
            position: "absolute",
            zIndex: 10,
            filter: "drop-shadow(0 14px 28px rgba(15, 23, 42, 0.16))",
            ...satellite.position
          }}
        >
          {satellite.content}
        </div>
      )}
    </div>
  );
}

