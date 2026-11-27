import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon
} from "../shared/Icons";

const SERVICE_DEFINITIONS = [
  {
    key: "ai_studio",
    title: "AI Question Studio & Synthesizer",
    desc: "Gemini / Groq LLM pipeline for automated curriculum item, MCQ, and numerical question synthesis.",
    icon: BotIcon,
    category: "Authoring"
  },
  {
    key: "live_proctoring",
    title: "MediaPipe Candidate AI Proctoring",
    desc: "Real-time webcam gaze tracking, multiple face detection, and ambient integrity alerts.",
    icon: VideoIcon,
    category: "Integrity"
  },
  {
    key: "proctor_console",
    title: "Live Proctor Monitoring Console",
    desc: "Multi-stream surveillance feed for faculty and human invigilators with direct warning dispatch.",
    icon: ShieldIcon,
    category: "Operations"
  },
  {
    key: "quick_quiz",
    title: "Quick Quiz Multiplayer Arena",
    desc: "Real-time competitive classroom arena with countdown timers and speed-scoring leaderboards.",
    icon: ZapIcon,
    category: "Engagement"
  },
  {
    key: "bulk_enrollment",
    title: "Candidate Enrollment Manager",
    desc: "Batch candidate roll number / PIN generation, CSV roster uploads, and instant access tokens.",
    icon: UsersIcon,
    category: "Access"
  },
  {
    key: "pdf_import",
    title: "PDF Exam & Question Bank Import",
    desc: "Direct parsing of academic examination papers and automatic item bank synchronization.",
    icon: FileTextIcon,
    category: "Authoring"
  },
  {
    key: "detailed_analytics",
    title: "Advanced Exam Analytics & Reports",
    desc: "Item discrimination index, score percentile curves, and candidate audit logs.",
    icon: BarChartIcon,
    category: "Reporting"
  },
  {
    key: "advanced_scoring",
    title: "Advanced Scoring & Numerical Engine",
    desc: "Custom negative marking schemes, sectional cutoff thresholds, and float tolerance checks.",
    icon: TargetIcon,
    category: "Grading"
  }
];

