import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function PlatformAdminPortal({ onExit }) {
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard', 'organizations', 'plans', 'audit_logs'
  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    setActionMessage("");
    try {
      if (activeTab === "dashboard") {
        const s = await api.getPlatformStats();
        setStats(s);
      } else if (activeTab === "organizations") {
        const o = await api.getPlatformOrgs();
        setOrgs(o);
      } else if (activeTab === "plans") {
        const p = await api.getPlatformPlans();
        setPlans(p);
      } else if (activeTab === "audit_logs") {
        const l = await api.getPlatformAuditLogs();
        setAuditLogs(l);
      }
    } catch (err) {
      console.warn("Failed loading platform admin data:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleOrgStatus(org) {
    const newStatus = org.status === "active" ? "suspended" : "active";
    if (!window.confirm(`Are you sure you want to change ${org.name} status to ${newStatus}?`)) return;
    try {
      await api.updateOrgStatus(org.id, newStatus);
      setActionMessage(`Updated ${org.name} to ${newStatus}`);
      loadData();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  async function handleChangeOrgPlan(org, newPlanId) {
    try {
      await api.changeOrgPlan(org.id, newPlanId);
      setActionMessage(`Upgraded ${org.name} to ${newPlanId}`);
      loadData();
    } catch (err) {
      alert("Failed to change plan: " + err.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
      {/* Platform Admin Top Header */}
      <header style={{
        height: "64px",
        background: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            background: "#0f172a",
            color: "#ffffff",
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            fontWeight: "900",
            fontSize: "16px"
          }}>
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "800", lineHeight: "1" }}>
              Lunaris Platform Control Center
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Platform SuperAdmin Portal • SaaS Entitlements & Multi-Tenant Ops
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          background: "var(--bg-secondary)",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle)",
          gap: "4px"
        }}>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              background: activeTab === "dashboard" ? "#ffffff" : "transparent",
              color: activeTab === "dashboard" ? "var(--accent-blue)" : "var(--text-secondary)",
              boxShadow: activeTab === "dashboard" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
            }}
          >
            📊 Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("organizations")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              background: activeTab === "organizations" ? "#ffffff" : "transparent",
              color: activeTab === "organizations" ? "var(--accent-blue)" : "var(--text-secondary)",
              boxShadow: activeTab === "organizations" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
            }}
          >
            🏢 Organizations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plans")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              background: activeTab === "plans" ? "#ffffff" : "transparent",
              color: activeTab === "plans" ? "var(--accent-blue)" : "var(--text-secondary)",
              boxShadow: activeTab === "plans" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
            }}
          >
            💳 Plans & Entitlements
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit_logs")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              background: activeTab === "audit_logs" ? "#ffffff" : "transparent",
              color: activeTab === "audit_logs" ? "var(--accent-blue)" : "var(--text-secondary)",
              boxShadow: activeTab === "audit_logs" ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
            }}
          >
            📜 Audit Logs
          </button>
        </div>

        {/* Exit to Public / Workspace */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onExit}
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            Back to Public View
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1200px", margin: "32px auto", padding: "0 28px" }}>
        {actionMessage && (
          <div style={{
            padding: "10px 16px",
            background: "var(--accent-emerald-subtle)",
            color: "var(--accent-emerald)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "20px",
            border: "1px solid rgba(5, 150, 105, 0.2)"
          }}>
            ✓ {actionMessage}
          </div>
        )}

        {/* Tab 1: Dashboard Stats */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
                Platform Health & Metrics
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Real-time usage across all registered customer organizations.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "32px" }}>
              <div className="dash-card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Total Organizations</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--accent-blue)", marginTop: "4px" }}>
                  {stats?.total_organizations ?? "—"}
                </div>
              </div>
              <div className="dash-card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Active Subscriptions</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--accent-emerald)", marginTop: "4px" }}>
                  {stats?.active_subscriptions ?? "—"}
                </div>
              </div>
              <div className="dash-card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Total Published Exams</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--accent-cyan)", marginTop: "4px" }}>
                  {stats?.total_exams ?? "—"}
                </div>
              </div>
              <div className="dash-card" style={{ padding: "20px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Candidate Exam Attempts</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", marginTop: "4px" }}>
                  {stats?.total_attempts ?? "—"}
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="dash-card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>Platform Operations Checklist</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
                <div style={{ padding: "14px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <strong>Tenant Isolation Policy:</strong> PostgreSQL row-level or org-scoped schema check enabled. Cross-tenant queries are blocked.
                </div>
                <div style={{ padding: "14px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <strong>Proctoring Quota Tracking:</strong> Automatic counter decrements on candidate attempt start. Paid tiers receive dedicated quota pools.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Organizations Management */}
        {activeTab === "organizations" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800" }}>Customer Organizations</h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Manage tenant workspaces, plan entitlements, and active status.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={loadData} style={{ fontSize: "12px", padding: "6px 12px" }}>
                🔄 Refresh List
              </button>
            </div>

            <div className="dash-card" style={{ overflow: "hidden" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Owner Contact</th>
                    <th>Current Plan</th>
                    <th>Exams</th>
                    <th>Attempts</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <strong style={{ display: "block" }}>{org.name}</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Slug: {org.slug}</span>
                      </td>
                      <td>
                        <div>{org.owner.name}</div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{org.owner.email}</span>
                      </td>
                      <td>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "700",
                          background: org.plan_id === "institution" ? "var(--accent-blue-subtle)" : "var(--bg-secondary)",
                          color: org.plan_id === "institution" ? "var(--accent-blue)" : "var(--text-secondary)"
                        }}>
                          {org.plan_id.toUpperCase()}
                        </span>
                      </td>
                      <td>{org.exam_count}</td>
                      <td>{org.attempt_count}</td>
                      <td>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: org.status === "active" ? "var(--accent-emerald-subtle)" : "var(--accent-rose-subtle)",
                          color: org.status === "active" ? "var(--accent-emerald)" : "var(--accent-rose)"
                        }}>
                          {org.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleOrgStatus(org)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background: "var(--bg-secondary)",
                              color: org.status === "active" ? "var(--accent-rose)" : "var(--accent-emerald)",
                              border: "1px solid var(--border-subtle)"
                            }}
                          >
                            {org.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <select
                            value={org.plan_id}
                            onChange={(e) => handleChangeOrgPlan(org, e.target.value)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              background: "#ffffff",
                              border: "1px solid var(--border-subtle)"
                            }}
                          >
                            <option value="free">Free</option>
                            <option value="creator_pro">Creator Pro</option>
                            <option value="institution">Institution</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && !loading && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No customer organizations registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Plans & Entitlements */}
        {activeTab === "plans" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800" }}>Database-Driven Plans & Feature Entitlements</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Update subscription quotas, pricing, and proctoring allowances without application redeployment.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
              {plans.map((p) => (
                <div key={p.id} className="dash-card" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "800" }}>{p.name}</h3>
                    <span style={{ fontSize: "12px", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                      ID: {p.id}
                    </span>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--accent-blue)", marginBottom: "12px" }}>
                    ₹{p.price_inr} <span style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-muted)" }}>/{p.billing_period}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                    {p.description}
                  </p>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", fontSize: "12px" }}>
                    <strong style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
                      Active Entitlements:
                    </strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div>Max Candidates / Exam: <strong>{p.entitlements.max_candidates}</strong></div>
                      <div>Max Published Exams: <strong>{p.entitlements.max_exams}</strong></div>
                      <div>AI Question Credits: <strong>{p.entitlements.ai_questions}</strong></div>
                      <div>Proctoring Module: <strong>{p.entitlements.proctoring_enabled === "true" ? "Enabled (Live)" : "Disabled"}</strong></div>
                      <div>PDF Import: <strong>{p.entitlements.pdf_import === "true" ? "Allowed" : "Restricted"}</strong></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === "audit_logs" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800" }}>System & Administrative Audit Logs</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Auditable records for plan modifications, status changes, and administrative actions.
              </p>
            </div>

            <div className="dash-card" style={{ overflow: "hidden" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Action</th>
                    <th>Actor ID</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: "var(--bg-secondary)",
                          color: "var(--accent-blue)"
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px" }}>{log.actor_id || "System"}</td>
                      <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                          {JSON.stringify(log.metadata, null, 1)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && !loading && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
