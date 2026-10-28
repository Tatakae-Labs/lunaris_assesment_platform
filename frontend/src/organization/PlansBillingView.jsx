import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function PlansBillingView({ organizationId, currentPlanId, onPlanChanged }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState(currentPlanId || "institution");
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await api.getPlans();
      setPlans(res || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planCode) {
    setSubscribing(true);
    setAlertMsg(null);
    try {
      const res = await api.subscribePlan(organizationId, planCode);
      setSelectedPlanCode(planCode);
      setAlertMsg(`✓ Success: Activated ${res.plan.name} plan for this organization!`);
      if (onPlanChanged) onPlanChanged();
    } catch (err) {
      alert("Subscription update failed: " + err.message);
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner */}
      <div className="dash-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              💳 Commercial Plans & Resource Entitlements
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Freemium self-service subscription model with server-enforced quotas. Upgrade or customize based on your testing volume.
            </p>
          </div>
          <div style={{
            padding: "6px 14px",
            background: "var(--accent-emerald-subtle)",
            color: "var(--accent-emerald)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "700"
          }}>
            Active Tier: {selectedPlanCode === "institution" ? "Institution Proctored" : selectedPlanCode === "creator_pro" ? "Creator Pro" : "Free Starter"}
          </div>
        </div>

        {alertMsg && (
          <div style={{ marginTop: "16px", padding: "10px 14px", background: "var(--accent-emerald-subtle)", color: "var(--accent-emerald)", borderRadius: "6px", fontSize: "13px", fontWeight: "600" }}>
            {alertMsg}
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {plans.map((p) => {
          const isCurrent = p.code === selectedPlanCode;
          const isPopular = p.code === "institution";

          return (
            <div
              key={p.code}
              className="dash-card"
              style={{
                padding: "28px",
                position: "relative",
                border: isPopular ? "2px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              {isPopular && (
                <div style={{
                  position: "absolute",
                  top: "-12px",
                  right: "24px",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: "800",
                  letterSpacing: "0.5px"
                }}>
                  RECOMMENDED FOR COACHING
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>{p.name}</h3>
                </div>

                <p style={{ fontSize: "13px", color: "var(--text-secondary)", minHeight: "38px", marginBottom: "16px" }}>
                  {p.description}
                </p>

                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "32px", fontWeight: "900", fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                    ₹{p.price_inr.toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    / {p.billing_period}
                  </span>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "18px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px" }}>
                    Included Capabilities:
                  </div>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    {p.features?.map((f, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                disabled={subscribing || isCurrent}
                onClick={() => handleSubscribe(p.code)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "700",
                  background: isCurrent ? "var(--bg-secondary)" : isPopular ? "var(--accent-blue)" : "var(--text-primary)",
                  color: isCurrent ? "var(--text-muted)" : "#ffffff",
                  border: isCurrent ? "1px solid var(--border-subtle)" : "none",
                  cursor: isCurrent ? "default" : "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {isCurrent ? "Current Active Plan" : subscribing ? "Activating..." : `Select ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise Add-ons Note */}
      <div className="dash-card" style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>
            Need Custom Concurrency or On-Premise Lockdown Integration?
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            We support dedicated high-availability clusters for 100,000+ simultaneous candidates with enterprise SLA and custom data residency.
          </div>
        </div>
        <button
          type="button"
          onClick={() => alert("Enterprise sales inquiry logged for Allen Kota JEE Division!")}
          style={{
            padding: "8px 16px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "700",
            color: "var(--text-primary)"
          }}
        >
          Contact Enterprise Sales
        </button>
      </div>
    </div>
  );
}
