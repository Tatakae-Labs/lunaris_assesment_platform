import React, { useState, useEffect } from "react";

// Event-based emitter for toast notifications
const listeners = new Set();

let toastIdCounter = 0;

export const toast = {
  show(msg, type = "info", options = {}) {
    const id = ++toastIdCounter;
    const toastItem = {
      id,
      message: typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg),
      type, // 'success' | 'error' | 'warning' | 'info'
      duration: options.duration !== undefined ? options.duration : 4500,
      title: options.title || null,
      action: options.action || null
    };
    listeners.forEach((listener) => listener(toastItem));
    return id;
  },
  success(msg, options) {
    return toast.show(msg, "success", options);
  },
  error(msg, options) {
    return toast.show(msg, "error", options);
  },
  warning(msg, options) {
    return toast.show(msg, "warning", options);
  },
  info(msg, options) {
    return toast.show(msg, "info", options);
  }
};

// Polyfill window.alert to automatically use platform toasts
if (typeof window !== "undefined") {
  window.platformToast = toast;
  window.alert = (msg) => {
    const str = String(msg || "");
    const lower = str.toLowerCase();
    if (str.includes("✓") || str.includes("🎉") || lower.includes("successfully") || lower.includes("success")) {
      toast.success(str);
    } else if (lower.includes("error") || lower.includes("failed") || lower.includes("invalid") || lower.includes("please enter") || lower.includes("not allowed")) {
      toast.error(str);
    } else if (lower.includes("warning") || lower.includes("caution") || lower.includes("exceeded")) {
      toast.warning(str);
    } else {
      toast.info(str);
    }
  };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (item) => {
      setToasts((prev) => [...prev, item]);

      if (item.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, item.duration);
      }
    };

    listeners.add(handleNewToast);
    return () => listeners.delete(handleNewToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getTheme = (type) => {
    switch (type) {
      case "success":
        return {
          bg: "#ffffff",
          border: "#10b981",
          borderLeft: "5px solid #10b981",
          badgeBg: "#ecfdf5",
          badgeColor: "#059669",
          icon: "✓",
          headerColor: "#065f46"
        };
      case "error":
        return {
          bg: "#ffffff",
          border: "#ef4444",
          borderLeft: "5px solid #ef4444",
          badgeBg: "#fef2f2",
          badgeColor: "#dc2626",
          icon: "✕",
          headerColor: "#991b1b"
        };
      case "warning":
        return {
          bg: "#ffffff",
          border: "#f59e0b",
          borderLeft: "5px solid #f59e0b",
          badgeBg: "#fffbeb",
          badgeColor: "#d97706",
          icon: "⚠️",
          headerColor: "#92400e"
        };
      case "info":
      default:
        return {
          bg: "#ffffff",
          border: "#2563eb",
          borderLeft: "5px solid #2563eb",
          badgeBg: "#eff6ff",
          badgeColor: "#2563eb",
          icon: "ℹ️",
          headerColor: "#1e40af"
        };
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "420px",
        width: "calc(100vw - 48px)",
        pointerEvents: "none"
      }}
    >
      {toasts.map((item) => {
        const theme = getTheme(item.type);
        const lines = item.message.split("\n");

        return (
          <div
            key={item.id}
            style={{
              pointerEvents: "auto",
              background: theme.bg,
              borderRadius: "10px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              borderLeft: theme.borderLeft,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              position: "relative",
              overflow: "hidden",
              animation: "toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              color: "#0f172a"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: theme.badgeBg,
                    color: theme.badgeColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: "800",
                    flexShrink: 0
                  }}
                >
                  {theme.icon}
                </div>
                <strong style={{ fontSize: "13px", color: theme.headerColor, textTransform: "capitalize" }}>
                  {item.title || (item.type === "success" ? "Success" : item.type === "error" ? "Action Notice" : item.type === "warning" ? "Attention" : "Notification")}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => removeToast(item.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "16px",
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: "1"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#334155", paddingLeft: "32px", wordBreak: "break-word" }}>
              {lines.map((line, idx) => (
                <div key={idx} style={{ marginBottom: line.trim() === "" ? "6px" : "2px" }}>
                  {line.startsWith("•") || line.startsWith("-") ? (
                    <span style={{ fontWeight: "500", color: "#1e293b" }}>{line}</span>
                  ) : idx === 0 && lines.length > 1 ? (
                    <span style={{ fontWeight: "600", color: "#0f172a" }}>{line}</span>
                  ) : (
                    line
                  )}
                </div>
              ))}
            </div>

            {item.action && (
              <div style={{ paddingLeft: "32px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.action.onClick) item.action.onClick();
                    removeToast(item.id);
                  }}
                  style={{
                    padding: "5px 12px",
                    background: theme.badgeColor,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "11.5px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  {item.action.label || "Action"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

