import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { CheckIcon, XIcon, TrophyIcon, ZapIcon } from "../shared/Icons";

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
      // Finished all questions -> mark attempt completed & load podium
      try {
        if (quizData.session_id) {
          await api.finishQuickQuiz(quizData.room_code, quizData.session_id);
        }
      } catch (e) {
        console.error("Failed to complete quiz session:", e);
      }
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
    { badgeBg: "#2563eb", badgeColor: "#ffffff", label: "A" },
    { badgeBg: "#7c3aed", badgeColor: "#ffffff", label: "B" },
    { badgeBg: "#059669", badgeColor: "#ffffff", label: "C" },
    { badgeBg: "#d97706", badgeColor: "#ffffff", label: "D" }
  ];

  return (
    <div style={{
      minHeight: "100%",
      background: "#f8fafc",
      color: "#0f172a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px"
    }}>
      {/* Lobby / Join Screen */}
      {phase === "lobby" && (
        <div style={{
          maxWidth: "440px",
          width: "100%",
          padding: "36px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)",
          textAlign: "center"
        }}>
          <img
            src="/logo.png"
            alt="Lunaris"
            style={{
              width: "52px",
              height: "52px",
              objectFit: "contain",
              borderRadius: "50%",
              margin: "0 auto 16px auto",
              display: "block",
              background: "#ffffff",
              padding: "2px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          />
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
            Lunaris Quick Quiz
          </h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px", marginBottom: "24px" }}>
            Enter your room code to join the live timed speed challenge!
          </p>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecdd3", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", fontWeight: "500" }}>
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
                  background: "#ffffff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  textAlign: "center",
                  letterSpacing: "4px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--accent-blue)",
                  outline: "none"
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
                  padding: "13px",
                  background: "#ffffff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#0f172a",
                  textAlign: "center",
                  outline: "none"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              style={{
                padding: "13px",
                background: "var(--accent-blue)",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: "700",
                borderRadius: "10px",
                border: "none",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                cursor: joining ? "not-allowed" : "pointer"
              }}
            >
              {joining ? "Entering Arena..." : "Join Game Now →"}
            </button>
          </form>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              style={{
                marginTop: "20px",
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      )}

      {/* In-Quiz Live Question Screen */}
      {phase === "in_quiz" && currentQ && (
        <div style={{ maxWidth: "800px", width: "100%" }}>
          {/* Header Stats */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748b" }}>
              Question {currentIndex + 1} of {quizData.questions.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#ffffff", border: "1px solid #e2e8f0", padding: "5px 14px", borderRadius: "9999px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", fontFamily: "monospace" }}>Room: {quizData.room_code}</span>
            </div>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-blue)", fontFamily: "monospace" }}>
              Score: {lastAnswerResult?.current_total_score || 0} pts
            </span>
          </div>

          {/* Time Remaining Bar */}
          <div style={{
            height: "8px",
            background: "#e2e8f0",
            borderRadius: "6px",
            overflow: "hidden",
            marginBottom: "24px"
          }}>
            <div style={{
              height: "100%",
              width: `${(timeLeft / (quizData.per_question_seconds || 20)) * 100}%`,
              background: timeLeft <= 5 ? "#ef4444" : "var(--accent-blue)",
              transition: "width 1s linear"
            }} />
          </div>

          {/* Question Stem Box */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "32px",
            textAlign: "center",
            fontSize: "19px",
            fontWeight: "700",
            color: "#0f172a",
            lineHeight: "1.55",
            marginBottom: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
          }}>
            {currentQ.text}
          </div>

          {/* 4 Clean Modern Option Blocks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {currentQ.options.map((opt, i) => {
              const themeBlock = blockColors[i % 4];
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  style={{
                    padding: "20px 18px",
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "12px",
                    color: "#0f172a",
                    fontSize: "15px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.1s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = themeBlock.badgeBg;
                    e.currentTarget.style.boxShadow = `0 4px 12px ${themeBlock.badgeBg}22`;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                >
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: themeBlock.badgeBg,
                    color: themeBlock.badgeColor,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: "800",
                    fontSize: "15px",
                    flexShrink: 0
                  }}>
                    {themeBlock.label}
                  </span>
                  <span style={{ flex: 1, color: "#1e293b" }}>{opt.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Answer Reveal Screen */}
      {phase === "answered_reveal" && lastAnswerResult && (
        <div style={{
          maxWidth: "460px",
          width: "100%",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "36px",
          textAlign: "center",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.08)"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: lastAnswerResult.is_correct ? "#ecfdf5" : "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto"
          }}>
            {lastAnswerResult.is_correct ? (
              <CheckIcon size={34} color="#059669" />
            ) : (
              <XIcon size={34} color="#dc2626" />
            )}
          </div>

          <h2 style={{ fontSize: "24px", fontWeight: "800", color: lastAnswerResult.is_correct ? "#059669" : "#dc2626", margin: 0 }}>
            {lastAnswerResult.is_correct ? "Correct!" : "Incorrect"}
          </h2>

          <div style={{ margin: "22px 0", padding: "18px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Points Earned</div>
            <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--accent-blue)", fontFamily: "var(--font-mono, monospace)", margin: "4px 0" }}>
              +{lastAnswerResult.points_awarded} pts
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Total Score: <strong>{lastAnswerResult.current_total_score}</strong> pts
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            style={{
              width: "100%",
              padding: "13px",
              background: "var(--accent-blue)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)"
            }}
          >
            {currentIndex < (quizData?.questions?.length || 0) - 1 ? "Next Question →" : "View Final Standings"}
          </button>
        </div>
      )}

      {/* Podium Leaderboard Screen */}
      {phase === "podium" && (
        <div style={{
          maxWidth: "520px",
          width: "100%",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "36px",
          textAlign: "center",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.08)"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "var(--accent-blue-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px auto"
          }}>
            <TrophyIcon size={30} color="var(--accent-blue)" />
          </div>

          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
            Quick Quiz Standings
          </h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px", marginBottom: "22px" }}>
            Speed & Accuracy Leaderboard
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
            {leaderboard.slice(0, 5).map((player, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={player.session_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: rank === 1 ? "#fefce8" : "#f8fafc"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: rank === 1 ? "#fef08a" : rank === 2 ? "#e2e8f0" : rank === 3 ? "#fed7aa" : "#e2e8f0",
                      color: rank === 1 ? "#854d0e" : rank === 2 ? "#334155" : rank === 3 ? "#9a3412" : "#475569",
                      fontSize: "12px",
                      fontWeight: "800",
                      display: "grid",
                      placeItems: "center"
                    }}>
                      #{rank}
                    </span>
                    <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>
                      {player.nickname}
                    </span>
                  </div>
                  <span style={{ fontWeight: "800", color: "var(--accent-blue)", fontFamily: "monospace", fontSize: "14px" }}>
                    {player.total_score} pts
                  </span>
                </div>
              );
            })}
          </div>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              style={{
                width: "100%",
                padding: "12px",
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                color: "#334155",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              ← Return to Dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
}
