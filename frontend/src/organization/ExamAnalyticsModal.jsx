import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import {
  XIcon, DownloadIcon, SearchIcon, UsersIcon, TrophyIcon,
  ShieldIcon, CheckIcon, ClockIcon, RefreshIcon, ChevronDownIcon
} from "../shared/Icons";

export default function ExamAnalyticsModal({ examId, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultsReleased, setResultsReleased] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "submitted", "in_progress"
  const [expandedAttemptId, setExpandedAttemptId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchAnalytics();
  }, [examId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getExamAnalytics(examId);
      setAnalytics(data);
      setResultsReleased(data.results_released || false);
    } catch (err) {
      setError(err.message || "Failed to load exam analytics");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleResults() {
    try {
      await api.releaseExamResults(examId, !resultsReleased);
      setResultsReleased(!resultsReleased);
    } catch (e) {
      console.error(e);
    }
  }

  function exportLeaderboardToCSV() {
    if (!analytics || !analytics.leaderboard) return;
    const headers = [
      "Rank", "Candidate Name", "Identifier / Email", "UID",
      "Score", "Status", "Started At", "Submitted At", "Duration (s)", "Integrity Flags"
    ];
    const rows = analytics.leaderboard.map((c) => [
      c.rank,
      `"${c.candidate_name}"`,
      `"${c.candidate_email}"`,
      `"${c.candidate_uid || ''}"`,
      c.score,
      c.status,
      `"${c.started_at || ''}"`,
      `"${c.submitted_at || 'In Progress'}"`,
      c.duration_seconds || 0,
      c.integrity_flags || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_${analytics.exam_title || examId}_attempts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const rawList = analytics?.leaderboard || [];
  const filteredCandidates = rawList.filter((c) => {
    if (statusFilter === "submitted" && !["submitted", "completed", "expired"].includes(c.status)) return false;
    if (statusFilter === "in_progress" && c.status !== "in_progress") return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.candidate_name && c.candidate_name.toLowerCase().includes(q)) ||
      (c.candidate_email && c.candidate_email.toLowerCase().includes(q)) ||
      (c.candidate_uid && c.candidate_uid.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const pagedCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.55)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10001,
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "960px",
        width: "100%",
        maxHeight: "92vh",
        background: "#ffffff",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.22)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                {analytics?.exam_title || "Examination & Quiz Statistics"}
              </h3>
              {analytics?.mode && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: analytics.mode === "quick_quiz" ? "#fef3c7" : "#eff6ff",
                  color: analytics.mode === "quick_quiz" ? "#b45309" : "var(--accent-blue)",
                  textTransform: "uppercase"
                }}>
                  {analytics.mode === "quick_quiz" ? "Quick Quiz" : analytics.mode === "standard_quiz" ? "Practice Quiz" : "Proctored CBT"}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "3px 0 0 0" }}>
              Comprehensive performance statistics and individual scorecards for every attempted candidate
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={exportLeaderboardToCSV}
              disabled={loading || filteredCandidates.length === 0}
              style={{
                padding: "6px 12px",
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#334155",
                cursor: filteredCandidates.length === 0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
              title="Download CSV report of all candidate attempts"
            >
              <DownloadIcon size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleToggleResults}
              style={{
                padding: "6px 12px",
                background: resultsReleased ? "#ecfdf5" : "#f8fafc",
                border: `1px solid ${resultsReleased ? "#a7f3d0" : "var(--border-subtle)"}`,
                color: resultsReleased ? "#059669" : "#475569",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              {resultsReleased ? "Results Released" : "Release Results"}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748b"
              }}
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
              <div style={{ marginBottom: "10px" }}><RefreshIcon size={24} /></div>
              Loading candidate attempts and statistics...
            </div>
          ) : error ? (
            <div style={{ padding: "16px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", border: "1px solid #fecdd3" }}>
              {error}
            </div>
          ) : (
            <div>
              {/* Metric Cards Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: "700" }}>Total Attempted</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                    {analytics.total_attempted}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    {analytics.total_enrolled} enrolled
                  </div>
                </div>

                <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#059669", fontWeight: "700" }}>Submissions</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
                    {analytics.total_submitted}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Completed</div>
                </div>

                <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--accent-blue)", fontWeight: "700" }}>In Progress</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--accent-blue)", marginTop: "4px" }}>
                    {analytics.total_in_progress}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Live attempts</div>
                </div>

                <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: "700" }}>Average Score</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px", fontFamily: "var(--font-mono, monospace)" }}>
                    {analytics.average_score}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Mean cohort score</div>
                </div>

                <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#7c3aed", fontWeight: "700" }}>Highest Score</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#7c3aed", marginTop: "4px", fontFamily: "var(--font-mono, monospace)" }}>
                    {analytics.highest_score}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Top candidate</div>
                </div>
              </div>

              {/* Subject Accuracy Bar (if available) */}
              {Object.keys(analytics.subject_accuracy || {}).length > 0 && (
                <div style={{ marginBottom: "20px", background: "#f8fafc", padding: "14px 18px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "10px" }}>
                    Subject-Wise Accuracy
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    {Object.entries(analytics.subject_accuracy).map(([subj, acc]) => (
                      <div key={subj} style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#0f172a" }}>{subj}</span>
                          <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--accent-blue)" }}>{acc}%</span>
                        </div>
                        <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${acc}%`, background: "var(--accent-blue)", borderRadius: "3px" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter & Search Bar */}
              <div style={{
                marginBottom: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {[
                    { id: "all", label: `All Attempted (${rawList.length})` },
                    { id: "submitted", label: `Completed (${analytics.total_submitted})` },
                    { id: "in_progress", label: `In Progress (${analytics.total_in_progress})` }
                  ].map((f) => {
                    const isSel = statusFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: isSel ? "700" : "500",
                          background: isSel ? "var(--accent-blue)" : "#ffffff",
                          color: isSel ? "#ffffff" : "#475569",
                          border: `1px solid ${isSel ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                          cursor: "pointer"
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ position: "relative", minWidth: "220px" }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate by name, UID, email..."
                    style={{
                      width: "100%",
                      padding: "6px 10px 6px 30px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      background: "#ffffff",
                      fontSize: "12px",
                      outline: "none"
                    }}
                  />
                  <div style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
                    <SearchIcon size={13} />
                  </div>
                </div>
              </div>

              {/* Candidate Attempts Table */}
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "10px", overflow: "hidden", background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "10px 14px", fontWeight: "700", width: "60px" }}>Rank</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>Candidate / Student</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>UID / Access</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>Score / Points</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>Attempt Status</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>Timing</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>Proctor Integrity</th>
                      <th style={{ padding: "10px 14px", fontWeight: "700", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: "40px 20px" }}>
                          <UsersIcon size={28} />
                          <div style={{ fontWeight: "700", color: "#0f172a", marginTop: "8px" }}>
                            {rawList.length === 0 ? "No candidate attempts recorded yet" : "No candidates match your search filter"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                            {rawList.length === 0 ? "When students begin testing or join the live arena, their real-time statistics appear here." : "Try clearing your search query."}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pagedCandidates.map((cand) => {
                        const isExpanded = expandedAttemptId === cand.attempt_id;
                        const isSubmitted = ["submitted", "completed", "expired"].includes(cand.status);
                        return (
                          <React.Fragment key={cand.attempt_id}>
                            <tr style={{
                              borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                              background: isExpanded ? "#f8fafc" : "#ffffff",
                              transition: "background 0.1s ease"
                            }}>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{
                                  width: "26px",
                                  height: "26px",
                                  borderRadius: "6px",
                                  background: cand.rank === 1 ? "#fef3c7" : cand.rank === 2 ? "#f1f5f9" : cand.rank === 3 ? "#ffedd5" : "#f8fafc",
                                  color: cand.rank === 1 ? "#b45309" : cand.rank === 2 ? "#475569" : cand.rank === 3 ? "#c2410c" : "#64748b",
                                  fontWeight: "800",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}>
                                  #{cand.rank}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: "700", color: "#0f172a" }}>{cand.candidate_name}</div>
                                {cand.candidate_email && (
                                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{cand.candidate_email}</div>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                {cand.candidate_uid ? (
                                  <span style={{
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontWeight: "700",
                                    color: "var(--accent-blue)",
                                    background: "var(--accent-blue-subtle)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "11px"
                                  }}>
                                    {cand.candidate_uid}
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "11px" }}>Arena Live</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{
                                  fontFamily: "var(--font-mono, monospace)",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                  color: "var(--accent-blue)"
                                }}>
                                  {cand.score}
                                </span>
                                <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "3px" }}>pts</span>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  background: isSubmitted ? "#ecfdf5" : "#eff6ff",
                                  color: isSubmitted ? "#059669" : "var(--accent-blue)"
                                }}>
                                  {cand.status.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#64748b", fontSize: "11px" }}>
                                {cand.submitted_at && cand.submitted_at !== "In Progress" ? (
                                  <div>
                                    <div>{cand.submitted_at.slice(0, 10)} {cand.submitted_at.slice(11, 16)}</div>
                                    {cand.duration_seconds > 0 && (
                                      <div style={{ color: "#94a3b8" }}>{Math.round(cand.duration_seconds / 60)} min duration</div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--accent-blue)", fontWeight: "600" }}>In Progress</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                {cand.critical_flags > 0 ? (
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    color: "#dc2626",
                                    background: "#fee2e2",
                                    padding: "2px 6px",
                                    borderRadius: "4px"
                                  }}>
                                    {cand.critical_flags} Critical Flags
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    color: "#059669",
                                    background: "#ecfdf5",
                                    padding: "2px 6px",
                                    borderRadius: "4px"
                                  }}>
                                    Clean Attempt
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedAttemptId(isExpanded ? null : cand.attempt_id)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--border-subtle)",
                                    background: isExpanded ? "#e2e8f0" : "#ffffff",
                                    color: "#334155",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    cursor: "pointer"
                                  }}
                                >
                                  {isExpanded ? "Hide" : "Details"}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Candidate Breakdown Drawer */}
                            {isExpanded && (
                              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                <td colSpan="8" style={{ padding: "16px 20px" }}>
                                  <div style={{
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                    padding: "16px"
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                      <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "13px" }}>
                                        Candidate Attempt Breakdown · {cand.candidate_name}
                                      </div>
                                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                                        Attempt ID: <span style={{ fontFamily: "monospace" }}>{cand.attempt_id}</span>
                                      </div>
                                    </div>

                                    {cand.score_details?.subject_breakdown ? (
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                                        {Object.entries(cand.score_details.subject_breakdown).map(([subj, stats]) => (
                                          <div key={subj} style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                            <div style={{ fontWeight: "700", fontSize: "12px", color: "#0f172a" }}>{subj}</div>
                                            <div style={{ fontSize: "11px", color: "#059669", marginTop: "4px" }}>
                                              Correct: {stats.correct || 0}
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#dc2626" }}>
                                              Incorrect: {stats.incorrect || 0}
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                              Unanswered: {stats.unanswered || 0}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        {cand.status === "in_progress"
                                          ? "Candidate is currently answering in real time. Live score and answers update automatically."
                                          : `Score recorded: ${cand.score} points with ${cand.integrity_flags} proctor telemetry events.`
                                        }
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Table Pagination Controls */}
                {filteredCandidates.length > pageSize && (
                  <div style={{
                    padding: "12px 18px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Showing <strong>{((page - 1) * pageSize) + 1}</strong> to <strong>{Math.min(page * pageSize, filteredCandidates.length)}</strong> of <strong>{filteredCandidates.length}</strong> candidate attempts
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-subtle)",
                          background: page <= 1 ? "#f1f5f9" : "#ffffff",
                          color: page <= 1 ? "#94a3b8" : "#334155",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: page <= 1 ? "not-allowed" : "pointer"
                        }}
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                        const isCur = num === page;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setPage(num)}
                            style={{
                              padding: "4px 9px",
                              borderRadius: "5px",
                              border: `1px solid ${isCur ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                              background: isCur ? "var(--accent-blue)" : "#ffffff",
                              color: isCur ? "#ffffff" : "#334155",
                              fontSize: "12px",
                              fontWeight: isCur ? "700" : "500",
                              cursor: "pointer"
                            }}
                          >
                            {num}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-subtle)",
                          background: page >= totalPages ? "#f1f5f9" : "#ffffff",
                          color: page >= totalPages ? "#94a3b8" : "#334155",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: page >= totalPages ? "not-allowed" : "pointer"
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
