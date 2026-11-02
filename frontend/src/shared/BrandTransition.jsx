import React, { useState, useEffect } from "react";

/**
 * WebsiteInitialLoader - Pure white, high-craft initial loading screen.
 * Displays on first page mount with the Lunaris logo,
 * held for at least 3 seconds with a smooth progress bar and breathing glow,
 * then dissolving smoothly into the application.
 */
export function WebsiteInitialLoader({ onComplete, minDuration = 3000 }) {
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    // Smooth progress bar filling up across 3 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        // Jump in progressive increments
        return Math.min(prev + Math.floor(Math.random() * 8 + 6), 98);
      });
    }, 220);

    const timer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setMounted(false);
          if (onComplete) onComplete();
        }, 400); // fade out duration
      }, 150);
    }, minDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [minDuration, onComplete]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: fading ? "none" : "all",
        userSelect: "none"
      }}
    >
      {/* Centered Brand Emblem */}
      <div style={{ position: "relative", marginBottom: "22px" }}>
        {/* Soft Ambient Pulse Ring */}
        <div
          style={{
            position: "absolute",
            inset: "-14px",
            borderRadius: "50%",
            border: "1.5px solid rgba(37, 99, 235, 0.28)",
            animation: "loader-pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite"
          }}
        />

        {/* Ambient Subtle Glow */}
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, rgba(255,255,255,0) 70%)",
            animation: "loader-glow 2.4s ease-in-out infinite"
          }}
        />

        <img
          src="/logo.png"
          alt="Lunaris"
          style={{
            width: "74px",
            height: "74px",
            objectFit: "contain",
            borderRadius: "50%",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.1), 0 0 0 2px rgba(37, 99, 235, 0.15)",
            display: "block",
            position: "relative",
            zIndex: 2,
            animation: "loader-breathe 2.4s ease-in-out infinite"
          }}
        />
      </div>

      {/* Typography */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "22px",
            fontWeight: "900",
            letterSpacing: "1px",
            color: "#0f172a",
            fontFamily: "var(--font-display, inherit)",
            lineHeight: "1.1"
          }}
        >
          LUNARIS
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#64748b",
            letterSpacing: "0.5px",
            marginTop: "6px"
          }}
        >
          Specialized Institutional Assessment Platform
        </div>
      </div>

      {/* Synchronized 3s Progress Line */}
      <div
        style={{
          width: "140px",
          height: "3px",
          background: "#f1f5f9",
          borderRadius: "9999px",
          overflow: "hidden",
          marginTop: "26px",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${progress}%`,
            background: "linear-gradient(90deg, #2563eb, #38bdf8)",
            borderRadius: "9999px",
            transition: "width 0.22s ease-out"
          }}
        />
      </div>

      <style>{`
        @keyframes loader-pulse-ring {
          0% {
            transform: scale(0.92);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.18);
            opacity: 0.2;
          }
          100% {
            transform: scale(1.35);
            opacity: 0;
          }
        }
        @keyframes loader-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.1);
          }
        }
        @keyframes loader-breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * LoginSuccessOverlay - Full-screen post-login celebration animation.
 * Features an authentic 360-degree logo rotation, expanding ripple wave,
 * personalized welcome greeting, and seamless routing handoff (at least 3 seconds).
 */
export function LoginSuccessOverlay({ user, onComplete, minDuration = 3000 }) {
  const [phase, setPhase] = useState("enter"); // 'enter', 'spin', 'exit'
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    // Stage 1: Trigger spin immediately on mount
    const spinTimer = setTimeout(() => {
      setPhase("spin");
    }, 50);

    // Smooth progress fill across the 3s duration
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        return Math.min(prev + Math.floor(Math.random() * 8 + 6), 98);
      });
    }, 220);

    // Stage 2: Fade out & complete at minimum 3 seconds
    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setPhase("exit");
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 350);
      }, 150);
    }, minDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(spinTimer);
      clearTimeout(finishTimer);
    };
  }, [minDuration, onComplete]);

  const userName = user?.full_name || user?.name || user?.email || "User";
  const orgName = user?.organization_name || (user?.is_superadmin ? "Platform SuperAdmin" : "Workspace");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "none"
      }}
    >
      {/* Center Animated Logo Vessel */}
      <div style={{ position: "relative", marginBottom: "26px" }}>
        {/* Expanding Success Ripple Ring */}
        <div
          style={{
            position: "absolute",
            inset: "-18px",
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.12)",
            transform: phase === "spin" ? "scale(1.6)" : "scale(0.8)",
            opacity: phase === "spin" ? 0 : 1,
            transition: "transform 1.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.8s ease"
          }}
        />

        {/* Rotating & Pulsing Logo */}
        <img
          src="/logo.png"
          alt="Lunaris"
          style={{
            width: "84px",
            height: "84px",
            objectFit: "contain",
            borderRadius: "50%",
            boxShadow: "0 14px 34px rgba(37, 99, 235, 0.22), 0 0 0 2px rgba(37, 99, 235, 0.2)",
            position: "relative",
            zIndex: 2,
            transform:
              phase === "spin"
                ? "rotate(720deg) scale(1.08)"
                : "rotate(0deg) scale(0.92)",
            transition: "transform 2.2s cubic-bezier(0.34, 1.56, 0.64, 1)"
          }}
        />

        {/* Success Verified Mini Pill Badge */}
        <div
          style={{
            position: "absolute",
            bottom: "-4px",
            right: "-4px",
            background: "#16a34a",
            color: "#ffffff",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: "12px",
            fontWeight: "900",
            zIndex: 3,
            boxShadow: "0 2px 8px rgba(22, 163, 74, 0.4)",
            transform: phase === "spin" ? "scale(1)" : "scale(0)",
            transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s"
          }}
        >
          ✓
        </div>
      </div>

      {/* Greeting & Status Feedback */}
      <div style={{ textAlign: "center", maxWidth: "360px", padding: "0 20px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#2563eb",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: "6px"
          }}
        >
          Authentication Confirmed
        </div>
        <div
          style={{
            fontSize: "22px",
            fontWeight: "900",
            color: "#0f172a",
            letterSpacing: "-0.3px",
            lineHeight: "1.2"
          }}
        >
          Welcome back, {userName}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#64748b",
            marginTop: "6px"
          }}
        >
          Connecting securely to <span style={{ fontWeight: "700", color: "#0f172a" }}>{orgName}</span>
        </div>
      </div>

      {/* Synchronized 3s Progress Line */}
      <div
        style={{
          width: "160px",
          height: "3px",
          background: "#f1f5f9",
          borderRadius: "9999px",
          overflow: "hidden",
          marginTop: "26px",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${progress}%`,
            background: "linear-gradient(90deg, #2563eb, #38bdf8)",
            borderRadius: "9999px",
            transition: "width 0.22s ease-out"
          }}
        />
      </div>
    </div>
  );
}
