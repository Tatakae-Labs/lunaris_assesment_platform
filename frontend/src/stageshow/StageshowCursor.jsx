import React from "react";

/**
 * Stageshow Cursor Component
 * Renders an authentic macOS-style pointer cursor with optional
 * click pulse ripples and label badges.
 */
export default function StageshowCursor({
  x = 0,
  y = 0,
  isClicking = false,
  label = "",
  visible = true,
  style = {}
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        pointerEvents: "none",
        zIndex: 50,
        transform: "translate(-2px, -2px)",
        transition: "all 0.55s cubic-bezier(0.25, 1, 0.5, 1)",
        ...style
      }}
    >
      {/* Click Ripple Effect */}
      {isClicking && (
        <span
          style={{
            position: "absolute",
            left: "2px",
            top: "2px",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.35)",
            transform: "translate(-50%, -50%) scale(1.6)",
            opacity: 0,
            animation: "cursor-click-ripple 0.4s ease-out forwards"
          }}
        />
      )}

      {/* SVG Pointer Arrow */}
      <svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: "drop-shadow(0 3px 5px rgba(0, 0, 0, 0.28))",
          transform: isClicking ? "scale(0.88)" : "scale(1)",
          transition: "transform 0.12s ease"
        }}
      >
        <path
          d="M0.5 0.5L7.5 24.5L11.5 15.5L20.5 12.5L0.5 0.5Z"
          fill="#1e293b"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Optional User Label / Tooltip Badge */}
      {label && (
        <div
          style={{
            position: "absolute",
            left: "18px",
            top: "14px",
            background: "#1e293b",
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: "600",
            padding: "2px 7px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            letterSpacing: "0.2px"
          }}
        >
          {label}
        </div>
      )}

      <style>{`
        @keyframes cursor-click-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