export default function PlatformAdminPortal({ onExit, onLogout, currentUser }) {
  // Navigation: 'analytics', 'organizations', 'plans', 'payments', 'exam_stats', 'audit_logs', 'admin_team'
  const [activeView, setActiveView] = useState("organizations");
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState("");

  // Determine RBAC level: exactly ONE Main Super Administrator (sole owner)
  const isMainSuperAdmin = Boolean(
    currentUser?.admin_role === "superadmin" ||
    currentUser?.email?.toLowerCase() === "superadmin@lunaris.com" ||
    (!currentUser?.admin_role && currentUser?.is_superadmin)
  );
  const currentAdminRole = isMainSuperAdmin ? "superadmin" : (currentUser?.admin_role || "platform_admin");

  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState({
    gateway: "razorpay",
    live_mode: true,
    upi_enabled: true,
    upi_id: "demostore@examplebank",
    upi_payee_name: "Sharma General Store",
    upi_merchant_code: "5411",
    razorpay_key_id: "",
    razorpay_key_secret: "",
    stripe_publishable_key: "",
    stripe_secret_key: "",
    currency: "INR",
    tax_percentage: 18,
    hsn_sac_code: "998431",
    auto_invoice: true,
    invoice_prefix: "LUN-INV-2026-",
    billing_legal_name: "Lunaris Assessment Technologies Private Limited",
    billing_contact_email: "billing@lunaris.com",
    settlement_account: ""
  });
  const [paymentsList, setPaymentsList] = useState([]);
  const [paymentsFilter, setPaymentsFilter] = useState("approved"); // default to approved per user request
  const [paymentSubTab, setPaymentSubTab] = useState("customers"); // "customers", "queue", or "settings"
  const [actualCustomers, setActualCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState(null);

  // System Audit Trail with Server-Side & Client-Side Pagination
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Admin Team & RBAC Management state
  const [adminTeam, setAdminTeam] = useState([]);
  const [loadingAdminTeam, setLoadingAdminTeam] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    email: "",
    full_name: "",
    password: "",
    admin_role: "platform_admin"
  });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState(null);
  const [adminRoleForm, setAdminRoleForm] = useState({
    admin_role: "platform_admin",
    status: "active"
  });

  // Search & Filter
  const [orgSearch, setOrgSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");

  // Members Management Modal state
  const [selectedMembersOrg, setSelectedMembersOrg] = useState(null);
  const [orgMembersList, setOrgMembersList] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [actionLoadingUserId, setActionLoadingUserId] = useState(null);

  // Modals state
  const [selectedServicesOrg, setSelectedServicesOrg] = useState(null);
  const [servicesState, setServicesState] = useState({});
  const [propertiesState, setPropertiesState] = useState({});
  const [savingServices, setSavingServices] = useState(false);

  const [selectedSubOrg, setSelectedSubOrg] = useState(null);
  const [subFormData, setSubFormData] = useState({
    plan_id: "creator_pro",
    status: "active",
    extend_days: 30,
    proctoring_quota: 100,
    ai_credits: 250
  });

  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name: "",
    slug: "",
    owner_email: "",
    owner_name: "",
    plan_id: "creator_pro",
    ai_generation_credits: 250,
    proctoring_attempts_quota: 100,
    services: {
      ai_studio: true,
      live_proctoring: true,
      proctor_console: true,
      quick_quiz: true,
      bulk_enrollment: true,
      pdf_import: true,
      detailed_analytics: true,
      advanced_scoring: true
    }
  });

  const [editingPlan, setEditingPlan] = useState(null);
  const [planFormData, setPlanFormData] = useState({
    name: "",
    price_inr: 0,
    billing_period: "monthly",
    description: "",
    entitlements: {
      max_candidates: "50",
      max_exams: "5",
      ai_questions: "50",
      proctoring_enabled: "true",
      pdf_import: "true"
    }
  });

  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    id: "",
    name: "",
    price_inr: 4999,
    billing_period: "monthly",
    description: "",
    entitlements: {
      max_candidates: "250",
      max_exams: "25",
      ai_questions: "500",
      proctoring_enabled: "true",
      pdf_import: "true"
    }
  });

  const [savingPayments, setSavingPayments] = useState(false);
  const [publicSiteSettings, setPublicSiteSettings] = useState({
    announcement_active: false,
    announcement_text: "",
    announcement_link: "",
    site_headline: "All-in-one assessment engine with on-device anti-cheat",
    site_subtitle: "Conduct secure computer-based assessments, buzzer quick quizzes, and auto-graded evaluations with real-time video invigilation.",
    contact_email: "support@lunaris.com",
    support_phone: "+91 98765 43210",
    platform_status: "Operational"
  });
  const [savingPublicSite, setSavingPublicSite] = useState(false);

  useEffect(() => {
    loadViewData();
  }, [activeView]);

  async function loadViewData() {
    setLoading(true);
    setActionNotice("");
    try {
      if (activeView === "analytics" || activeView === "exam_stats") {
        const a = await api.getPlatformDeepAnalytics().catch(() => null);
        setAnalytics(a);
        const o = await api.getPlatformOrgs().catch(() => []);
        setOrgs(o);
      } else if (activeView === "organizations") {
        const o = await api.getPlatformOrgs().catch(() => []);
        setOrgs(o);
      } else if (activeView === "plans") {
        const p = await api.getPlatformPlans().catch(() => []);
        setPlans(p);
      } else if (activeView === "payments") {
        const pay = await api.getPlatformPaymentSettings().catch(() => null);
        if (pay) setPaymentSettings(pay);
        const plist = await api.getPlatformPayments().catch(() => []);
        setPaymentsList(plist || []);
        const custs = await api.getPlatformCustomers().catch(() => []);
        setActualCustomers(custs || []);
      } else if (activeView === "audit_logs") {
        await loadAuditLogs(auditPage, auditPageSize, auditSearch, auditActionFilter);
      } else if (activeView === "admin_team") {
        await loadAdminTeam();
      } else if (activeView === "public_site") {
        const s = await api.getPublicSiteSettings().catch(() => null);
        if (s) setPublicSiteSettings(s);
        const p = await api.getPlatformPlans().catch(() => []);
        setPlans(p);
      }
    } catch (err) {
      console.warn("View data load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePublicSiteSettings(e) {
    if (e) e.preventDefault();
    setSavingPublicSite(true);
    setActionNotice("");
    try {
      const res = await api.updatePublicSiteSettings(publicSiteSettings);
      if (res) setPublicSiteSettings(res.settings || res);
      setActionNotice("Public website settings saved and published successfully.");
      setTimeout(() => setActionNotice(""), 4000);
    } catch (err) {
      alert("Failed to save public site settings: " + (err.message || "Unknown error"));
    } finally {
      setSavingPublicSite(false);
    }
  }

  // Load audit logs with pagination & filtering
  async function loadAuditLogs(page = 1, pageSize = 25, search = "", filter = "all") {
    setLoadingAudit(true);
    try {
      const res = await api.getPlatformAuditLogs({
        page,
        page_size: pageSize,
        search,
        action_filter: filter
      });
      if (res && res.items) {
        setAuditLogs(res.items);
        setAuditTotal(res.total);
        setAuditPage(res.page);
        setAuditTotalPages(res.total_pages);
      } else if (Array.isArray(res)) {
        setAuditLogs(res);
        setAuditTotal(res.length);
        setAuditTotalPages(1);
      }
    } catch (err) {
      console.warn("Failed to load audit logs:", err);
    } finally {
      setLoadingAudit(false);
    }
  }

  // Load admin personnel team
  async function loadAdminTeam() {
    setLoadingAdminTeam(true);
    try {
      const res = await api.getPlatformAdmins();
      setAdminTeam(res || []);
    } catch (err) {
      console.warn("Failed to load admin team:", err);
    } finally {
      setLoadingAdminTeam(false);
    }
  }

  // Admin Team Actions
  async function handleCreateAdminSubmit(e) {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      const res = await api.createPlatformAdmin(newAdminForm);
      setActionNotice(res.message);
      setShowCreateAdminModal(false);
      setNewAdminForm({ email: "", full_name: "", password: "", admin_role: "platform_admin" });
      loadAdminTeam();
    } catch (err) {
      alert("Failed to provision admin staff: " + err.message);
    } finally {
      setSavingAdmin(false);
    }
  }

  async function handleUpdateAdminRole(e) {
    e.preventDefault();
    if (!editingAdminUser) return;
    try {
      const res = await api.updatePlatformAdminRole(editingAdminUser.id, adminRoleForm);
      setActionNotice(res.message);
      setEditingAdminUser(null);
      loadAdminTeam();
    } catch (err) {
      alert("Failed to update admin role: " + err.message);
    }
  }

  async function handleRevokeAdmin(adminUser) {
    if (adminUser.is_main_superadmin) {
      alert("The primary super admin cannot be revoked.");
      return;
    }
    if (!window.confirm(`Revoke administrative dashboard privileges for "${adminUser.full_name || adminUser.email}"?`)) return;
    try {
      const res = await api.revokePlatformAdmin(adminUser.id);
      setActionNotice(res.message);
      loadAdminTeam();
    } catch (err) {
      alert("Failed to revoke admin: " + err.message);
    }
  }

  // Load actual paying customers on demand
  async function loadActualCustomers() {
    setLoadingCustomers(true);
    try {
      const custs = await api.getPlatformCustomers();
      setActualCustomers(custs || []);
    } catch (err) {
      console.warn("Failed to load actual customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  }

  // Organization Actions
  async function handleToggleOrgStatus(org) {
    const nextStatus = org.status === "active" ? "suspended" : "active";
    if (!window.confirm(`Are you sure you want to change status of "${org.name}" to ${nextStatus}?`)) return;
    try {
      await api.updateOrgStatus(org.id, nextStatus);
      setActionNotice(`Organization "${org.name}" status updated to ${nextStatus}.`);
      loadViewData();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  async function handleDeleteOrg(org) {
    if (!window.confirm(`WARNING - DESTRUCTIVE ACTION: Completely delete "${org.name}", its users, exams, and all subscriptions? This cannot be undone.`)) return;
    try {
      await api.deletePlatformOrg(org.id);
      setActionNotice(`Organization "${org.name}" and all associated data permanently deleted.`);
      loadViewData();
    } catch (err) {
      alert("Failed to delete organization: " + err.message);
    }
  }

  // Remove / Revoke Subscription from Organization
  async function handleRemoveSubscription(org) {
    if (!window.confirm(`WARNING: Revoke and remove subscription for "${org.name}"? This will reset the institution to the Free Starter tier and revoke their paid quotas.`)) return;
    try {
      await api.removePlatformOrgSubscription(org.id);
      setActionNotice(`Subscription removed for "${org.name}". Plan reset to Free tier.`);
      loadViewData();
    } catch (err) {
      alert("Failed to remove subscription: " + err.message);
    }
  }

  // Members Management Handlers
  async function openMembersModal(org) {
    setSelectedMembersOrg(org);
    setLoadingMembers(true);
    try {
      const data = await api.getPlatformOrgMembers(org.id);
      setOrgMembersList(data?.members || data || []);
    } catch (err) {
      alert("Failed to load members: " + err.message);
      setOrgMembersList([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleRemoveMember(userId, memberName) {
    if (!selectedMembersOrg) return;
    if (!window.confirm(`Remove member "${memberName || userId}" from "${selectedMembersOrg.name}"? They will lose access to this institution.`)) return;
    setActionLoadingUserId(userId);
    try {
      await api.removePlatformOrgMember(selectedMembersOrg.id, userId);
      setActionNotice(`Member removed from ${selectedMembersOrg.name}.`);
      const updated = await api.getPlatformOrgMembers(selectedMembersOrg.id);
      setOrgMembersList(updated?.members || updated || []);
    } catch (err) {
      alert("Failed to remove member: " + err.message);
    } finally {
      setActionLoadingUserId(null);
    }
  }

  async function handleDeleteUser(userId, memberName) {
    if (!window.confirm(`WARNING - DESTRUCTIVE ACTION: Permanently delete user account "${memberName || userId}" from the entire platform? All associated test attempts and sessions will be removed.`)) return;
    setActionLoadingUserId(userId);
    try {
      await api.deletePlatformUser(userId);
      setActionNotice(`User account "${memberName || userId}" permanently deleted.`);
      if (selectedMembersOrg) {
        const updated = await api.getPlatformOrgMembers(selectedMembersOrg.id);
        setOrgMembersList(updated?.members || updated || []);
      }
      loadViewData();
    } catch (err) {
      alert("Failed to delete user: " + err.message);
    } finally {
      setActionLoadingUserId(null);
    }
  }

  // Services Modal
  function openServicesModal(org) {
    setSelectedServicesOrg(org);
    const defaults = {
      ai_studio: true,
      live_proctoring: true,
      proctor_console: true,
      quick_quiz: true,
      bulk_enrollment: true,
      pdf_import: true,
      detailed_analytics: true,
      advanced_scoring: true
    };
    setServicesState({ ...defaults, ...(org.services || {}) });
    const defaultProps = {
      allow_self_registration: true,
      require_webcam_preflight: true,
      strict_lockdown: true,
      max_concurrent_sessions: 250,
      watermark_text: "LUNARIS ASSESSMENT",
      external_lms_sync: false
    };
    setPropertiesState({ ...defaultProps, ...(org.properties || {}) });
  }

  async function handleSaveServices() {
    if (!selectedServicesOrg) return;
    setSavingServices(true);
    try {
      await api.updatePlatformOrgServices(selectedServicesOrg.id, servicesState, propertiesState);
      setActionNotice(`Saved service configurations & property systems for "${selectedServicesOrg.name}".`);
      setSelectedServicesOrg(null);
      loadViewData();
    } catch (err) {
      alert("Failed to update services: " + err.message);
    } finally {
      setSavingServices(false);
    }
  }

  // Subscription Modal
  function openSubModal(org) {
    setSelectedSubOrg(org);
    setSubFormData({
      plan_id: org.plan_id || "creator_pro",
      status: org.status || "active",
      extend_days: 30,
      proctoring_quota: org.proctoring_quota || 100,
      ai_credits: org.ai_generation_credits || 250
    });
  }

  async function handleSaveSubscription(e) {
    e.preventDefault();
    if (!selectedSubOrg) return;
    try {
      await api.updatePlatformOrgSubscription(selectedSubOrg.id, subFormData);
      setActionNotice(`Updated subscription quotas for "${selectedSubOrg.name}".`);
      setSelectedSubOrg(null);
      loadViewData();
    } catch (err) {
      alert("Failed to update subscription: " + err.message);
    }
  }

  // Create Organization
  async function handleCreateOrgSubmit(e) {
    e.preventDefault();
    try {
      await api.createPlatformOrg(newOrgForm);
      setActionNotice(`Created new organization "${newOrgForm.name}".`);
      setShowCreateOrgModal(false);
      setNewOrgForm({
        name: "",
        slug: "",
        owner_email: "",
        owner_name: "",
        plan_id: "creator_pro",
        ai_generation_credits: 250,
        proctoring_attempts_quota: 100,
        services: {
          ai_studio: true,
          live_proctoring: true,
          proctor_console: true,
          quick_quiz: true,
          bulk_enrollment: true,
          pdf_import: true,
          detailed_analytics: true,
          advanced_scoring: true
        }
      });
      loadViewData();
    } catch (err) {
      alert("Failed to create organization: " + err.message);
    }
  }

  // Plan Management Handlers
  function openEditPlan(plan) {
    setEditingPlan(plan);
    setPlanFormData({
      name: plan.name,
      price_inr: plan.price_inr,
      billing_period: plan.billing_period || "monthly",
      description: plan.description || "",
      entitlements: {
        max_candidates: String(plan.entitlements?.max_candidates ?? "50"),
        max_exams: String(plan.entitlements?.max_exams ?? "5"),
        ai_questions: String(plan.entitlements?.ai_questions ?? "50"),
        proctoring_enabled: String(plan.entitlements?.proctoring_enabled ?? "true"),
        proctoring_quota: String(plan.entitlements?.proctoring_quota ?? "50"),
        pdf_import: String(plan.entitlements?.pdf_import ?? "true")
      }
    });
  }

  async function handleTogglePlanProctoring(planId) {
    try {
      const res = await api.togglePlanProctoring(planId);
      setActionNotice(res.message || "Proctoring module toggle updated.");
      loadViewData();
    } catch (err) {
      alert("Failed to toggle proctoring: " + err.message);
    }
  }

  async function handleSyncOrgPlanAllotment(orgId, orgName) {
    try {
      const res = await api.syncOrgPlanAllotment(orgId);
      setActionNotice(res.message || `Synchronized allotment for ${orgName}.`);
      loadViewData();
    } catch (err) {
      alert("Failed to sync allotment: " + err.message);
    }
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      await api.updatePlan(editingPlan.id, planFormData);
      setActionNotice(`Plan "${planFormData.name}" updated successfully.`);
      setEditingPlan(null);
      loadViewData();
    } catch (err) {
      alert("Failed to update plan: " + err.message);
    }
  }

  async function handleCreatePlanSubmit(e) {
    e.preventDefault();
    try {
      await api.createPlatformPlan(newPlanForm);
      setActionNotice(`Created new subscription plan "${newPlanForm.name}".`);
      setShowCreatePlanModal(false);
      loadViewData();
    } catch (err) {
      alert("Failed to create plan: " + err.message);
    }
  }

  async function handleDeletePlan(planId, planName) {
    if (!window.confirm(`Delete plan "${planName}"?`)) return;
    try {
      await api.deletePlatformPlan(planId);
      setActionNotice(`Plan "${planName}" removed.`);
      loadViewData();
    } catch (err) {
      alert("Failed to delete plan: " + err.message);
    }
  }

  // Save Payment Settings
  async function handleSavePaymentSettings(e) {
    e.preventDefault();
    setSavingPayments(true);
    try {
      await api.updatePlatformPaymentSettings(paymentSettings);
      setActionNotice("Payment gateway configuration & billing settings updated successfully!");
    } catch (err) {
      alert("Failed to save payment settings: " + err.message);
    } finally {
      setSavingPayments(false);
    }
  }

  // UPI Payment Verification Action (Approve / Reject)
  async function handleVerifyPayment(paymentId, action) {
    let rejectionReason = "";
    if (action === "approve") {
      if (!window.confirm("Approve this UPI transaction and activate subscription for the organization?")) return;
    } else {
      rejectionReason = window.prompt("Reason for rejecting payment (UTR not found / mismatched amount):", "UTR reference not found in bank account statement");
      if (!rejectionReason) return;
    }

    setProcessingPaymentId(paymentId);
    try {
      const res = await api.verifyPlatformPayment(paymentId, { action, rejection_reason: rejectionReason });
      setActionNotice(res.message);
      const plist = await api.getPlatformPayments().catch(() => []);
      setPaymentsList(plist || []);
    } catch (err) {
      alert("Payment action failed: " + err.message);
    } finally {
      setProcessingPaymentId(null);
    }
  }

  // Purge Mock Data
  async function handlePurgeMockData() {
    if (!window.confirm("ATTENTION: This will purge all mock test records, demo institutions, fake attempts, and candidate test sessions. Only the Platform Super Admin account will remain. Continue?")) return;
    try {
      const res = await api.purgeMockData();
      alert(res.message);
      setActionNotice("All mock data has been purged successfully.");
      loadViewData();
    } catch (err) {
      alert("Failed to purge mock data: " + err.message);
    }
  }

  // Clear Audit Logs
  async function handleClearAuditLogs() {
    if (!window.confirm("Permanently clear all system audit logs from SQLite and MongoDB database?")) return;
    try {
      const res = await api.clearPlatformAuditLogs();
      setActionNotice(res.message || "Audit trail permanently cleared from DB.");
      loadViewData();
    } catch (err) {
      alert("Failed to clear audit logs: " + err.message);
    }
  }

  // Clear / Wipe Platform Test Database
  async function handleClearDatabase() {
    if (!window.confirm("WARNING: Are you sure you want to permanently clear and purge all non-superadmin test organizations, attempts, and records from the database (SQLite & MongoDB)? This action cannot be undone!")) return;
    try {
      const res = await api.clearPlatformDatabase();
      setActionNotice(res.message || "Platform database wiped and reset to clean production state.");
      loadViewData();
    } catch (err) {
      alert("Failed to clear database: " + err.message);
    }
  }

  // Filtered Orgs
  const filteredOrgs = orgs.filter(o => {
    const matchesSearch = !orgSearch.trim() ||
      o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      o.slug.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (o.owner?.email && o.owner.email.toLowerCase().includes(orgSearch.toLowerCase()));
    const matchesPlan = planFilter === "all" || o.plan_id === planFilter;
    return matchesSearch && matchesPlan;
  });

  const filteredAudits = auditLogs.filter(a => {
    if (!auditSearch.trim()) return true;
    const term = auditSearch.toLowerCase();
    return (a.action && a.action.toLowerCase().includes(term)) ||
      (a.actor_id && a.actor_id.toLowerCase().includes(term));
  });

  return (
    <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", width: "100vw", overflow: "hidden", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* ── HIGH-END SIDEBAR (PURE WHITE THEME) ───────────────────────── */}
      <aside style={{
        width: "260px",
        height: "100vh",
        maxHeight: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        background: "#ffffff",
        color: "#0f172a",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0
      }}>
        {/* Brand Header */}
        <div style={{ padding: "24px 20px 20px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/logo.png"
              alt="Lunaris"
              style={{
                width: "38px",
                height: "38px",
                objectFit: "contain",
                borderRadius: "50%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}
            />
            <div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.2px" }}>LUNARIS</div>
              <div style={{ fontSize: "9px", color: "#2563eb", fontWeight: "700", letterSpacing: "0.5px" }}>ASSESSMENT PLATFORM · ADMIN</div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", padding: "8px 10px", letterSpacing: "0.6px", textTransform: "uppercase" }}>
            Platform Governance
          </div>

          {[
            { id: "organizations", label: "Organizations & Services", icon: BuildingIcon },
            { id: "analytics", label: "Executive Analytics", icon: BarChartIcon },
            { id: "exam_stats", label: "Exam Statistics & CBT", icon: TargetIcon },
            { id: "plans", label: "Plans & Feature Quotas", icon: CreditCardIcon },
            { id: "payments", label: "UPI & Payment Gateway", icon: ZapIcon },
            { id: "audit_logs", label: "System Audit Trail", icon: FileTextIcon },
            { id: "admin_team", label: "Admin Team & RBAC", icon: UsersIcon },
            { id: "public_site", label: "Public Website CMS", icon: GlobeIcon },
          ].map(item => {
            const active = activeView === item.id;
            const pendingPaymentsCount = paymentsList.filter(p => p.status === "pending" || (!p.verified && p.status !== "rejected")).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: active ? "700" : "600",
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  border: active ? "1px solid #bfdbfe" : "1px solid transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {item.icon && <item.icon size={16} />}
                <span>{item.label}</span>
                {item.id === "payments" && pendingPaymentsCount > 0 && (
                  <span style={{
                    marginLeft: "auto",
                    background: "#f59e0b",
                    color: "#ffffff",
                    padding: "1px 7px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    fontWeight: "900"
                  }}>
                    {pendingPaymentsCount}
                  </span>
                )}
                {active && (item.id !== "payments" || pendingPaymentsCount === 0) && (
                  <span style={{ marginLeft: "auto", width: "4px", height: "14px", borderRadius: "2px", background: "#2563eb" }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div style={{ padding: "16px 14px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <button
            type="button"
            onClick={() => onLogout ? onLogout() : onExit()}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
            title="Sign out of administration portal"
          >
            <LogOutIcon size={14} /> Sign Out
          </button>
          <button
            type="button"
            onClick={onExit}
            style={{
              width: "100%",
              padding: "6px 12px",
              background: "transparent",
              color: "#64748b",
              border: "none",
              fontSize: "11px",
              cursor: "pointer",
              textAlign: "center",
              fontWeight: "600"
            }}
          >
            Return to Public Website
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", maxHeight: "100vh", overflow: "hidden" }}>
        {/* Top Header */}
        <header style={{
          height: "64px",
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          top: 0,
          zIndex: 40
        }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
              {activeView === "organizations" && "Tenant Organizations & Services Master Control"}
              {activeView === "analytics" && "Platform Executive Analytics & Growth Telemetry"}
              {activeView === "exam_stats" && "CBT Examination Engine & Item Statistics"}
              {activeView === "plans" && "Subscription Plans, Pricing & Entitlement Quotas"}
              {activeView === "payments" && "UPI Payment Gateway, UTR Verification & GST Settings"}
              {activeView === "audit_logs" && "Platform Administrative Audit Trail"}
              {activeView === "admin_team" && "Administration Team & Role-Based Access Control (RBAC)"}
              {activeView === "public_site" && "Public Website CMS, Announcement Banner & Live Settings"}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>User: <strong>{currentUser?.email || "superadmin@lunaris.com"}</strong></span>
              <span>•</span>
              <span style={{
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: "800",
                background: isMainSuperAdmin ? "#fef3c7" : "#eff6ff",
                color: isMainSuperAdmin ? "#92400e" : "#1d4ed8",
                border: isMainSuperAdmin ? "1px solid #fde68a" : "1px solid #bfdbfe"
              }}>
                {isMainSuperAdmin ? "Main Super Admin (Sole Owner)" : `${currentAdminRole.replace("_", " ").toUpperCase()}`}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadViewData}
              style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshIcon size={13} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => onLogout ? onLogout() : onExit()}
              style={{
                padding: "6px 14px",
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
              title="Sign out of administration portal"
            >
              <LogOutIcon size={14} /> Logout
            </button>
          </div>
        </header>

        {/* Scrollable Content Body (keeps sidebar & top header fixed) */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {/* Action Notice Toast */}
        {actionNotice && (
          <div style={{
            margin: "20px 32px 0 32px",
            padding: "12px 18px",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            border: "1px solid #a7f3d0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><CheckIcon size={14} color="#16a34a" /> {actionNotice}</span>
            <button type="button" onClick={() => setActionNotice("")} style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontWeight: "800" }}><XIcon size={18} /></button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 1: ORGANIZATIONS & SERVICES                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "organizations" && (
          <div style={{ padding: "28px 32px" }}>
            {/* Header with Search and New Org CTA */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>Customer Tenant Organizations</h2>
                <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  Selectively allow or revoke individual services (AI Studio, Live Proctoring, Quick Quiz) and property systems per tenant.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Filter orgs, slugs, owners..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    width: "240px",
                    background: "#ffffff"
                  }}
                />
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free Starter</option>
                  <option value="creator_pro">Creator Pro</option>
                  <option value="institution">Institution</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateOrgModal(true)}
                  style={{
                    padding: "8px 16px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>＋</span> Provision Organization
                </button>
              </div>
            </div>

            {/* Organizations Grid / Table */}
            <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>ORGANIZATION</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>OWNER CONTACT</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>PLAN & QUOTAS</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>SERVICE CONTROLS</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>ACTIVITY</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px" }}>STATUS</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569", letterSpacing: "0.5px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((org) => {
                    const serv = org.services || {};
                    const activeCount = Object.values(serv).filter(Boolean).length;
                    const totalServices = Object.keys(serv).length || 8;

                    return (
                      <tr key={org.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{org.name}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>ID: {org.slug}</span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>{org.owner?.name || "Faculty Admin"}</div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{org.owner?.email || "N/A"}</span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: org.plan_id === "institution" ? "#eff6ff" : (org.plan_id === "creator_pro" ? "#f5f3ff" : "#f1f5f9"),
                            color: org.plan_id === "institution" ? "#2563eb" : (org.plan_id === "creator_pro" ? "#7c3aed" : "#475569")
                          }}>
                            {(org.plan_id || "free").toUpperCase()}
                          </span>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                            {org.proctoring_quota || 0} proctor · {org.ai_generation_credits || 0} AI
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <button
                            type="button"
                            onClick={() => openServicesModal(org)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: activeCount === totalServices ? "#ecfdf5" : "#fffbeb",
                              color: activeCount === totalServices ? "#059669" : "#d97706",
                              border: activeCount === totalServices ? "1px solid #a7f3d0" : "1px solid #fde68a",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            <span> {activeCount}/{totalServices} Active</span>
                            <span style={{ fontSize: "10px", textDecoration: "underline" }}>Configure</span>
                          </button>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "13px" }}>
                          <div><strong>{org.exam_count}</strong> exams</div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{org.attempt_count} attempts</span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: org.status === "active" ? "#ecfdf5" : "#fef2f2",
                            color: org.status === "active" ? "#059669" : "#dc2626",
                            border: org.status === "active" ? "1px solid #a7f3d0" : "1px solid #fecaca"
                          }}>
                            {(org.status || "active").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => openMembersModal(org)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", cursor: "pointer" }}
                              title="View & manage institution members"
                            >
                              Members
                            </button>
                            <button
                              type="button"
                              onClick={() => openServicesModal(org)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", cursor: "pointer" }}
                            >
                              Services
                            </button>
                            <button
                              type="button"
                              onClick={() => openSubModal(org)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", cursor: "pointer" }}
                            >
                              Quotas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSyncOrgPlanAllotment(org.id, org.name)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", cursor: "pointer" }}
                              title="Re-synchronize quotas and services strictly to active plan entitlements"
                            >
                              Sync Plan
                            </button>
                            {org.plan_id && org.plan_id !== "free" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSubscription(org)}
                                style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", cursor: "pointer" }}
                                title="Revoke subscription and reset to Free tier"
                              >
                                Revoke Sub
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleOrgStatus(org)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: org.status === "active" ? "#fef2f2" : "#ecfdf5", color: org.status === "active" ? "#dc2626" : "#059669", border: "1px solid #cbd5e1", cursor: "pointer" }}
                            >
                              {org.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOrg(org)}
                              style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", cursor: "pointer" }}
                              title="Delete institution and all child data"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrgs.length === 0 && !loading && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}></div>
                        <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>No Organizations Provisioned</strong>
                        <p style={{ fontSize: "13px", marginTop: "4px" }}>
                          Create your first tenant organization to begin hosting proctored exams and CBT assessments.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* VIEW: PUBLIC WEBSITE CMS & SETTINGS                        */}
        {/* ────────────────────────────────────────────────────────── */}
        {activeView === "public_site" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Informational Banner */}
            <div style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px"
            }}>
              <div>
                <div style={{ fontWeight: "700", color: "#1e40af", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <GlobeIcon size={16} color="#1d4ed8" /> SuperAdmin to Public Site Live Synchronization
                </div>
                <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "4px" }}>
                  Changes configured here update the public landing page in real time. Plans and pricing edited in the <strong>Plans & Feature Quotas</strong> tab also reflect immediately on the public pricing table and registration portal.
                </div>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "700",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(37,99,235,0.2)"
                }}
              >
                View Live Site ↗
              </a>
            </div>

            {/* CMS Form Card */}
            <form onSubmit={handleSavePublicSiteSettings} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* 1. Announcement Banner */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                      Announcement Banner
                    </h3>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "3px 0 0 0" }}>
                      Displays a dismissible notification bar pinned to the top of the entire public website.
                    </p>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(publicSiteSettings.announcement_active)}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_active: e.target.checked }))}
                      style={{ width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: publicSiteSettings.announcement_active ? "#16a34a" : "#64748b" }}>
                      {publicSiteSettings.announcement_active ? "Banner Active" : "Banner Hidden"}
                    </span>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Announcement Text
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.announcement_text || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_text: e.target.value }))}
                      placeholder="e.g. Lunaris v2.4 released with AI Question Studio & Specialized CBT Assessment Engine!"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Action Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.announcement_link || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_link: e.target.value }))}
                      placeholder="e.g. /#pricing or https://..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                {/* Banner Live Preview */}
                {publicSiteSettings.announcement_active && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>
                      Live Preview (How visitors will see it)
                    </div>
                    <div style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}>
                      <span>{publicSiteSettings.announcement_text || "Announcement text will appear here"}</span>
                      {publicSiteSettings.announcement_link && (
                        <span style={{ textDecoration: "underline", opacity: 0.9 }}>Learn more →</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Landing Page Copy */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0" }}>
                  Hero Headline & Platform Description
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
                  Controls the primary headline and value proposition displayed in the hero section on the homepage.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Main Headline
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.site_headline || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, site_headline: e.target.value }))}
                      placeholder="All-in-one assessment engine with on-device anti-cheat"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Subtitle & Value Proposition
                    </label>
                    <textarea
                      rows={3}
                      value={publicSiteSettings.site_subtitle || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, site_subtitle: e.target.value }))}
                      placeholder="Conduct secure computer-based assessments, buzzer quick quizzes, and auto-graded evaluations with real-time video invigilation."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        lineHeight: "1.5",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Support & Contact Details */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0" }}>
                  Public Support & System Status
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
                  Contact coordinates and operational status displayed in the public footer and support links.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={publicSiteSettings.contact_email || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="support@lunaris.com"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Support Hotline / Phone
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.support_phone || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, support_phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Platform Status Label
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.platform_status || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, platform_status: e.target.value }))}
                      placeholder="Operational"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Plans & Pricing Sync Summary */}
              <div style={{
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px"
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CreditCardIcon size={16} color="#2563eb" /> Dynamic Plans & Pricing ({plans.length} active plans configured)
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    Plans edited in the SuperAdmin portal automatically propagate to public pricing cards, feature comparisons, and registration selectors without code rebuilds.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView("plans")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#334155",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Edit Plans & Pricing →
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button
                  type="submit"
                  disabled={savingPublicSite}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "8px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: savingPublicSite ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.25)"
                  }}
                >
                  {savingPublicSite ? "Publishing Changes..." : "Save & Publish to Public Site"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 2: EXECUTIVE ANALYTICS                                         */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "analytics" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>Platform Executive Analytics</h2>
              <p style={{ fontSize: "13px", color: "#64748b" }}>
                Real-time telemetry across multi-tenant compute, proctoring AI, and financial recurring revenue.
              </p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "28px" }}>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Monthly Run Rate (MRR)</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#2563eb", marginTop: "6px" }}>
                  ₹{(analytics?.financials?.mrr_inr ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", marginTop: "4px" }}>
                  ↑ Estimated ARR: ₹{(analytics?.financials?.arr_inr ?? 0).toLocaleString()}
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Active Customer Orgs</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#059669", marginTop: "6px" }}>
                  {analytics?.organizations?.active ?? 0}
                  <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: "500" }}>/{analytics?.organizations?.total ?? 0}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  Suspended: {analytics?.organizations?.suspended ?? 0}
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Candidate Exam Attempts</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#7c3aed", marginTop: "6px" }}>
                  {analytics?.candidates_and_attempts?.total_attempts ?? 0}
                </div>
                <div style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", marginTop: "4px" }}>
                  Completion: {analytics?.candidates_and_attempts?.completion_rate ?? 100}%
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>AI Integrity Telemetry</span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#0f172a", marginTop: "6px" }}>
                  {analytics?.integrity_and_proctoring?.total_violations_logged ?? 0}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  Evidence Snapshots: {analytics?.integrity_and_proctoring?.evidence_snapshots ?? 0}
                </div>
              </div>
            </div>

            {/* Architecture Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "#ffffff", padding: "22px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", marginBottom: "12px" }}>Dual-Engine Platform Architecture</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>Primary Transactional DB</span>
                    <strong style={{ color: "#059669" }}>SQLite WAL (ACID Compliant)</strong>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>Analytics & High-Throughput DB</span>
                    <strong style={{ color: "#2563eb" }}>MongoDB Change Data Capture</strong>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>Core Platform SLA</span>
                    <strong style={{ color: "#7c3aed" }}>{analytics?.system_status?.uptime_percent ?? 99.98}% Target</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "22px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", marginBottom: "12px" }}>Subscription Distribution</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  {Object.entries(analytics?.organizations?.distribution_by_plan || {}).map(([planId, count]) => (
                    <div key={planId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px" }}>
                      <span style={{ textTransform: "uppercase", fontWeight: "700" }}>{planId}</span>
                      <strong>{count} Organizations</strong>
                    </div>
                  ))}
                  {Object.keys(analytics?.organizations?.distribution_by_plan || {}).length === 0 && (
                    <p style={{ color: "#64748b", margin: 0 }}>No active plans distributed yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 3: EXAM STATISTICS & CBT ASSESSMENTS                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "exam_stats" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>CBT Examination Statistics & Telemetry</h2>
              <p style={{ fontSize: "13px", color: "#64748b" }}>
                Deep breakdown of Computer-Based Assessments, Quick Quiz arenas, and question banks authored across institutions.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>PROCTORED CBT ASSESSMENTS</span>
                <div style={{ fontSize: "30px", fontWeight: "900", color: "#2563eb", marginTop: "4px" }}>
                  {analytics?.exams_and_questions?.nta_cbt_exams ?? 0}
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>QUICK QUIZ ARENAS</span>
                <div style={{ fontSize: "30px", fontWeight: "900", color: "#d97706", marginTop: "4px" }}>
                  {analytics?.exams_and_questions?.quick_quiz_arenas ?? 0}
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>STANDARD PRACTICE</span>
                <div style={{ fontSize: "30px", fontWeight: "900", color: "#059669", marginTop: "4px" }}>
                  {analytics?.exams_and_questions?.standard_practice ?? 0}
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>QUESTIONS AUTHORED</span>
                <div style={{ fontSize: "30px", fontWeight: "900", color: "#7c3aed", marginTop: "4px" }}>
                  {analytics?.exams_and_questions?.total_questions_authored ?? 0}
                </div>
              </div>
            </div>

            {/* Organizations Exam Breakdown Card */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "14px" }}>Institution Examination Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {orgs.map(org => (
                  <div key={org.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", borderRadius: "6px" }}>
                    <div>
                      <strong style={{ fontSize: "14px" }}>{org.name}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>({org.slug})</span>
                    </div>
                    <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
                      <span><strong>{org.exam_count}</strong> Published Exams</span>
                      <span><strong>{org.attempt_count}</strong> Candidate Attempts</span>
                    </div>
                  </div>
                ))}
                {orgs.length === 0 && (
                  <p style={{ color: "#64748b", margin: "20px 0", textAlign: "center" }}>No customer organizations registered yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 4: PLANS & QUOTAS                                              */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "plans" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>Plans & Feature Entitlement Quotas</h2>
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  Modify subscription pricing (INR), candidates/exam limits, AI credits, and proctoring allowances.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(true)}
                style={{
                  padding: "8px 16px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                ＋ Create Custom Plan
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
              {plans.map(p => (
                <div key={p.id} style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "24px", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "800", margin: 0 }}>{p.name}</h3>
                    <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontWeight: "700", color: "#475569" }}>
                      ID: {p.id}
                    </span>
                  </div>

                  <div style={{ fontSize: "26px", fontWeight: "900", color: "#2563eb", marginBottom: "12px" }}>
                    ₹{p.price_inr} <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>/{p.billing_period}</span>
                  </div>

                  <p style={{ fontSize: "13px", color: "#475569", marginBottom: "18px", minHeight: "36px" }}>
                    {p.description}
                  </p>

                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                    <div>Max Candidates / Exam: <strong>{p.entitlements?.max_candidates ?? "N/A"}</strong></div>
                    <div>Max Published Exams: <strong>{p.entitlements?.max_exams ?? "N/A"}</strong></div>
                    <div>AI Question Credits: <strong>{p.entitlements?.ai_questions ?? "N/A"}</strong></div>
                    <div>Proctoring Module: <strong>{p.entitlements?.proctoring_enabled === "true" ? "Allowed" : "Disabled"}</strong></div>
                    <div>PDF Direct Import: <strong>{p.entitlements?.pdf_import === "true" ? "Allowed" : "Restricted"}</strong></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePlanProctoring(p.id)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: p.entitlements?.proctoring_enabled === "true" ? "#ecfdf5" : "#fef2f2",
                      color: p.entitlements?.proctoring_enabled === "true" ? "#047857" : "#b91c1c",
                      border: `1px solid ${p.entitlements?.proctoring_enabled === "true" ? "#a7f3d0" : "#fecaca"}`,
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    {p.entitlements?.proctoring_enabled === "true"
                      ? "Proctoring: Active (Click to Deactivate)"
                      : "Proctoring: Disabled (Click to Activate)"}
                  </button>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => openEditPlan(p)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Edit Plan & Quotas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      style={{
                        padding: "8px 12px",
                        background: "#ffffff",
                        color: "#ef4444",
                        border: "1px solid #fecaca",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 5: PAYMENT GATEWAYS & GST SETTINGS                             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "payments" && (
          <div style={{ padding: "28px 32px", maxWidth: "1080px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>UPI Gateway, Transactions & Billing Control</h2>
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  Manage the direct NPCI UPI payment gateway (upi://pay), verify submitted 12-digit UTR references, and configure global GST invoicing.
                </p>
              </div>

              {/* Subtab Toggle Buttons */}
              <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", gap: "4px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => { setPaymentSubTab("customers"); loadActualCustomers(); }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                    background: paymentSubTab === "customers" ? "#ffffff" : "transparent",
                    color: paymentSubTab === "customers" ? "#0f172a" : "#64748b",
                    boxShadow: paymentSubTab === "customers" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span> Actual Paying Customers</span>
                  {actualCustomers.length > 0 && (
                    <span style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "900"
                    }}>
                      {actualCustomers.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSubTab("queue")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                    background: paymentSubTab === "queue" ? "#ffffff" : "transparent",
                    color: paymentSubTab === "queue" ? "#0f172a" : "#64748b",
                    boxShadow: paymentSubTab === "queue" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span> UPI Verification Queue</span>
                  {paymentsList.filter(p => p.status === "pending" || (!p.verified && p.status !== "rejected")).length > 0 && (
                    <span style={{
                      background: "#f59e0b",
                      color: "#000",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "900"
                    }}>
                      {paymentsList.filter(p => p.status === "pending" || (!p.verified && p.status !== "rejected")).length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSubTab("settings")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                    background: paymentSubTab === "settings" ? "#ffffff" : "transparent",
                    color: paymentSubTab === "settings" ? "#0f172a" : "#64748b",
                    boxShadow: paymentSubTab === "settings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                  }}
                >
                  Gateway & UPI Settings
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.sweepRenewals();
                      alert(`Monthly Renewal Sweep Complete:\n• ${res.checked_subscriptions} subscriptions checked\n• ${res.reminders_sent} reminder emails dispatched\n• ${res.downgraded_to_free} expired accounts downgraded to free.`);
                    } catch (e) {
                      alert("Sweep failed: " + e.message);
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  title="Scans all active subscriptions, dispatches reminder emails to orgs renewing in 7/3/1 days, and applies grace period rules."
                >
                  Sweep & Dispatch Renewal Reminders
                </button>
              </div>
            </div>

            {/* ── SUBTAB 0: ACTUAL PAYING CUSTOMERS (VERIFIED DONE PAYMENTS) ── */}
            {paymentSubTab === "customers" && (
              <div>
                {/* Metrics Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Verified Revenue</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>
                      ₹{actualCustomers.reduce((acc, c) => acc + (c.total_amount_paid_inr || 0), 0).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>From authentic approved UPI payments</div>
                  </div>

                  <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Paying Institutions</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", marginTop: "4px" }}>
                      {actualCustomers.length}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Active verified customer tenants</div>
                  </div>

                  <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Done Payments Count</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#7c3aed", marginTop: "4px" }}>
                      {actualCustomers.reduce((acc, c) => acc + (c.approved_payments_count || 0), 0)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Total verified transactions completed</div>
                  </div>
                </div>

                {/* Table of Actual Customers */}
                <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                        Authentic Customer Institutions
                      </h3>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                        Only institutions with verified, approved UPI transactions appear here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadActualCustomers}
                      disabled={loadingCustomers}
                      style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "700", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", cursor: "pointer" }}
                    >
                      {loadingCustomers ? "Refreshing..." : "↻ Refresh Customers"}
                    </button>
                  </div>

                  {actualCustomers.length === 0 ? (
                    <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}></div>
                      <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>No Approved Paying Customers Yet</strong>
                      <p style={{ fontSize: "12px", marginTop: "4px" }}>
                        When tenant organizations pay via UPI and you approve their 12-digit UTR in the Verification Queue, they will appear here as genuine paying customers.
                      </p>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>INSTITUTION</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>CURRENT PLAN</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>TOTAL VERIFIED PAID</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>DONE PAYMENTS</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>LAST PAYMENT DATE</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>VERIFIED UTR REFERENCES</th>
                            <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", textAlign: "right" }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actualCustomers.map(cust => (
                            <tr key={cust.organization_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "14px 18px" }}>
                                <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{cust.name}</strong>
                                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>ID: {cust.slug}</span>
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  background: cust.plan_id === "institution" ? "#eff6ff" : (cust.plan_id === "creator_pro" ? "#f5f3ff" : "#f1f5f9"),
                                  color: cust.plan_id === "institution" ? "#2563eb" : (cust.plan_id === "creator_pro" ? "#7c3aed" : "#475569")
                                }}>
                                  {(cust.plan_id || "free").toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <strong style={{ fontSize: "15px", color: "#16a34a" }}>
                                  ₹{cust.total_amount_paid_inr?.toLocaleString("en-IN")}
                                </strong>
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{ padding: "3px 8px", background: "#f0fdf4", color: "#166534", borderRadius: "10px", fontSize: "11px", fontWeight: "800" }}>
                                  {cust.approved_payments_count} approved
                                </span>
                              </td>
                              <td style={{ padding: "14px 18px", fontSize: "12px", color: "#64748b" }}>
                                {cust.last_payment_date ? new Date(cust.last_payment_date).toLocaleDateString() : "N/A"}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "240px" }}>
                                  {(cust.utr_numbers || []).slice(0, 4).map(utr => (
                                    <span key={utr} style={{ fontFamily: "monospace", fontSize: "10px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", color: "#1e293b" }}>
                                      {utr}
                                    </span>
                                  ))}
                                  {(cust.utr_numbers || []).length > 4 && (
                                    <span style={{ fontSize: "10px", color: "#64748b" }}>+{(cust.utr_numbers || []).length - 4} more</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const orgMatch = orgs.find(o => o.id === cust.organization_id);
                                    if (orgMatch) openMembersModal(orgMatch);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", cursor: "pointer" }}
                                >
                                  Members
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SUBTAB 1: UPI VERIFICATION QUEUE ── */}
            {paymentSubTab === "queue" && (
              <div>
                {/* Filter Tabs */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {[
                    { id: "all", label: "All Submissions", count: paymentsList.length },
                    { id: "pending", label: "Pending Verification", count: paymentsList.filter(p => p.status === "pending" || (!p.verified && p.status !== "rejected")).length },
                    { id: "approved", label: "Approved / Active", count: paymentsList.filter(p => p.status === "approved" || p.verified).length },
                    { id: "rejected", label: "Rejected", count: paymentsList.filter(p => p.status === "rejected").length }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPaymentsFilter(f.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "700",
                        border: "1px solid",
                        borderColor: paymentsFilter === f.id ? "#2563eb" : "#e2e8f0",
                        background: paymentsFilter === f.id ? "#eff6ff" : "#ffffff",
                        color: paymentsFilter === f.id ? "#2563eb" : "#64748b",
                        cursor: "pointer"
                      }}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  {paymentsList.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                      No UPI payments recorded yet. Tenant organizations can submit payments via UPI checkout in their billing portal.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                            <th style={{ padding: "12px 16px" }}>Submission Date</th>
                            <th style={{ padding: "12px 16px" }}>Tenant Organization</th>
                            <th style={{ padding: "12px 16px" }}>Plan & Amount</th>
                            <th style={{ padding: "12px 16px" }}>12-Digit UTR Number</th>
                            <th style={{ padding: "12px 16px" }}>Payer VPA / Notes</th>
                            <th style={{ padding: "12px 16px" }}>Status</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsList
                            .filter(p => {
                              if (paymentsFilter === "all") return true;
                              if (paymentsFilter === "pending") return p.status === "pending" || (!p.verified && p.status !== "rejected");
                              if (paymentsFilter === "approved") return p.status === "approved" || p.verified;
                              if (paymentsFilter === "rejected") return p.status === "rejected";
                              return true;
                            })
                            .map(p => {
                              const isApproved = p.status === "approved" || p.verified;
                              const isRejected = p.status === "rejected";
                              const isPending = !isApproved && !isRejected;

                              return (
                                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "12px 16px", color: "#64748b", whiteSpace: "nowrap" }}>
                                    {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : "Recently"}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <div style={{ fontWeight: "700", color: "#0f172a" }}>{p.organization_name}</div>
                                    <div style={{ fontSize: "11px", color: "#64748b" }}>ID: {p.organization_id}</div>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <div style={{ fontWeight: "700", color: "#0f172a" }}>{p.plan_name}</div>
                                    <div style={{ fontWeight: "800", color: "#16a34a" }}>₹{p.amount_inr?.toLocaleString("en-IN")}</div>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ fontFamily: "monospace", fontWeight: "800", fontSize: "14px", color: "#1e293b", background: "#f8fafc", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                                        {p.utr_number}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(p.utr_number);
                                          setActionNotice(`Copied UTR: ${p.utr_number}`);
                                        }}
                                        title="Copy UTR"
                                        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px" }}
                                      >
                                        
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 16px", color: "#64748b" }}>
                                    <div>{p.payer_vpa || "Payer VPA not provided"}</div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>{p.submitted_by}</div>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {isApproved && (
                                      <span style={{ padding: "4px 10px", background: "#dcfce7", color: "#166534", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                                        Verified & Active
                                      </span>
                                    )}
                                    {isRejected && (
                                      <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#991b1b", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                                        Rejected
                                      </span>
                                    )}
                                    {isPending && (
                                      <span style={{ padding: "4px 10px", background: "#fef3c7", color: "#92400e", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                                        Pending Review
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                                    {isPending ? (
                                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                        <button
                                          type="button"
                                          disabled={processingPaymentId === p.id}
                                          onClick={() => handleVerifyPayment(p.id, "approve")}
                                          style={{
                                            padding: "6px 12px",
                                            background: "#16a34a",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                            boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)"
                                          }}
                                        >
                                          {processingPaymentId === p.id ? "Processing..." : "Verify & Activate Plan"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={processingPaymentId === p.id}
                                          onClick={() => handleVerifyPayment(p.id, "reject")}
                                          style={{
                                            padding: "6px 10px",
                                            background: "#fee2e2",
                                            color: "#dc2626",
                                            border: "1px solid #fecaca",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: "700",
                                            cursor: "pointer"
                                          }}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                        {isApproved ? `Approved by ${p.verified_by || "SuperAdmin"}` : `Rejected: ${p.rejection_reason || "Invalid reference"}`}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SUBTAB 2: GATEWAY & UPI CONFIGURATION ── */}
            {paymentSubTab === "settings" && (
              <form onSubmit={handleSavePaymentSettings} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* 1. UPI Payment Gateway (NPCI Standard) */}
                <div style={{ background: "#ffffff", padding: "28px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                        Direct NPCI UPI Payment Gateway (Dynamic Deep Link & QR Code)
                      </h3>
                      <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Allows tenant organizations to pay instantly using GPay, PhonePe, Paytm, or BHIM using your platform UPI ID.
                      </p>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                      <input
                        type="checkbox"
                        checked={paymentSettings.upi_enabled !== false}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, upi_enabled: e.target.checked })}
                      />
                      Enable UPI Gateway
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Payee UPI ID / VPA (pa) *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentSettings.upi_id || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, upi_id: e.target.value })}
                        placeholder="demostore@examplebank"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace" }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Your merchant or banking VPA</span>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Payee Display Name (pn) *
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentSettings.upi_payee_name || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, upi_payee_name: e.target.value })}
                        placeholder="Sharma General Store"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Recipient name shown in UPI apps</span>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Merchant Category Code (mc)
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.upi_merchant_code || "5411"}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, upi_merchant_code: e.target.value })}
                        placeholder="5411"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>NPCI MCC code (default: 5411)</span>
                    </div>
                  </div>

                  {/* Live UPI Link & QR Code Preview Card */}
                  {(() => {
                    const samplePa = encodeURIComponent(paymentSettings.upi_id || "demostore@examplebank");
                    const samplePn = encodeURIComponent(paymentSettings.upi_payee_name || "Sharma General Store");
                    const sampleUri = `upi://pay?pa=${samplePa}&pn=${samplePn}&am=499&tn=Order+%231042&cu=INR`;
                    const sampleQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sampleUri)}`;

                    return (
                      <div style={{
                        background: "#f8fafc",
                        padding: "18px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        flexWrap: "wrap"
                      }}>
                        <div style={{ background: "#ffffff", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                          <img src={sampleQr} alt="Live QR Preview" style={{ width: "110px", height: "110px", display: "block" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: "260px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Live Generated NPCI Deep Link Preview
                          </div>
                          <div style={{
                            fontSize: "12px",
                            fontFamily: "monospace",
                            background: "#0f172a",
                            color: "#38bdf8",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            margin: "6px 0",
                            wordBreak: "break-all"
                          }}>
                            {sampleUri}
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(sampleUri);
                                setActionNotice("UPI URL copied to clipboard!");
                              }}
                              style={{
                                padding: "4px 10px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer"
                              }}
                            >
                              Copy UPI Link
                            </button>
                            <a
                              href={sampleUri}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: "4px 10px",
                                background: "#2563eb",
                                color: "#ffffff",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "700",
                                textDecoration: "none"
                              }}
                            >
                              Test Open Link
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Razorpay & Stripe Processors */}
                <div style={{ background: "#ffffff", padding: "28px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    2. Secondary Payment Processors (Razorpay & Stripe)
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Active Payment Gateway
                      </label>
                      <select
                        value={paymentSettings.gateway}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, gateway: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="upi">Direct UPI (NPCI Instant Gateway - Recommended)</option>
                        <option value="razorpay">Razorpay (India UPI / Cards / NetBanking)</option>
                        <option value="stripe">Stripe Global (Credit Cards / International)</option>
                        <option value="manual_invoice">Direct Bank Settlement / Offline Invoice</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Environment Mode
                      </label>
                      <select
                        value={paymentSettings.live_mode ? "live" : "test"}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, live_mode: e.target.value === "live" })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="live">Live Production Keys</option>
                        <option value="test">Sandbox / Testing Mode</option>
                      </select>
                    </div>
                  </div>

                  {/* Razorpay Keys */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Razorpay Key ID
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.razorpay_key_id || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpay_key_id: e.target.value })}
                        placeholder="rzp_live_xxxxxxxxxxxx"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Razorpay Key Secret
                      </label>
                      <input
                        type="password"
                        value={paymentSettings.razorpay_key_secret || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpay_key_secret: e.target.value })}
                        placeholder="••••••••••••••••"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>

                  {/* Stripe Keys */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Stripe Publishable Key
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.stripe_publishable_key || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, stripe_publishable_key: e.target.value })}
                        placeholder="pk_live_xxxxxxxxxxxx"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Stripe Secret Key
                      </label>
                      <input
                        type="password"
                        value={paymentSettings.stripe_secret_key || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, stripe_secret_key: e.target.value })}
                        placeholder="sk_live_xxxxxxxxxxxx"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Invoicing, Currency & GST Compliance */}
                <div style={{ background: "#ffffff", padding: "28px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    3. Invoicing, Currency & GST Compliance
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Default Currency
                      </label>
                      <select
                        value={paymentSettings.currency}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, currency: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      >
                        <option value="INR">INR (₹ Indian Rupee)</option>
                        <option value="USD">USD ($ US Dollar)</option>
                        <option value="EUR">EUR (€ Euro)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Tax / GST Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={paymentSettings.tax_percentage}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, tax_percentage: parseInt(e.target.value) || 0 })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        HSN / SAC Code
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.hsn_sac_code || "998431"}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, hsn_sac_code: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Invoice Sequential Prefix
                      </label>
                      <input
                        type="text"
                        value={paymentSettings.invoice_prefix || "LUN-INV-2026-"}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, invoice_prefix: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                        Billing Support Email
                      </label>
                      <input
                        type="email"
                        value={paymentSettings.billing_contact_email || ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, billing_contact_email: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                      Legal Corporate Entity Name (Printed on Invoices)
                    </label>
                    <input
                      type="text"
                      value={paymentSettings.billing_legal_name || ""}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, billing_legal_name: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPayments}
                    style={{
                      padding: "12px 28px",
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "700",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
                    }}
                  >
                    {savingPayments ? "Saving Configuration..." : "Save Payment & Billing Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 6: SYSTEM AUDIT TRAIL WITH PAGINATION                          */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "audit_logs" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>System &amp; Administrative Audit Logs</h2>
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  Auditable chronological trail for every service configuration, plan modification, role delegation, and superadmin command.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    const f = e.target.value;
                    setAuditActionFilter(f);
                    setAuditPage(1);
                    loadAuditLogs(1, auditPageSize, auditSearch, f);
                  }}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="all">All Operations</option>
                  <option value="SUPERADMIN_">Superadmin Commands</option>
                  <option value="SUBSCRIPTION_">Subscriptions</option>
                  <option value="ORG_">Organizations</option>
                  <option value="PAYMENT_">UPI Payments</option>
                  <option value="AUTH_">Authentication</option>
                </select>

                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    placeholder="Search actions or details..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setAuditPage(1);
                        loadAuditLogs(1, auditPageSize, auditSearch, auditActionFilter);
                      }
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", width: "220px" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAuditPage(1);
                      loadAuditLogs(1, auditPageSize, auditSearch, auditActionFilter);
                    }}
                    style={{ padding: "8px 12px", background: "#2563eb", color: "#ffffff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Filter
                  </button>
                </div>

                <select
                  value={auditPageSize}
                  onChange={(e) => {
                    const s = parseInt(e.target.value);
                    setAuditPageSize(s);
                    setAuditPage(1);
                    loadAuditLogs(1, s, auditSearch, auditActionFilter);
                  }}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="10">10 / page</option>
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                </select>

                {isMainSuperAdmin && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleClearAuditLogs}
                      style={{ padding: "8px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                      title="Permanently clear all audit events from SQLite and MongoDB database"
                    >
                      Clear Logs
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDatabase}
                      style={{ padding: "8px 14px", background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                      title="Purge all test organizations, attempts, and records from DB"
                    >
                      Wipe DB Data
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Logs Table */}
            <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569" }}>TIMESTAMP</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569" }}>ACTION TRIGGERED</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569" }}>ACTOR</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", color: "#475569" }}>AUDIT METADATA</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAudit ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                        Loading audit trail records...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                        No audit events matching criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 18px", fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "Recently"}
                        </td>
                        <td style={{ padding: "12px 18px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: log.action?.includes("DELETE") || log.action?.includes("REVOKE") ? "#fef2f2" : "#eff6ff",
                            color: log.action?.includes("DELETE") || log.action?.includes("REVOKE") ? "#dc2626" : "#1d4ed8",
                            border: log.action?.includes("DELETE") || log.action?.includes("REVOKE") ? "1px solid #fecaca" : "1px solid #bfdbfe"
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px", fontSize: "12px", color: "#334155" }}>
                          <strong>{log.actor_email || log.actor_id || "SuperAdmin"}</strong>
                        </td>
                        <td style={{ padding: "12px 18px", fontSize: "12px" }}>
                          <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "11px", background: "#f8fafc", padding: "6px 10px", borderRadius: "4px", whiteSpace: "pre-wrap", maxWidth: "450px", overflowX: "auto" }}>
                            {JSON.stringify(log.metadata, null, 1)}
                          </pre>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination Controls Bar */}
              <div style={{
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                fontSize: "12px",
                color: "#64748b",
                flexWrap: "wrap",
                gap: "10px"
              }}>
                <div>
                  Showing <strong>{auditTotal > 0 ? ((auditPage - 1) * auditPageSize) + 1 : 0}</strong> to{" "}
                  <strong>{Math.min(auditPage * auditPageSize, auditTotal)}</strong> of{" "}
                  <strong>{auditTotal}</strong> audit records
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    disabled={auditPage <= 1 || loadingAudit}
                    onClick={() => {
                      const p = 1;
                      setAuditPage(p);
                      loadAuditLogs(p, auditPageSize, auditSearch, auditActionFilter);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: auditPage <= 1 ? "#f1f5f9" : "#ffffff",
                      color: auditPage <= 1 ? "#94a3b8" : "#0f172a",
                      cursor: auditPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}
                  >
                    « First
                  </button>

                  <button
                    type="button"
                    disabled={auditPage <= 1 || loadingAudit}
                    onClick={() => {
                      const p = Math.max(1, auditPage - 1);
                      setAuditPage(p);
                      loadAuditLogs(p, auditPageSize, auditSearch, auditActionFilter);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: auditPage <= 1 ? "#f1f5f9" : "#ffffff",
                      color: auditPage <= 1 ? "#94a3b8" : "#0f172a",
                      cursor: auditPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}
                  >
                    ‹ Prev
                  </button>

                  <span style={{ padding: "4px 10px", fontSize: "11px", fontWeight: "800", color: "#0f172a", background: "#ffffff", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                    Page {auditPage} of {auditTotalPages}
                  </span>

                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages || loadingAudit}
                    onClick={() => {
                      const p = Math.min(auditTotalPages, auditPage + 1);
                      setAuditPage(p);
                      loadAuditLogs(p, auditPageSize, auditSearch, auditActionFilter);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: auditPage >= auditTotalPages ? "#f1f5f9" : "#ffffff",
                      color: auditPage >= auditTotalPages ? "#94a3b8" : "#0f172a",
                      cursor: auditPage >= auditTotalPages ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}
                  >
                    Next ›
                  </button>

                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages || loadingAudit}
                    onClick={() => {
                      const p = auditTotalPages;
                      setAuditPage(p);
                      loadAuditLogs(p, auditPageSize, auditSearch, auditActionFilter);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: auditPage >= auditTotalPages ? "#f1f5f9" : "#ffffff",
                      color: auditPage >= auditTotalPages ? "#94a3b8" : "#0f172a",
                      cursor: auditPage >= auditTotalPages ? "not-allowed" : "pointer",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}
                  >
                    Last »
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* VIEW 7: ADMIN TEAM & ROLE-BASED ACCESS CONTROL (RBAC)               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeView === "admin_team" && (
          <div style={{ padding: "28px 32px", maxWidth: "1140px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>Administrative Team &amp; RBAC Control</h2>
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  Manage platform administration staff and permission tiers. The platform enforces strictly <strong>ONE Main Super Administrator</strong> (sole owner).
                </p>
              </div>

              {isMainSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(true)}
                  style={{
                    padding: "8px 16px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>＋</span> Provision Administrative Staff
                </button>
              )}
            </div>

            {/* Role Explanations Banner */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span></span> Main SuperAdmin
                </div>
                <div style={{ fontSize: "11px", color: "#78350f", marginTop: "4px", lineHeight: "1.4" }}>
                  <strong>Sole Owner (Only 1 Account)</strong>. Holds ultimate authority over admin staff, RBAC delegation, and institution deletion.
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #bfdbfe", borderLeft: "4px solid #2563eb" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span></span> Platform Admin
                </div>
                <div style={{ fontSize: "11px", color: "#1e3a8a", marginTop: "4px", lineHeight: "1.4" }}>
                  <strong>Operational Control</strong>. Can provision institutions, adjust feature services, modify quotas, and verify UPI payments.
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #a7f3d0", borderLeft: "4px solid #10b981" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#065f46", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span></span> Platform Auditor
                </div>
                <div style={{ fontSize: "11px", color: "#064e3b", marginTop: "4px", lineHeight: "1.4" }}>
                  <strong>Compliance &amp; Inspection</strong>. Read-only oversight for Executive Analytics, CBT Telemetry, and the System Audit Trail.
                </div>
              </div>

              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #c7d2fe", borderLeft: "4px solid #6366f1" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#3730a3", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span></span> Platform Support
                </div>
                <div style={{ fontSize: "11px", color: "#312e81", marginTop: "4px", lineHeight: "1.4" }}>
                  <strong>Faculty &amp; Exam Help</strong>. Inspects institution member rosters, examines candidate session anomalies, and resolves PIN issues.
                </div>
              </div>
            </div>

            {/* Admin Staff Table */}
            <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                    Active Administration Personnel ({adminTeam.length})
                  </h3>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                    All accounts authorized to log into the platform administration dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAdminTeam}
                  disabled={loadingAdminTeam}
                  style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "700", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", cursor: "pointer" }}
                >
                  {loadingAdminTeam ? "Refreshing..." : "↻ Refresh Staff"}
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>STAFF MEMBER</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>ASSIGNED RBAC ROLE</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>GOVERNANCE TIER</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>STATUS</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700" }}>PROVISIONED ON</th>
                    <th style={{ padding: "12px 18px", fontSize: "11px", fontWeight: "700", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTeam.map(admin => {
                    const isOwner = admin.is_main_superadmin || admin.admin_role === "superadmin";
                    return (
                      <tr key={admin.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{admin.full_name || "Platform Staff"}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{admin.email}</span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "800",
                            background: isOwner ? "#fef3c7" : (admin.admin_role === "platform_auditor" ? "#ecfdf5" : (admin.admin_role === "platform_support" ? "#eef2ff" : "#eff6ff")),
                            color: isOwner ? "#92400e" : (admin.admin_role === "platform_auditor" ? "#065f46" : (admin.admin_role === "platform_support" ? "#3730a3" : "#1d4ed8")),
                            border: isOwner ? "1px solid #fde68a" : "1px solid #cbd5e1"
                          }}>
                            {isOwner ? "Primary Super Admin" : (admin.admin_role ? admin.admin_role.replace("_", " ").toUpperCase() : "PLATFORM ADMIN")}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: isOwner ? "#b45309" : "#475569" }}>
                            {isOwner ? "Sole Platform Owner" : "Delegated Staff"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: admin.status === "active" ? "#ecfdf5" : "#fef2f2",
                            color: admin.status === "active" ? "#059669" : "#dc2626"
                          }}>
                            {admin.status || "active"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "12px", color: "#64748b" }}>
                          {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "System Init"}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          {isOwner ? (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                              Protected Owner
                            </span>
                          ) : isMainSuperAdmin ? (
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAdminUser(admin);
                                  setAdminRoleForm({ admin_role: admin.admin_role || "platform_admin", status: admin.status || "active" });
                                }}
                                style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", cursor: "pointer" }}
                              >
                                Edit Role
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeAdmin(admin)}
                                style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", cursor: "pointer" }}
                              >
                                Revoke Access
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Managed by Owner</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SERVICES & PROPERTY SYSTEMS DRAWER                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedServicesOrg && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "14px",
            width: "100%",
            maxWidth: "780px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#ffffff",
              color: "#0f172a"
            }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "800", margin: 0, color: "#0f172a" }}>
                  Manage Services &amp; Property Systems
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Tenant: <strong style={{ color: "#0f172a" }}>{selectedServicesOrg.name}</strong> ({selectedServicesOrg.slug})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServicesOrg(null)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: "20px", cursor: "pointer" }}
              ><XIcon size={18} /></button>
            </div>

            <div style={{ padding: "24px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: "800", color: "#475569", textTransform: "uppercase", marginBottom: "12px", letterSpacing: "0.5px" }}>
                1. Modular Services (Allow / Revoke)
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                {SERVICE_DEFINITIONS.map(s => {
                  const isEnabled = Boolean(servicesState[s.key]);
                  return (
                    <div
                      key={s.key}
                      onClick={() => setServicesState(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: isEnabled ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                        background: isEnabled ? "#f8fafc" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#2563eb" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: isEnabled ? "#0f172a" : "#64748b" }}>
                            {s.icon && <s.icon size={14} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />}{s.title}
                          </span>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: isEnabled ? "#dbeafe" : "#f1f5f9",
                            color: isEnabled ? "#1d4ed8" : "#94a3b8"
                          }}>
                            {isEnabled ? "ALLOWED" : "REMOVED"}
                          </span>
                        </div>
                        <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.4" }}>
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h4 style={{ fontSize: "13px", fontWeight: "800", color: "#475569", textTransform: "uppercase", marginBottom: "12px", letterSpacing: "0.5px" }}>
                2. Property Systems & Security Policies
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(propertiesState.allow_self_registration)}
                      onChange={(e) => setPropertiesState(prev => ({ ...prev, allow_self_registration: e.target.checked }))}
                      style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                    />
                    Candidate Self-Registration
                  </label>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 26px" }}>
                    Enables open enrollment using organization invite codes.
                  </p>
                </div>

                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(propertiesState.require_webcam_preflight)}
                      onChange={(e) => setPropertiesState(prev => ({ ...prev, require_webcam_preflight: e.target.checked }))}
                      style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                    />
                    Enforce Hardware Preflight Check
                  </label>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 26px" }}>
                    Requires camera, mic, and connection checks before attempt start.
                  </p>
                </div>

                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(propertiesState.strict_lockdown)}
                      onChange={(e) => setPropertiesState(prev => ({ ...prev, strict_lockdown: e.target.checked }))}
                      style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
                    />
                    Strict Fullscreen Lockdown
                  </label>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 26px" }}>
                    Enforces fullscreen integrity and flags alt-tab switches.
                  </p>
                </div>

                <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>
                    Candidate Watermark Text
                  </label>
                  <input
                    type="text"
                    value={propertiesState.watermark_text || ""}
                    onChange={(e) => setPropertiesState(prev => ({ ...prev, watermark_text: e.target.value }))}
                    placeholder="e.g. LUNARIS CONFIDENTIAL"
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#f8fafc" }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedServicesOrg(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSaveServices} disabled={savingServices}>
                {savingServices ? "Updating..." : "Save Service & Property Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT PLAN & QUOTAS                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingPlan && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", width: "100%", maxWidth: "560px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>
                Edit Plan &amp; Entitlement Quotas: {editingPlan.name}
              </h3>
              <button type="button" onClick={() => setEditingPlan(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleSavePlan} style={{ padding: "22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Plan Name</label>
                  <input
                    type="text"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Price in INR (₹)</label>
                  <input
                    type="number"
                    value={planFormData.price_inr}
                    onChange={(e) => setPlanFormData({ ...planFormData, price_inr: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Description</label>
                <input
                  type="text"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <h4 style={{ fontSize: "13px", fontWeight: "800", margin: "16px 0 10px 0", color: "#475569" }}>Quotas &amp; Allowances</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>Max Candidates</label>
                  <input
                    type="text"
                    value={planFormData.entitlements.max_candidates}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, max_candidates: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>Max Exams</label>
                  <input
                    type="text"
                    value={planFormData.entitlements.max_exams}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, max_exams: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>AI Credits</label>
                  <input
                    type="text"
                    value={planFormData.entitlements.ai_questions}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, ai_questions: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>Proctoring Module</label>
                  <select
                    value={planFormData.entitlements.proctoring_enabled}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, proctoring_enabled: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  >
                    <option value="true">Allowed (Active)</option>
                    <option value="false">Disabled (Unavailable)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>Proctoring Attempts Quota</label>
                  <input
                    type="number"
                    value={planFormData.entitlements.proctoring_quota || "50"}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, proctoring_quota: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>PDF Direct Import</label>
                  <select
                    value={planFormData.entitlements.pdf_import}
                    onChange={(e) => setPlanFormData({
                      ...planFormData,
                      entitlements: { ...planFormData.entitlements, pdf_import: e.target.value }
                    })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  >
                    <option value="true">Allowed</option>
                    <option value="false">Restricted</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingPlan(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Update Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE CUSTOM PLAN                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreatePlanModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", width: "100%", maxWidth: "560px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>Provision New Subscription Tier</h3>
              <button type="button" onClick={() => setShowCreatePlanModal(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} style={{ padding: "22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Plan Code (ID) *</label>
                  <input
                    type="text"
                    required
                    value={newPlanForm.id}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, id: e.target.value })}
                    placeholder="e.g. enterprise_plus"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Plan Display Name *</label>
                  <input
                    type="text"
                    required
                    value={newPlanForm.name}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, name: e.target.value })}
                    placeholder="e.g. Enterprise Plus"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Price in INR (₹)</label>
                  <input
                    type="number"
                    value={newPlanForm.price_inr}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, price_inr: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Billing Period</label>
                  <select
                    value={newPlanForm.billing_period}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, billing_period: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Description</label>
                <input
                  type="text"
                  value={newPlanForm.description}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, description: e.target.value })}
                  placeholder="e.g. Dedicated proctoring capacity with unlimited AI synthesis"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreatePlanModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: PROVISION NEW ORGANIZATION                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreateOrgModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "580px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", color: "#0f172a" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#0f172a" }}>Provision Tenant Organization</h3>
              <button type="button" onClick={() => setShowCreateOrgModal(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleCreateOrgSubmit} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Organization Name *</label>
                <input
                  type="text"
                  required
                  value={newOrgForm.name}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                  placeholder="e.g. Apex Global Academy"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Owner Email *</label>
                  <input
                    type="email"
                    required
                    value={newOrgForm.owner_email}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, owner_email: e.target.value })}
                    placeholder="dean@apex.edu"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Owner Full Name</label>
                  <input
                    type="text"
                    value={newOrgForm.owner_name}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, owner_name: e.target.value })}
                    placeholder="Prof. R. Sharma"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Initial Plan</label>
                <select
                  value={newOrgForm.plan_id}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, plan_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                >
                  <option value="free">Free Starter Plan</option>
                  <option value="creator_pro">Creator Pro Plan</option>
                  <option value="institution">Institution Plan</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Initial Proctoring Quota</label>
                  <input
                    type="number"
                    value={newOrgForm.proctoring_attempts_quota}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, proctoring_attempts_quota: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Initial AI Question Credits</label>
                  <input
                    type="number"
                    value={newOrgForm.ai_generation_credits}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, ai_generation_credits: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateOrgModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Provision Tenant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADJUST ORG SUBSCRIPTION & QUOTAS                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedSubOrg && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", width: "100%", maxWidth: "520px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>Adjust Plan &amp; Quotas: {selectedSubOrg.name}</h3>
              <button type="button" onClick={() => setSelectedSubOrg(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleSaveSubscription} style={{ padding: "22px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Subscription Plan</label>
                <select
                  value={subFormData.plan_id}
                  onChange={(e) => setSubFormData({ ...subFormData, plan_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                >
                  <option value="free">Free Starter Plan</option>
                  <option value="creator_pro">Creator Pro Plan</option>
                  <option value="institution">Institution Plan</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Proctoring Attempts Quota</label>
                  <input
                    type="number"
                    value={subFormData.proctoring_quota}
                    onChange={(e) => setSubFormData({ ...subFormData, proctoring_quota: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>AI Synthesis Credits</label>
                  <input
                    type="number"
                    value={subFormData.ai_credits}
                    onChange={(e) => setSubFormData({ ...subFormData, ai_credits: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Extend Billing Validity</label>
                <select
                  value={subFormData.extend_days}
                  onChange={(e) => setSubFormData({ ...subFormData, extend_days: parseInt(e.target.value) })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                >
                  <option value="30">+30 Days (1 Month)</option>
                  <option value="90">+90 Days (Quarterly)</option>
                  <option value="365">+365 Days (1 Year)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {selectedSubOrg.plan_id && selectedSubOrg.plan_id !== "free" ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveSubscription(selectedSubOrg);
                      setSelectedSubOrg(null);
                    }}
                    style={{
                      padding: "8px 14px",
                      background: "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Revoke Subscription
                  </button>
                ) : <div />}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedSubOrg(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Quota Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: MANAGE INSTITUTION MEMBERS & USERS                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedMembersOrg && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "14px",
            width: "100%",
            maxWidth: "760px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#ffffff"
            }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "800", margin: 0, color: "#0f172a" }}>
                  Institution Members & User Accounts
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Institution: <strong style={{ color: "#0f172a" }}>{selectedMembersOrg.name}</strong> ({selectedMembersOrg.slug})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMembersOrg(null)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: "20px", cursor: "pointer" }}
              ><XIcon size={18} /></button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {loadingMembers ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Loading institution members and user profiles...
                </div>
              ) : orgMembersList.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  No members currently registered under this institution.
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                        <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: "700" }}>USER</th>
                        <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: "700" }}>ROLE</th>
                        <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: "700" }}>STATUS</th>
                        <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: "700", textAlign: "right" }}>ADMIN ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgMembersList.map(member => (
                        <tr key={member.user_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{member.name || member.user_id}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{member.email}</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: member.role === "creator" || member.role === "admin" ? "#eff6ff" : "#f1f5f9",
                              color: member.role === "creator" || member.role === "admin" ? "#2563eb" : "#475569"
                            }}>
                              {(member.role || "member").toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: member.status === "active" ? "#ecfdf5" : "#fef2f2",
                              color: member.status === "active" ? "#059669" : "#dc2626"
                            }}>
                              {member.status || "active"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                disabled={actionLoadingUserId === member.user_id}
                                onClick={() => handleRemoveMember(member.user_id, member.name || member.email)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  background: "#fff7ed",
                                  color: "#c2410c",
                                  border: "1px solid #fed7aa",
                                  cursor: "pointer"
                                }}
                                title="Remove member access from this institution"
                              >
                                {actionLoadingUserId === member.user_id ? "..." : "Remove from Org"}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoadingUserId === member.user_id}
                                onClick={() => handleDeleteUser(member.user_id, member.name || member.email)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  background: "#fee2e2",
                                  color: "#dc2626",
                                  border: "1px solid #fca5a5",
                                  cursor: "pointer"
                                }}
                                title="Permanently delete user account from platform"
                              >
                                {actionLoadingUserId === member.user_id ? "..." : "Delete User"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedMembersOrg(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: PROVISION ADMINISTRATIVE STAFF (RBAC)                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreateAdminModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "540px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#0f172a" }}>Provision Administrative Staff</h3>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Assign delegated role-based governance privileges</div>
              </div>
              <button type="button" onClick={() => setShowCreateAdminModal(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleCreateAdminSubmit} style={{ padding: "24px" }}>
              <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", marginBottom: "16px", fontSize: "11px", color: "#92400e", lineHeight: "1.4" }}>
                <strong>RBAC Architecture Policy:</strong> The platform permits strictly <strong>ONE Main Super Administrator</strong> (platform owner). All new administrative personnel are provisioned as delegated staff with specific functional access.
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={newAdminForm.full_name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Email Address (Staff Login) *</label>
                <input
                  type="email"
                  required
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  placeholder="staff@lunaris.com"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={newAdminForm.password}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Assigned Administrative Role *</label>
                <select
                  value={newAdminForm.admin_role}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, admin_role: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="platform_admin">Platform Administrator (Institutions, Plans & Quotas, UPI Payments)</option>
                  <option value="platform_auditor">Platform Auditor (Read-only Analytics, CBT Items & Audit Trail)</option>
                  <option value="platform_support">Platform Support Specialist (Institution Rosters, Member Assistance)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateAdminModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingAdmin}>
                  {savingAdmin ? "Provisioning..." : "Provision Administrative Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT ADMIN ROLE & STATUS                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingAdminUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px"
        }}>
          <div style={{ background: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#0f172a" }}>Edit Staff Role &amp; Permissions</h3>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Staff: <strong>{editingAdminUser.email}</strong></div>
              </div>
              <button type="button" onClick={() => setEditingAdminUser(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: "18px", cursor: "pointer" }}><XIcon size={18} /></button>
            </div>

            <form onSubmit={handleUpdateAdminRole} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>RBAC Role</label>
                <select
                  value={adminRoleForm.admin_role}
                  onChange={(e) => setAdminRoleForm({ ...adminRoleForm, admin_role: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="platform_admin">Platform Administrator</option>
                  <option value="platform_auditor">Platform Auditor</option>
                  <option value="platform_support">Platform Support Specialist</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Account Access Status</label>
                <select
                  value={adminRoleForm.status}
                  onChange={(e) => setAdminRoleForm({ ...adminRoleForm, status: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                >
                  <option value="active">Active (Access Granted)</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingAdminUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Role Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
