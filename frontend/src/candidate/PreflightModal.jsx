import React, { useState, useEffect, useRef } from "react";

export default function PreflightModal({ onProceed, examTitle, durationMinutes, mode }) {
  const isStandardQuiz = mode === "standard_quiz";
  const [cameraOk, setCameraOk] = useState(isStandardQuiz);
  const [micOk, setMicOk] = useState(isStandardQuiz);
  const [fullscreenOk, setFullscreenOk] = useState(isStandardQuiz);
  const [agreed, setAgreed] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isStandardQuiz) return;
    let audioCtx = null;
    let analyser = null;
    let animId = null;

    async function initSensors() {
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { min: 1280, ideal: 1280 },
              height: { min: 720, ideal: 720 },
              frameRate: { ideal: 30, min: 24 },
              facingMode: "user"
            },
            audio: true
          });
        } catch (e1) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
              },
              audio: true
            });
          } catch (e2) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          }
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraOk(true);
        setMicOk(true);

        // Audio Level meter
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animId = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (err) {
        console.error("Camera/Mic preflight failed:", err);
      }
    }

    initSensors();

    function onFsChange() {
      setFullscreenOk(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) audioCtx.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isStandardQuiz]);

  async function handleFullscreenRequest() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullscreenOk(true);
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    }
  }

  const allPassed = isStandardQuiz ? agreed : (cameraOk && micOk && fullscreenOk && agreed);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(10, 15, 29, 0.95)",
      backdropFilter: "blur(8px)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "680px",
        width: "100%",
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "16px",
        padding: "32px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <span style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            background: "#1e293b",
            color: "#38bdf8",
            padding: "4px 12px",
            borderRadius: "9999px",
            fontWeight: "600"
          }}>
            Pre-Exam Verification
          </span>
          <h2 style={{ fontSize: "24px", marginTop: "12px", color: "#f8fafc", fontFamily: "var(--font-display)" }}>
            {examTitle || "JEE Main Computer-Based Mock Exam"}
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "4px" }}>
            Duration: {durationMinutes || 180} Minutes | Physics, Chemistry & Mathematics
          </p>
        </div>

        {/* Video Preview & Sensor Status or Standard Practice Notice */}
        {isStandardQuiz ? (
          <div style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            textAlign: "left"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "28px" }}>📝</span>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#38bdf8", margin: 0 }}>
                  Standard Practice Assessment
                </h3>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Open format • Camera, microphone, and fullscreen lockdown are disabled
                </span>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7", margin: 0 }}>
              • No camera or audio streams are accessed or transmitted.<br />
              • You may work at your own pace without browser fullscreen restrictions.<br />
              • Answers autosave continuously to ensure no progress is lost.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{
              position: "relative",
              aspectRatio: "4/3",
              background: "#020617",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid #334155"
            }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {!cameraOk && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#f87171", fontSize: "12px", textAlign: "center", padding: "10px" }}>
                  Waiting for Camera Authorization...
                </div>
              )}
              <div style={{
                position: "absolute",
                bottom: "8px",
                left: "8px",
                background: cameraOk ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                color: "#fff",
                fontWeight: "bold"
              }}>
                {cameraOk ? "Camera Live" : "Camera Blocked"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", justifyContent: "center" }}>
              {/* Camera Check */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: cameraOk ? "#22c55e" : "#ef4444" }} />
                <span style={{ fontSize: "14px", color: "#e2e8f0" }}>Webcam Hardware Access</span>
              </div>

              {/* Mic Check */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: micOk ? "#22c55e" : "#ef4444" }} />
                  <span style={{ fontSize: "14px", color: "#e2e8f0" }}>Microphone Voice Band</span>
                </div>
                <div style={{ height: "6px", width: "100%", background: "#1e293b", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${micLevel}%`, background: "#38bdf8", transition: "width 0.1s" }} />
                </div>
              </div>

              {/* Fullscreen Check */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: fullscreenOk ? "#22c55e" : "#eab308" }} />
                  <span style={{ fontSize: "14px", color: "#e2e8f0" }}>
                    {fullscreenOk ? "Fullscreen Mode Enabled" : "Fullscreen Required"}
                  </span>
                </div>
                {!fullscreenOk && (
                  <button
                    type="button"
                    onClick={handleFullscreenRequest}
                    style={{
                      padding: "8px 14px",
                      background: "#2563eb",
                      color: "#fff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}
                  >
                    Enter Fullscreen Mode
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Consent & Rules */}
        <div style={{
          background: "#1e293b",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontSize: "13px",
          color: "#94a3b8"
        }}>
          <p style={{ marginBottom: "8px" }}>
            <strong>NTA JEE Exam Rules:</strong> Leaving fullscreen, switching browser tabs, or multiple faces detected will be logged in the proctoring audit trail. Answers are autosaved automatically every few seconds.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#f8fafc", marginTop: "10px" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "#38bdf8" }}
            />
            <span>I have read all instructions and consent to remote integrity monitoring.</span>
          </label>
        </div>

        {/* Action Button */}
        <button
          type="button"
          disabled={!allPassed}
          onClick={() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((t) => t.stop());
            }
            onProceed();
          }}
          style={{
            width: "100%",
            padding: "14px",
            background: allPassed ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" : "#334155",
            color: allPassed ? "#ffffff" : "#64748b",
            fontSize: "16px",
            fontWeight: "bold",
            borderRadius: "8px",
            cursor: allPassed ? "pointer" : "not-allowed",
            transition: "all 0.2s"
          }}
        >
          {allPassed ? "Proceed to Examination" : "Complete Preflight Checks to Begin"}
        </button>
      </div>
    </div>
  );
}
