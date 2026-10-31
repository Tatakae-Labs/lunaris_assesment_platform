import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function QuickQuizPortal({ onExit, defaultRoomCode = "" }) {
  const [phase, setPhase] = useState("lobby"); // 'lobby', 'in_quiz', 'answered_reveal', 'podium'
  const [roomCode, setRoomCode] = useState(defaultRoomCode || "");
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  // Quiz State
  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [timeSpent, setTimeSpent] = useState(0);
  const [lastAnswerResult, setLastAnswerResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // Per-question countdown timer
  useEffect(() => {
    if (phase !== "in_quiz") return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  async function handleJoinRoom(e) {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) {
      setError("Please enter both Room Code and your Nickname");
      return;
    }

    setJoining(true);
    setError(null);
    try {
      const data = await api.joinQuickQuizRoom(roomCode.trim(), nickname.trim());
      setQuizData(data);
      setCurrentIndex(0);
      setTimeLeft(data.per_question_seconds || 20);
      setTimeSpent(0);
      setPhase("in_quiz");
    } catch (err) {
      setError(err.message || "Failed to join room. Verify code.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSelectOption(optId) {
    if (!quizData) return;
    const currentQ = quizData.questions[currentIndex];

    try {
      const res = await api.submitQuickQuizAnswer(
        quizData.room_code,
        quizData.session_id,
        currentQ.id,
        optId,
        timeSpent
      );
      setLastAnswerResult(res);
      setPhase("answered_reveal");
    } catch (err) {
      console.error("Answer submission failed:", err);
    }
  }

  function handleTimeout() {
    setLastAnswerResult({ is_correct: false, points_awarded: 0, current_total_score: lastAnswerResult?.current_total_score || 0 });
    setPhase("answered_reveal");
  }

  async function handleNextQuestion() {
    if (!quizData) return;
    if (currentIndex < quizData.questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(quizData.per_question_seconds || 20);
      setTimeSpent(0);
      setLastAnswerResult(null);
      setPhase("in_quiz");
    } else {
      // Finished all questions -> load podium
      try {
        const lbRes = await api.getQuickQuizLeaderboard(quizData.room_code);
        setLeaderboard(lbRes.leaderboard || []);
      } catch (e) {
        console.error("Leaderboard fetch error:", e);
      }
      setPhase("podium");
    }
  }

  const currentQ = quizData?.questions?.[currentIndex];
  const blockColors = [
    { bg: "#ef4444", label: "A" },
    { bg: "#2563eb", label: "B" },
    { bg: "#eab308", label: "C" },
    { bg: "#16a34a", label: "D" }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      {/* Lobby / Join Screen */}
      {phase === "lobby" && (
        <div className="dash-card" style={{
          maxWidth: "440px",
          width: "100%",
          padding: "36px",
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          textAlign: "center"
        }}>
          <img
            src="/logo.png"
            alt="Lunaris"
            style={{
              width: "56px",
              height: "56px",
              objectFit: "contain",
              borderRadius: "50%",
              margin: "0 auto 16px auto",
              display: "block",
              background: "#ffffff",
              padding: "2px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)"
            }}
          />
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-display)" }}>
            Lunaris Quick Quiz
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "6px", marginBottom: "24px" }}>
            Enter your room code to join the live timed speed challenge!
          </p>

          {error && (
            <div style={{ padding: "10px", background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <input
                type="text"
                placeholder="6-DIGIT ROOM CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#020617",
                  border: "2px solid #334155",
                  borderRadius: "10px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  textAlign: "center",
                  letterSpacing: "4px",
                  fontFamily: "var(--font-mono)",
                  color: "#38bdf8"
                }}
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Your Nickname / Player Name"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#020617",
                  border: "2px solid #334155",
                  borderRadius: "10px",
                  fontSize: "15px",
                  color: "#f8fafc",
                  textAlign: "center"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              style={{
                padding: "14px",
                background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "10px",
                boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4)",
                cursor: "pointer"
              }}
            >
              {joining ? "Entering Arena..." : "Join Game Now →"}
            </button>
          </form>

          <button
            type="button"
            onClick={onExit}
            style={{ marginTop: "20px", background: "transparent", color: "#64748b", fontSize: "13px" }}
          >
            ← Back to Dashboard
          </button>
        </div>
      )}

      {/* In-Quiz Live Question Screen */}
      {phase === "in_quiz" && currentQ && (
        <div style={{ maxWidth: "800px", width: "100%" }}>
          {/* Header Stats */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#94a3b8" }}>
              Question {currentIndex + 1} of {quizData.questions.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.4)", padding: "6px 14px", borderRadius: "9999px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8" }}>Room: {quizData.room_code}</span>
            </div>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
              Score: {lastAnswerResult?.current_total_score || 0} pts
            </span>
          </div>

          {/* Time Remaining Bar */}
          <div style={{
            height: "12px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "6px",
            overflow: "hidden",
            marginBottom: "28px"
          }}>
            <div style={{
              height: "100%",
              width: `${(timeLeft / (quizData.per_question_seconds || 20)) * 100}%`,
              background: timeLeft <= 5 ? "#ef4444" : "#f59e0b",
              transition: "width 1s linear"
            }} />
          </div>

          {/* Question Stem Box */}
          <div style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "36px",
            textAlign: "center",
            fontSize: "20px",
            fontWeight: "700",
            lineHeight: "1.5",
            marginBottom: "28px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.4)"
          }}>
            {currentQ.text}
          </div>

          {/* 4 Colored Option Blocks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {currentQ.options.map((opt, i) => {
              const themeBlock = blockColors[i % 4];
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  style={{
                    padding: "24px 20px",
                    background: themeBlock.bg,
                    borderRadius: "14px",
                    color: "#ffffff",
                    fontSize: "16px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    textAlign: "left",
                    transition: "transform 0.1s, filter 0.15s",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = "brightness(1.15)"}
                  onMouseOut={(e) => e.currentTarget.style.filter = "none"}
                >
                  <span style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.25)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: "900",
                    fontSize: "18px"
                  }}>
                    {themeBlock.label}
                  </span>
                  <span style={{ flex: 1 }}>{opt.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Answer Reveal Screen */}
      {phase === "answered_reveal" && lastAnswerResult && (
        <div style={{
          maxWidth: "480px",
          width: "100%",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "20px",
          padding: "36px",
          textAlign: "center"
        }}>
          <div style={{
            fontSize: "56px",
            marginBottom: "12px"
          }}>
            {lastAnswerResult.is_correct ? "🎉" : "❌"}
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: "800", color: lastAnswerResult.is_correct ? "#22c55e" : "#ef4444" }}>
            {lastAnswerResult.is_correct ? "CORRECT!" : "WRONG ANSWER!"}
          </h2>

          <div style={{ margin: "24px 0", padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>Points Earned</div>
            <div style={{ fontSize: "36px", fontWeight: "900", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
              +{lastAnswerResult.points_awarded} pts
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              Current Total: {lastAnswerResult.current_total_score} pts
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            style={{
              width: "100%",
              padding: "14px",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "bold",
              borderRadius: "10px"
            }}
          >
            {currentIndex < (quizData?.questions?.length || 0) - 1 ? "Next Question →" : "View Final Podium 🏆"}
          </button>
        </div>
      )}

      {/* Podium Leaderboard Screen */}
      {phase === "podium" && (
        <div style={{
          maxWidth: "540px",
          width: "100%",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "20px",
          padding: "36px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>🏆</div>
          <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-display)" }}>
            Quick Quiz Podium
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
            Speed & Accuracy Leaderboard
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
            {leaderboard.slice(0, 5).map((player, idx) => (
              <div
                key={player.session_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: idx === 0 ? "rgba(245, 158, 11, 0.15)" : "#1e293b",
                  border: `1px solid ${idx === 0 ? "#f59e0b" : "#334155"}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "#334155",
                    color: "#fff",
                    fontWeight: "bold",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "13px"
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontWeight: "700", fontSize: "15px", color: "#f8fafc" }}>
                    {player.nickname} {player.session_id === quizData?.session_id && "(You)"}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "bold", fontSize: "16px", color: "#38bdf8" }}>
                  {player.score} pts
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onExit}
            style={{
              width: "100%",
              padding: "14px",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "bold",
              borderRadius: "10px"
            }}
          >
            Exit to Organization Hub
          </button>
        </div>
      )}
    </div>
  );
}
