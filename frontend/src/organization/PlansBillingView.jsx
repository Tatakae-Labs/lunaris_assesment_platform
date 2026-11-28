import React, { useState, useEffect } from "react";
import { api } from "../shared/api";

export default function PlansBillingView({ organizationId, currentPlanId, onPlanChanged }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState(currentPlanId || "free");
  const [alertMsg, setAlertMsg] = useState(null);

  // UPI Checkout Modal State
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [payerVpa, setPayerVpa] = useState("");
  const [submittingUpi, setSubmittingUpi] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Payments History State
  const [myPayments, setMyPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Monthly Renewal Lifecycle State
  const [subStatus, setSubStatus] = useState(null);
  const [sendingTestReminder, setSendingTestReminder] = useState(false);

  // Razorpay Checkout State
  const [razorpayProcessing, setRazorpayProcessing] = useState(false);
  const [razorpayError, setRazorpayError] = useState(null);

  // Discount Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  useEffect(() => {
    loadPlans();
    if (organizationId) {
      loadMyPayments();
      loadSubStatus();
    }
  }, [organizationId]);

  async function loadSubStatus() {
    if (!organizationId) return;
    try {
      const res = await api.getSubscriptionStatus(organizationId);
      setSubStatus(res);
      if (res.plan_id) {
        setSelectedPlanCode(res.plan_id);
      }
    } catch (err) {
      console.error("Failed to load subscription status:", err);
    }
  }

  async function handleSendTestReminder() {
    if (!organizationId) return;
    setSendingTestReminder(true);
    try {
      const res = await api.testRenewalReminder(organizationId);
      alert(` ${res.message || "Test renewal reminder sent to your email!"}`);
    } catch (err) {
      alert("Failed to send test reminder: " + err.message);
    } finally {
      setSendingTestReminder(false);
    }
  }

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

  async function loadMyPayments() {
    if (!organizationId) return;
    setLoadingPayments(true);
    try {
      const res = await api.getOrgPayments(organizationId);
      setMyPayments(res || []);
    } catch (err) {
      console.error("Failed to load organization payments:", err);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function handleSelectPlan(plan) {
    if (plan.price_inr === 0) {
      // Free Starter plan can be activated directly
      setSubscribing(true);
      setAlertMsg(null);
      try {
        const res = await api.subscribePlan(organizationId, plan.code || plan.id);
        setSelectedPlanCode(plan.code || plan.id);
        setAlertMsg(` Success: Activated ${res.plan.name} plan for this organization!`);
        if (onPlanChanged) onPlanChanged();
      } catch (err) {
        alert("Subscription update failed: " + err.message);
      } finally {
        setSubscribing(false);
      }
    } else {
      // Paid plan -> open UPI Checkout Modal
      openUpiModal(plan);
    }
  }

  async function openUpiModal(plan) {
    setCheckoutPlan(plan);
    setLoadingCheckout(true);
    setUtrNumber("");
    setPayerVpa("");
    setCopiedUpi(false);
    setCopiedLink(false);
    setRazorpayError(null);
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError("");
    try {
      const info = await api.getUpiCheckoutInfo(organizationId, plan.code || plan.id);
      setCheckoutInfo(info);
    } catch (err) {
      alert("Failed to initialize checkout: " + err.message);
      setCheckoutPlan(null);
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function handleRazorpayCheckout() {
    if (!checkoutPlan) return;
    setRazorpayError(null);

    if (typeof window === "undefined" || !window.Razorpay) {
      setRazorpayError("Razorpay Checkout script failed to load. Please refresh the page.");
      return;
    }

    const rzpKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!rzpKeyId) {
      setRazorpayError("Razorpay Key ID (VITE_RAZORPAY_KEY_ID) is not configured.");
      return;
    }

    const baseAmountInr = checkoutInfo?.amount_inr || checkoutPlan.price_inr;
    const amountInr = appliedCoupon?.valid ? appliedCoupon.final_amount_inr : baseAmountInr;
    const amountPaise = Math.round(Number(amountInr) * 100);
    if (!amountPaise || amountPaise < 100) {
      setRazorpayError("Minimum payable amount is ₹1.00 (100 paise).");
      return;
    }

    setRazorpayProcessing(true);
    try {
      const order = await api.createRazorpayOrder({
        amount: amountPaise,
        currency: "INR",
        organization_id: organizationId,
        plan_id: checkoutPlan.code || checkoutPlan.id,
        coupon_code: appliedCoupon?.valid ? appliedCoupon.code : undefined
      });

      const options = {
        key: rzpKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "Lunaris Assessment Platform",
        description: `${checkoutPlan.name} Plan Subscription`,
        order_id: order.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await api.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              organization_id: organizationId,
              plan_id: checkoutPlan.code || checkoutPlan.id,
              amount_inr: amountInr,
              coupon_code: appliedCoupon?.valid ? appliedCoupon.code : undefined
            });

            if (verifyRes?.verified) {
              setSelectedPlanCode(checkoutPlan.code || checkoutPlan.id);
              setAlertMsg(`Payment verified! ${checkoutPlan.name} plan activated (Payment ID: ${response.razorpay_payment_id}).`);
              setCheckoutPlan(null);
              loadMyPayments();
              loadSubStatus();
              if (onPlanChanged) onPlanChanged();
            } else {
              setRazorpayError("Payment verification failed. Please contact support.");
            }
          } catch (verifyErr) {
            setRazorpayError("Payment signature verification failed: " + verifyErr.message);
          } finally {
            setRazorpayProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setRazorpayProcessing(false);
            setRazorpayError("Payment cancelled. You can retry anytime.");
          }
        },
        theme: {
          color: "#2563eb"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setRazorpayProcessing(false);
        const desc = resp?.error?.description || "Payment failed. Please try another method.";
        setRazorpayError(`Payment failed: ${desc}`);
      });
      rzp.open();
    } catch (err) {
      setRazorpayProcessing(false);
      setRazorpayError(err.message || "Could not initiate Razorpay checkout.");
    }
  }

  async function handleSubmitUpiPayment(e) {
    e.preventDefault();
    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 6) {
      alert("Please enter a valid 12-digit UTR or Transaction Reference number.");
      return;
    }

    setSubmittingUpi(true);
    try {
      await api.submitUpiPayment({
        organization_id: organizationId,
        plan_id: checkoutPlan.code || checkoutPlan.id,
        utr_number: cleanUtr,
        amount_inr: checkoutInfo?.amount_inr || checkoutPlan.price_inr,
        payer_vpa: payerVpa.trim(),
        notes: `Subscription upgrade to ${checkoutPlan.name}`
      });

      setAlertMsg(` UPI Payment with UTR ${cleanUtr} submitted successfully! Platform Administrator will verify the transaction.`);
      setCheckoutPlan(null);
      loadMyPayments();
      if (onPlanChanged) onPlanChanged();
    } catch (err) {
      alert("Payment submission failed: " + err.message);
    } finally {
      setSubmittingUpi(false);
    }
  }

  function copyToClipboard(text, isLink = false) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      }
    } else {
      prompt("Copy to clipboard:", text);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner */}
      <div className="dash-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Commercial Plans & Resource Entitlements
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Freemium self-service subscription model with server-enforced quotas. Instant UPI Gateway activation for fast onboarding.
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

      {/* Monthly Subscription Renewal & Lifecycle Banner */}
      {subStatus && (
        <div
          className="dash-card"
          style={{
            padding: "20px 24px",
            border: subStatus.is_past_due
              ? "2px solid #ef4444"
              : subStatus.is_expiring_soon
                ? "2px solid #f59e0b"
                : "1px solid var(--border-subtle)",
            background: subStatus.is_past_due
              ? "#fef2f2"
              : subStatus.is_expiring_soon
                ? "#fffbeb"
                : "#ffffff"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: subStatus.is_past_due ? "#fee2e2" : subStatus.is_expiring_soon ? "#fef3c7" : "var(--accent-blue-subtle)",
                color: subStatus.is_past_due ? "#dc2626" : subStatus.is_expiring_soon ? "#d97706" : "var(--accent-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px"
              }}>
                {subStatus.is_past_due ? "" : subStatus.is_expiring_soon ? "" : "📅"}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                    {subStatus.is_free_tier
                      ? "Free Starter Subscription"
                      : `${subStatus.plan_name} Monthly Subscription`}
                  </h3>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    background: subStatus.is_past_due
                      ? "#fecaca"
                      : subStatus.is_expiring_soon
                        ? "#fde68a"
                        : subStatus.is_free_tier
                          ? "var(--bg-secondary)"
                          : "#d1fae5",
                    color: subStatus.is_past_due
                      ? "#b91c1c"
                      : subStatus.is_expiring_soon
                        ? "#b45309"
                        : subStatus.is_free_tier
                          ? "var(--text-muted)"
                          : "#047857"
                  }}>
                    {subStatus.is_past_due
                      ? `Grace Period (${subStatus.grace_period_days_left}d left)`
                      : subStatus.is_expiring_soon
                        ? `Renews in ${subStatus.days_remaining}d`
                        : subStatus.is_free_tier
                          ? "Lifetime Free"
                          : `Active • ${subStatus.days_remaining}d remaining`}
                  </span>
                </div>

                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                  {subStatus.is_free_tier
                    ? "Your workspace is operating on the Free tier. Upgrade anytime to unlock proctored CBT and extended quotas."
                    : `Next scheduled monthly renewal: ${subStatus.renewal_date_formatted} (₹${subStatus.price_inr.toLocaleString("en-IN")}/mo)`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {!subStatus.is_free_tier && (
                <button
                  type="button"
                  onClick={handleSendTestReminder}
                  disabled={sendingTestReminder}
                  className="btn-secondary"
                  style={{ fontSize: "12px", height: "36px", padding: "0 12px" }}
                  title="Sends an automated monthly renewal reminder email to your registered email address"
                >
                  {sendingTestReminder ? "Sending..." : "Test Renewal Reminder Email"}
                </button>
              )}

              {subStatus.is_free_tier ? (
                <button
                  type="button"
                  onClick={() => {
                    const inst = plans.find(p => (p.code || p.id) === "institution") || plans[1];
                    if (inst) handleSelectPlan(inst);
                  }}
                  className="btn-primary"
                  style={{ fontSize: "13px", height: "38px" }}
                >
                  Upgrade to Pro Tier →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const current = plans.find(p => (p.code || p.id) === subStatus.plan_id) || plans[1];
                    if (current) handleSelectPlan(current);
                  }}
                  className="btn-primary"
                  style={{
                    fontSize: "13px",
                    height: "38px",
                    background: subStatus.is_past_due ? "#dc2626" : "var(--gradient-primary)"
                  }}
                >
                  {subStatus.is_past_due ? "Pay Renewal Now (UPI) →" : "Renew / Extend via UPI →"}
                </button>
              )}
            </div>
          </div>

          {!subStatus.is_free_tier && (
            <div style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px dashed var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--text-muted)"
            }}>
              <span>
                <strong>Automated Alerts:</strong> Email reminders are automatically sent at <strong>7 days</strong>, <strong>3 days</strong>, and <strong>1 day</strong> prior to renewal date, plus on renewal day with a 3-day grace period.
              </span>
              <span>
                Payment Gateway: <strong>NPCI UPI QR & VPA Instant Validation</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {plans.map((p) => {
          const isCurrent = (p.code || p.id) === selectedPlanCode;
          const isPopular = (p.code || p.id) === "institution";

          return (
            <div
              key={p.code || p.id}
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
                  RECOMMENDED FOR INSTITUTES
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
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", padding: 0 }}>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}></span>
                      <span>Candidates Enrolled: <strong>{p.entitlements?.max_candidates ?? "Unlimited"}</strong></span>
                    </li>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}></span>
                      <span>Simultaneous Exams: <strong>{p.entitlements?.max_exams ?? "Unlimited"}</strong></span>
                    </li>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}></span>
                      <span>AI Question Studio: <strong>{p.entitlements?.ai_questions ?? "0"} credits</strong></span>
                    </li>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}></span>
                      <span>Proctored CBT Lockdown: <strong>{p.entitlements?.proctoring_enabled ? "Included" : "Disabled"}</strong></span>
                    </li>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}>✓</span>
                      <span>{p.entitlements?.ads_enabled === false ? "Ad-Free Workspace Experience" : "Includes Sponsored Workspace Ads"}</span>
                    </li>
                    <li style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "bold" }}>✓</span>
                      <span>Razorpay &amp; Direct UPI Instant Checkout</span>
                    </li>
                    {(p.entitlements?.custom_features || []).map((feat, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent-blue)", fontWeight: "bold" }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {isCurrent ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: "var(--accent-emerald-subtle)",
                    color: "var(--accent-emerald)",
                    textAlign: "center"
                  }}>
                     Active Tier
                  </div>
                  {p.price_inr > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(p)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-primary)",
                        cursor: "pointer"
                      }}
                    >
                      Renew via UPI
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={subscribing}
                  onClick={() => handleSelectPlan(p)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "800",
                    background: isPopular ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: isPopular ? "0 4px 12px rgba(37,99,235,0.3)" : "none"
                  }}
                >
                  <span>⚡</span>
                  <span>{p.price_inr === 0 ? "Select Free Plan" : `Purchase & Pay ₹${p.price_inr.toLocaleString("en-IN")} via UPI`}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── UPI PAYMENT HISTORY & STATUS TABLE ── */}
      <div className="dash-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)" }}>
              📋 UPI Payment Submissions & Verification Status
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Track the verification status of your 12-digit UTR payment submissions.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMyPayments}
            disabled={loadingPayments}
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            {loadingPayments ? "Refreshing..." : " Refresh Status"}
          </button>
        </div>

        {myPayments.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            No UPI payments submitted yet. Select a plan above to pay via UPI and submit your UTR reference.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "10px 12px" }}>Submission Date</th>
                  <th style={{ padding: "10px 12px" }}>Plan</th>
                  <th style={{ padding: "10px 12px" }}>Amount</th>
                  <th style={{ padding: "10px 12px" }}>12-Digit UTR</th>
                  <th style={{ padding: "10px 12px" }}>Verification Status</th>
                  <th style={{ padding: "10px 12px" }}>Notes / Reason</th>
                </tr>
              </thead>
              <tbody>
                {myPayments.map((p) => {
                  const isApproved = p.status === "approved" || p.verified;
                  const isRejected = p.status === "rejected";
                  const isPending = !isApproved && !isRejected;

                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                        {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : "Recently"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: "700", color: "var(--text-primary)" }}>
                        {p.plan_name}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: "800", color: "var(--text-primary)" }}>
                        ₹{p.amount_inr?.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: "700", color: "var(--text-primary)" }}>
                        {p.utr_number}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {isApproved && (
                          <span style={{ padding: "4px 10px", background: "#dcfce7", color: "#166534", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                             Verified & Active
                          </span>
                        )}
                        {isRejected && (
                          <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#991b1b", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                            ✕ Payment Rejected
                          </span>
                        )}
                        {isPending && (
                          <span style={{ padding: "4px 10px", background: "#fef3c7", color: "#92400e", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                            ⏳ Pending Admin Verification
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: isRejected ? "#dc2626" : "var(--text-muted)", fontSize: "12px" }}>
                        {p.rejection_reason || (isApproved ? "Approved by Platform Admin" : "Awaiting statement match")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enterprise Custom Add-ons Note */}
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
          onClick={() => alert("Enterprise sales inquiry logged! Our team will reach out to your registered organization email.")}
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

      {/* ── UPI CHECKOUT MODAL ── */}
      {checkoutPlan && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          display: "grid",
          placeItems: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-primary, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            width: "100%",
            maxWidth: "520px",
            borderRadius: "16px",
            padding: "28px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "1px solid var(--border-subtle, #e2e8f0)",
            position: "relative",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <button
              type="button"
              onClick={() => setCheckoutPlan(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "var(--text-muted, #64748b)"
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#eff6ff",
                color: "#2563eb",
                fontSize: "24px",
                marginBottom: "10px"
              }}>
                
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "800" }}>Instant UPI Checkout</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)", marginTop: "4px" }}>
                Pay for <strong>{checkoutPlan.name}</strong> via any Indian UPI App
              </p>
            </div>

            {loadingCheckout ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                Generating dynamic UPI link and payment QR code...
              </div>
            ) : checkoutInfo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Amount & Payee Badge */}
                <div style={{
                  background: "var(--bg-secondary, #f8fafc)",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle, #e2e8f0)",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
                    Total Payable Amount
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "900", color: "#16a34a", margin: "4px 0" }}>
                    ₹{(appliedCoupon?.valid ? appliedCoupon.final_amount_inr : checkoutInfo.amount_inr)?.toLocaleString("en-IN")}
                  </div>
                  {appliedCoupon?.valid && (
                    <div style={{ fontSize: "12px", color: "#059669", fontWeight: "700", marginBottom: "4px" }}>
                      Promo {appliedCoupon.code} applied ({appliedCoupon.discount_percent}% OFF — Saved ₹{appliedCoupon.discount_amount_inr})
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                    Payee: <strong>{checkoutInfo.payee_name}</strong>
                  </div>
                </div>

                {/* Promo / Discount Coupon Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                      placeholder="Promo code (optional)"
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle, #cbd5e1)",
                        fontSize: "13px",
                        fontWeight: "600",
                        textTransform: "uppercase"
                      }}
                    />
                    <button
                      type="button"
                      disabled={!couponCode.trim() || validatingCoupon}
                      onClick={async () => {
                        setValidatingCoupon(true);
                        setCouponError("");
                        try {
                          const baseAmt = checkoutInfo?.amount_inr || checkoutPlan?.price_inr || 0;
                          const res = await api.validateCoupon(couponCode.trim(), baseAmt);
                          setAppliedCoupon(res);
                        } catch (err) {
                          setAppliedCoupon(null);
                          setCouponError(err.message || "Invalid coupon code");
                        } finally {
                          setValidatingCoupon(false);
                        }
                      }}
                      style={{
                        padding: "9px 14px",
                        borderRadius: "8px",
                        background: "#0f172a",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      {validatingCoupon ? "Checking..." : "Apply"}
                    </button>
                  </div>
                  {couponError && (
                    <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>{couponError}</div>
                  )}
                </div>

                {/* Razorpay Standard Web Checkout */}
                <div>
                  <button
                    type="button"
                    disabled={razorpayProcessing}
                    onClick={handleRazorpayCheckout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "13px 20px",
                      background: razorpayProcessing
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "800",
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)",
                      cursor: razorpayProcessing ? "not-allowed" : "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <span>{razorpayProcessing ? "Opening Razorpay Checkout..." : "Pay Instantly with Razorpay (Cards / UPI / NetBanking)"}</span>
                  </button>
                  {razorpayError && (
                    <div style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {razorpayError}
                    </div>
                  )}
                </div>

                {/* Direct Action 1: Mobile Instant Deep Link */}
                <div>
                  <a
                    href={checkoutInfo.upi_uri}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "12px 20px",
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      borderRadius: "8px",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "800",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <span>⚡ Pay via UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                  </a>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", textAlign: "center", marginTop: "4px" }}>
                    Tapping on mobile opens your installed UPI banking app directly.
                  </div>
                </div>

                {/* QR Code Presentation */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px",
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                    Or Scan QR Code with any Phone Camera / UPI App
                  </div>
                  <div style={{
                    padding: "10px",
                    background: "#ffffff",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    border: "1px solid #f1f5f9"
                  }}>
                    <img
                      src={checkoutInfo.qr_image_url}
                      alt="UPI Payment QR Code"
                      style={{ width: "180px", height: "180px", display: "block" }}
                    />
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", fontWeight: "700" }}>
                      UPI ID: {checkoutInfo.upi_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(checkoutInfo.upi_id)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: "700",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      {copiedUpi ? " Copied" : "📋 Copy"}
                    </button>
                  </div>
                  <div style={{ marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(checkoutInfo.upi_uri, true)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "11px",
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      {copiedLink ? " Payment Link Copied!" : "Copy raw UPI payment link (upi://pay?...)"}
                    </button>
                  </div>
                </div>

                {/* Step 3: Submit 12-digit UTR Verification */}
                <form onSubmit={handleSubmitUpiPayment} style={{ borderTop: "1px solid var(--border-subtle, #e2e8f0)", paddingTop: "18px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "800", marginBottom: "4px" }}>
                    Step 2: Enter 12-Digit UTR / Transaction Reference
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)", marginBottom: "12px" }}>
                    After completing payment in PhonePe/GPay/Paytm, find the 12-digit UTR/Ref No. in the payment details and paste it below.
                  </p>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                      12-Digit UPI Reference Number (UTR) *
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 429182749102"
                      maxLength={32}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle, #cbd5e1)",
                        fontSize: "14px",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        letterSpacing: "1px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                      Your UPI ID / Payer VPA (Optional)
                    </label>
                    <input
                      type="text"
                      value={payerVpa}
                      onChange={(e) => setPayerVpa(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle, #cbd5e1)",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUpi || !utrNumber.trim()}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: "800",
                      cursor: submittingUpi || !utrNumber.trim() ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)"
                    }}
                  >
                    {submittingUpi ? "Submitting Verification..." : " Submit Payment for Verification"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
