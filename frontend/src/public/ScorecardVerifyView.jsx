import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../shared/api";

export default function ScorecardVerifyView() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      setLoading(true);
      setError("");
      try {
        const res = await api.verifyScorecardPublic(attemptId);
        if (!cancelled) setRecord(res);
      } catch (err) {
        if (!cancelled) setError(err.message || "Verification record not found or invalid.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (attemptId) verify();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "560px",
        background: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "20px 24px",
          background: "#0f172a",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo.png" alt="Lunaris" style={{ width: "28px", height: "28px", borderRadius: "6px" }} />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800" }}>Lunaris Scorecard Verification</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>Cryptographic Credential Check</div>
            </div>
          </div>
          {record?.verified && (
            <span style={{
              background: "#10b981",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "800",
              padding: "4px 10px",
              borderRadius: "999px"
            }}>
              VERIFIED
            </span>
          )}
        </div>

        <div style={{ padding: "24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b", fontSize: "14px" }}>
              Verifying credential record...
            </div>
          ) : error ? (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "16px",
              color: "#dc2626",
              fontSize: "13px",
              fontWeight: "600",
              textAlign: "center"
            }}>
              {error}
            </div>
          ) : record ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase" }}>
                {record.organization_name}
              </div>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                {record.exam_title}
              </h1>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginTop: "8px",
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "10px",
                border: "1px solid #e2e8f0"
              }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Candidate Name</div>
                  <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: "700" }}>{record.candidate_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Candidate UID</div>
                  <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: "700" }}>{record.candidate_uid}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Score Achieved</div>
                  <div style={{ fontSize: "16px", color: "#059669", fontWeight: "800" }}>{Number(record.score_total || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>AI Integrity Score</div>
                  <div style={{ fontSize: "16px", color: "#2563eb", fontWeight: "800" }}>{record.integrity_score} / 100</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Status</div>
                  <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: "700", textTransform: "capitalize" }}>{record.status}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Submitted At</div>
                  <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>
                    {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : "N/A"}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#94a3b8", wordBreak: "break-all" }}>
                Attempt ID: {record.attempt_id}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
