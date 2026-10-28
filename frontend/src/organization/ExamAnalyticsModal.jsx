import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function ExamAnalyticsModal({ examId, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultsReleased, setResultsReleased] = useState(false);
  const [regradingId, setRegradingId] = useState(null);
  const [newScoreVal, setNewScoreVal] = useState("");

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const data = await api.getExamAnalytics(examId);
        setAnalytics(data);
        setResultsReleased(data.results_released || false);
      } catch (err) {
        setError(err.message || "Failed to load exam analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [examId]);

  async function handleToggleResults() {
    try {
      const res = await fetch(`/api/v1/reports/exams/${examId}/release-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("lunaris_token")}` },
        body: JSON.stringify({ results_released: !resultsReleased })
      });
      if (res.ok) {
        setResultsReleased(!resultsReleased);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRegrade(attemptId) {
    if (!newScoreVal) return;
    try {
      const res = await fetch(`/api/v1/reports/attempts/${attemptId}/regrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("lunaris_token")}` },
        body: JSON.stringify({ new_score: parseFloat(newScoreVal), reason: "Manual evaluation adjustment" })
      });
      if (res.ok) {
        setRegradingId(null);
        setNewScoreVal("");
        const refreshed = await api.getExamAnalytics(examId);
        setAnalytics(refreshed);
      }
    } catch (e) {
      console.error(e);
    }
  }


  function exportLeaderboardToCSV() {
    if (!analytics || !analytics.leaderboard) return;
    const headers = ["Rank", "Candidate Name", "Email", "Score", "Status", "Total Flags", "Critical Flags", "Submitted At"];
    const rows = analytics.leaderboard.map((c) => [
      c.rank,
      `"${c.candidate_name}"`,
      `"${c.candidate_email}"`,
      c.score,
      c.status,
      c.integrity_flags,
      c.critical_flags,
      `"${c.submitted_at || 'In Progress'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `exam_analytics_${examId.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
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
      <div style={{
        maxWidth: "840px",
        width: "100%",
        maxHeight: "90vh",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "14px",
        boxShadow: "var(--card-shadow-hover)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {analytics?.exam_title || "Exam Analytics & Scorecards"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Deterministic Server-Side Grading & Integrity Evaluation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", color: "var(--text-muted)", fontSize: "20px", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading analytics...</div>
          ) : error ? (
            <div style={{ padding: "16px", background: "var(--accent-rose-subtle)", color: "var(--accent-rose)", borderRadius: "8px" }}>
              {error}
            </div>
          ) : (
            <div>
              {/* Top Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
                <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "600" }}>Total Candidates</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-primary)", marginTop: "4px" }}>
                    {analytics.total_enrolled}
                  </div>
                </div>

                <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "600" }}>Submissions</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-emerald)", marginTop: "4px" }}>
                    {analytics.total_submitted}
                  </div>
                </div>

                <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "600" }}>Average Score</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-blue)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                    {analytics.average_score}
                  </div>
                </div>

                <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "600" }}>Top Score</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-cyan)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                    {analytics.highest_score}
                  </div>
                </div>
              </div>

              {/* Subject Accuracy Cards */}
              <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "12px" }}>
                  Subject Accuracy Overview
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                  {Object.entries(analytics.subject_accuracy || {}).map(([subj, acc]) => (
                    <div key={subj} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", padding: "14px", borderRadius: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{subj}</span>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--accent-blue)" }}>{acc}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${acc}%`, background: "var(--accent-blue)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard Table */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                    Candidate Performance & Integrity Leaderboard
                  </h4>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleToggleResults}
                      style={{
                        padding: "6px 12px",
                        background: resultsReleased ? "var(--accent-emerald-subtle)" : "var(--bg-secondary)",
                        border: resultsReleased ? "1px solid var(--accent-emerald)" : "1px solid var(--border-subtle)",
                        color: resultsReleased ? "var(--accent-emerald)" : "var(--text-secondary)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      {resultsReleased ? "✓ Results Released" : "🔒 Release Results"}
                    </button>
                    <button
                      type="button"
                      onClick={exportLeaderboardToCSV}
                      style={{
                        padding: "6px 12px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      ⬇ Export CSV
                    </button>
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Candidate</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Integrity Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.leaderboard.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                            No candidate attempts submitted yet.
                          </td>
                        </tr>
                      ) : (
                        analytics.leaderboard.map((cand) => (
                          <tr key={cand.attempt_id}>
                            <td style={{ fontWeight: "bold", color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                              #{cand.rank}
                            </td>
                            <td>
                              <div style={{ fontWeight: "600" }}>{cand.candidate_name}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{cand.candidate_email}</div>
                            </td>
                            <td style={{ fontWeight: "bold", fontFamily: "var(--font-mono)", fontSize: "15px" }}>
                              {cand.score}
                            </td>
                            <td>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "bold",
                                background: cand.status === "submitted" ? "var(--accent-emerald-subtle)" : "var(--accent-blue-subtle)",
                                color: cand.status === "submitted" ? "var(--accent-emerald)" : "var(--accent-blue)"
                              }}>
                                {cand.status}
                              </span>
                            </td>
                            <td>
                              {cand.critical_flags > 0 ? (
                                <span style={{ color: "var(--accent-rose)", fontWeight: "bold", fontSize: "12px" }}>
                                  ⚠️ {cand.critical_flags} Critical ({cand.integrity_flags} total)
                                </span>
                              ) : (
                                <span style={{ color: "var(--accent-emerald)", fontSize: "12px" }}>
                                  ✓ Clean ({cand.integrity_flags} advisory)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
