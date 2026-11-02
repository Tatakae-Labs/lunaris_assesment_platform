import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import {
  UsersIcon, UserIcon, EditIcon, CheckIcon, XIcon, SearchIcon,
  TrashIcon, RefreshIcon, PlusIcon, CopyIcon, LockIcon, FileTextIcon
} from "../shared/Icons";

export default function CandidateCapacityModal({
  organizationId,
  orgUsage,
  currentUser,
  members = [],
  exams = [],
  onClose,
  onCapacityUpdated
}) {
  const isSuperAdmin = !!currentUser?.is_superadmin;
  const [candPage, setCandPage] = useState(1);
  const candPageSize = 10;
  const [activeTab, setActiveTab] = useState("candidates"); // "candidates", "members", "edit_capacity"
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  
  // Capacity Editing State
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState(orgUsage?.max_candidates || 5000);
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Revoke Candidate Confirmation Popup State
  const [candidateToRevoke, setCandidateToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkRevokeModal, setShowBulkRevokeModal] = useState(false);
  const [bulkRevoking, setBulkRevoking] = useState(false);

  // Manual Candidate Quick-Enroll State
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    candidate_name: "",
    candidate_email: "",
    candidate_uid: "",
    access_pin: "",
    exam_id: exams.length > 0 ? exams[0].id : ""
  });
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    setCandPage(1);
    loadCandidates();
  }, [organizationId, selectedExamId]);

  useEffect(() => {
    setCandPage(1);
  }, [search]);

  async function loadCandidates() {
    setLoading(true);
    try {
      const params = {};
      if (selectedExamId) params.exam_id = selectedExamId;
      if (search.trim()) params.search = search.trim();
      const res = await api.getOrgCandidates(organizationId, params);
      setCandidates(res?.candidates || []);
    } catch (err) {
      console.error("Failed to load candidates:", err);
      toast.error("Could not load candidate roster");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCapacity(newVal) {
    const val = parseInt(newVal !== undefined ? newVal : capacityInput, 10);
    if (!val || val < 1) {
      toast.error("Please enter a valid capacity number");
      return;
    }
    setSavingCapacity(true);
    try {
      const res = await api.updateOrgCapacity(organizationId, val);
      toast.success(`Candidate capacity updated to ${val.toLocaleString()} seats!`);
      setCapacityInput(val);
      setEditingCapacity(false);
      if (onCapacityUpdated) onCapacityUpdated(val);
    } catch (err) {
      toast.error("Failed to update capacity: " + err.message);
    } finally {
      setSavingCapacity(false);
    }
  }

  function handleToggleSelectOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (pagedCandidates.length === 0) return;
    const allSelected = pagedCandidates.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pagedCandidates.forEach((c) => next.delete(c.id));
      } else {
        pagedCandidates.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  async function handleConfirmBulkRevoke() {
    if (selectedIds.size === 0) return;
    setBulkRevoking(true);
    try {
      const res = await api.bulkDeleteOrgCandidates(organizationId, Array.from(selectedIds));
      toast.success(res.message || `Successfully revoked ${selectedIds.size} candidate seat(s)!`);
      setSelectedIds(new Set());
      setShowBulkRevokeModal(false);
      await loadCandidates();
      if (onCapacityUpdated) onCapacityUpdated();
    } catch (err) {
      toast.error("Failed to revoke candidate seats: " + err.message);
    } finally {
      setBulkRevoking(false);
    }
  }

  function handlePromptRevoke(candidate) {
    setCandidateToRevoke(candidate);
  }

  async function handleConfirmRevoke() {
    if (!candidateToRevoke) return;
    setRevoking(true);
    try {
      await api.deleteOrgCandidate(organizationId, candidateToRevoke.id);
      toast.success(`Candidate seat ${candidateToRevoke.candidate_uid} freed up successfully`);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateToRevoke.id));
      setCandidateToRevoke(null);
      if (onCapacityUpdated) onCapacityUpdated();
    } catch (err) {
      toast.error("Failed to revoke candidate seat: " + err.message);
    } finally {
      setRevoking(false);
    }
  }

async function handleQuickEnroll(e) {
    e.preventDefault();
    if (!addForm.candidate_name.trim()) {
      toast.error("Candidate name is required");
      return;
    }
    setEnrolling(true);
    try {
      const res = await api.addOrgCandidate(organizationId, addForm);
      toast.success(res.message || "Candidate enrolled successfully!");
      setShowAddForm(false);
      setAddForm({
        candidate_name: "",
        candidate_email: "",
        candidate_uid: "",
        access_pin: "",
        exam_id: exams.length > 0 ? exams[0].id : ""
      });
      await loadCandidates();
      if (onCapacityUpdated) onCapacityUpdated();
    } catch (err) {
      toast.error("Failed to enroll candidate: " + err.message);
    } finally {
      setEnrolling(false);
    }
  }

  function handleCopyCredentials(c) {
    const text = `Exam Portal: ${window.location.origin}/candidate-login\nUID: ${c.candidate_uid}\nAccess PIN: ${c.access_pin_plain}\nExam: ${c.exam_title}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied login credentials for ${c.candidate_name}`);
  }

  const currentCount = orgUsage?.candidates_count || candidates.length;
  const maxCapacity = orgUsage?.max_candidates || capacityInput || 5000;
  const usagePercent = Math.min(100, Math.round((currentCount / maxCapacity) * 100));

  const filteredCandidates = candidates.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.candidate_name && c.candidate_name.toLowerCase().includes(q)) ||
      (c.candidate_uid && c.candidate_uid.toLowerCase().includes(q)) ||
      (c.candidate_email && c.candidate_email.toLowerCase().includes(q)) ||
      (c.exam_title && c.exam_title.toLowerCase().includes(q))
    );
  });
  const totalCandPages = Math.ceil(filteredCandidates.length / candPageSize) || 1;
  const pagedCandidates = filteredCandidates.slice(
    (candPage - 1) * candPageSize,
    candPage * candPageSize
  );


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        className="dash-card"
        style={{
          width: "100%",
          maxWidth: "960px",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                display: "grid",
                placeItems: "center"
              }}
            >
              <UsersIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                Candidate Capacity & Enrolled Roster
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Manage candidate seats, edit maximum capacity limits, and view all enrolled students.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px"
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Capacity Overview & Instant Editor Bar */}
        <div
          style={{
            background: "#f8fafc",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "16px 24px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                Organization Capacity Status
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "24px", fontWeight: "900", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                  {currentCount.toLocaleString()}
                </span>
                <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                  / {maxCapacity.toLocaleString()} Enrolled Seats ({usagePercent}% Allocated)
                </span>
              </div>
            </div>

            {/* Capacity Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {!isSuperAdmin ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#64748b"
                  }}
                  title="Plan terms and candidate capacity are locked to platform super administrators"
                >
                  <LockIcon size={12} color="#64748b" />
                  <span>Super Admin Managed</span>
                </div>
              ) : !editingCapacity ? (
                <button
                  type="button"
                  onClick={() => setEditingCapacity(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "var(--accent-blue)",
                    cursor: "pointer"
                  }}
                >
                  <EditIcon size={13} />
                  <span>Edit Capacity Limit</span>
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="1"
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(e.target.value)}
                    style={{
                      width: "100px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1.5px solid var(--accent-blue)",
                      fontSize: "13px",
                      fontWeight: "700"
                    }}
                  />
                  <button
                    type="button"
                    disabled={savingCapacity}
                    onClick={() => handleSaveCapacity()}
                    style={{
                      padding: "6px 12px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {savingCapacity ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCapacity(false)}
                    style={{
                      padding: "6px 10px",
                      background: "transparent",
                      color: "#64748b",
                      border: "none",
                      fontSize: "12px",
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                <PlusIcon size={14} />
                <span>Enroll Student</span>
              </button>
            </div>
          </div>

          {/* Progress track */}
          <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", marginTop: "12px", overflow: "hidden" }}>
            <div
              style={{
                width: `${usagePercent}%`,
                height: "100%",
                background: usagePercent >= 90 ? "#ef4444" : "var(--accent-blue)",
                borderRadius: "3px",
                transition: "width 0.3s ease"
              }}
            />
          </div>

          {/* Quick presets when editing */}
          {isSuperAdmin && editingCapacity && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "11px" }}>
              <span style={{ color: "#64748b", fontWeight: "600" }}>Quick Presets:</span>
              {[100, 500, 1000, 5000, 10000, 25000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSaveCapacity(preset)}
                  style={{
                    padding: "2px 8px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#334155",
                    cursor: "pointer"
                  }}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "#ffffff",
            gap: "20px"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("candidates")}
            style={{
              padding: "12px 0",
              fontSize: "13px",
              fontWeight: activeTab === "candidates" ? "800" : "500",
              color: activeTab === "candidates" ? "var(--accent-blue)" : "var(--text-secondary)",
              borderBottom: activeTab === "candidates" ? "2px solid var(--accent-blue)" : "2px solid transparent",
              background: "none",
              cursor: "pointer"
            }}
          >
            Enrolled Students & Candidates ({currentCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("members")}
            style={{
              padding: "12px 0",
              fontSize: "13px",
              fontWeight: activeTab === "members" ? "800" : "500",
              color: activeTab === "members" ? "var(--accent-blue)" : "var(--text-secondary)",
              borderBottom: activeTab === "members" ? "2px solid var(--accent-blue)" : "2px solid transparent",
              background: "none",
              cursor: "pointer"
            }}
          >
            Faculty & Workspace Members ({members.length})
          </button>
        </div>

        {/* Quick Add Form Drawer */}
        {showAddForm && (
          <form
            onSubmit={handleQuickEnroll}
            style={{
              padding: "16px 24px",
              background: "#eff6ff",
              borderBottom: "1px solid #bfdbfe",
              display: "grid",
              gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr auto",
              gap: "10px",
              alignItems: "flex-end"
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px" }}>
                Candidate Full Name *
              </label>
              <input
                type="text"
                required
                value={addForm.candidate_name}
                onChange={(e) => setAddForm({ ...addForm, candidate_name: e.target.value })}
                placeholder="e.g. Alex Rivera"
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "12px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px" }}>
                Email Address
              </label>
              <input
                type="email"
                value={addForm.candidate_email}
                onChange={(e) => setAddForm({ ...addForm, candidate_email: e.target.value })}
                placeholder="student@example.edu"
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "12px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px" }}>
                Candidate UID (Optional)
              </label>
              <input
                type="text"
                value={addForm.candidate_uid}
                onChange={(e) => setAddForm({ ...addForm, candidate_uid: e.target.value })}
                placeholder="Auto-generated"
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "12px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px" }}>
                Assigned Examination
              </label>
              <select
                value={addForm.exam_id}
                onChange={(e) => setAddForm({ ...addForm, exam_id: e.target.value })}
                style={{ width: "100%", padding: "7px 8px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "12px" }}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px" }}>
                Access PIN (Optional)
              </label>
              <input
                type="text"
                value={addForm.access_pin}
                onChange={(e) => setAddForm({ ...addForm, access_pin: e.target.value })}
                placeholder="4-digit PIN"
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "12px" }}
              />
            </div>

            <button
              type="submit"
              disabled={enrolling}
              style={{
                padding: "8px 16px",
                background: "var(--accent-blue)",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: enrolling ? "not-allowed" : "pointer"
              }}
            >
              {enrolling ? "Enrolling..." : "Enroll"}
            </button>
          </form>
        )}

        {/* Search & Filter Toolbar */}
        {activeTab === "candidates" && (
          <div
            style={{
              padding: "12px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "380px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by student name, UID, or email..."
                  style={{
                    width: "100%",
                    padding: "7px 12px 7px 32px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "12px"
                  }}
                />
                <span style={{ position: "absolute", left: "10px", top: "8px", color: "#94a3b8" }}>
                  <SearchIcon size={14} />
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12px",
                  color: "#334155"
                }}
              >
                <option value="">All Examinations</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadCandidates}
                style={{
                  padding: "7px 10px",
                  background: "#ffffff",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#475569"
                }}
                title="Refresh Roster"
              >
                <RefreshIcon size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Candidates Table */}
        {activeTab === "candidates" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Loading enrolled candidate roster...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center" }}>
                <div style={{ color: "#94a3b8", marginBottom: "8px" }}>
                  <UsersIcon size={32} />
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                  No Enrolled Candidates Found
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {search ? "No students match your search filter." : "No candidates have been enrolled in this organization yet."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  style={{
                    marginTop: "14px",
                    padding: "7px 16px",
                    background: "var(--accent-blue)",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Enroll First Student
                </button>
              </div>
            ) : (
              <>
              {selectedIds.size > 0 && (
                <div style={{
                  padding: "9px 20px",
                  background: "#eff6ff",
                  borderBottom: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#1e40af" }}>
                      {selectedIds.size} student seat{selectedIds.size > 1 ? "s" : ""} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", fontWeight: "600", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Clear selection
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBulkRevokeModal(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      background: "#dc2626",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(220, 38, 38, 0.25)"
                    }}
                  >
                    <TrashIcon size={12} color="#ffffff" />
                    <span>Remove Selected ({selectedIds.size})</span>
                  </button>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "#64748b" }}>
                    <th style={{ width: "40px", padding: "10px 14px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={pagedCandidates.length > 0 && pagedCandidates.every(c => selectedIds.has(c.id))}
                        onChange={handleToggleSelectAll}
                        style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--accent-blue)" }}
                        title="Select All on Current Page"
                      />
                    </th>
                    <th style={{ padding: "10px 16px", fontWeight: "700" }}>Student / Candidate</th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>Candidate UID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>Access PIN</th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>Assigned Assessment</th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>Seat Status</th>
                    <th style={{ padding: "10px 16px", fontWeight: "700", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCandidates.map((c) => {
                    const isSelected = selectedIds.has(c.id);
                    return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isSelected ? "#f0f7ff" : "transparent",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <td style={{ width: "40px", padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(c.id)}
                          style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--accent-blue)" }}
                        />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: "700", color: "#0f172a" }}>{c.candidate_name}</div>
                        {c.candidate_email && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{c.candidate_email}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: "700",
                            color: "var(--accent-blue)",
                            background: "var(--accent-blue-subtle)",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}
                        >
                          {c.candidate_uid}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono, monospace)", color: "#334155" }}>
                        {c.access_pin_plain || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#334155" }}>
                        <div style={{ fontWeight: "600" }}>{c.exam_title || "General Roster"}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          Attempts: {c.max_attempts}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: c.status === "active" ? "#ecfdf5" : "#f1f5f9",
                            color: c.status === "active" ? "#059669" : "#64748b"
                          }}
                        >
                          {c.status ? c.status.toUpperCase() : "ACTIVE"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(c)}
                            title="Copy student exam credentials"
                            style={{
                              padding: "5px 8px",
                              background: "#f1f5f9",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              color: "#475569"
                            }}
                          >
                            <CopyIcon size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePromptRevoke(c)}
                            title="Revoke seat and free capacity"
                            style={{
                              padding: "5px 8px",
                              background: "#fee2e2",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              color: "#dc2626"
                            }}
                          >
                            <TrashIcon size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              {filteredCandidates.length > candPageSize && (
                <div
                  style={{
                    padding: "12px 18px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Showing <strong>{((candPage - 1) * candPageSize) + 1}</strong> to <strong>{Math.min(candPage * candPageSize, filteredCandidates.length)}</strong> of <strong>{filteredCandidates.length}</strong> unique candidates
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={candPage <= 1}
                      onClick={() => setCandPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                        background: candPage <= 1 ? "#f1f5f9" : "#ffffff",
                        color: candPage <= 1 ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: candPage <= 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: totalCandPages }, (_, i) => i + 1).map((num) => {
                      if (totalCandPages > 7 && Math.abs(num - candPage) > 2 && num !== 1 && num !== totalCandPages) {
                        if (Math.abs(num - candPage) === 3) {
                          return <span key={num} style={{ fontSize: "11px", color: "#94a3b8", padding: "0 2px" }}>...</span>;
                        }
                        return null;
                      }
                      const isCur = num === candPage;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCandPage(num)}
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
                      disabled={candPage >= totalCandPages}
                      onClick={() => setCandPage((p) => Math.min(totalCandPages, p + 1))}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                        background: candPage >= totalCandPages ? "#f1f5f9" : "#ffffff",
                        color: candPage >= totalCandPages ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: candPage >= totalCandPages ? "not-allowed" : "pointer"
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        )}

        {/* Tab Content: Workspace Members & Faculty */}
        {activeTab === "members" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                Workspace Faculty & Administrators
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Staff members authorized to create assessments, review submissions, and invigilate proctored exams.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {members.map((m) => (
                <div
                  key={m.id || m.email}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#eff6ff",
                        color: "var(--accent-blue)",
                        fontWeight: "800",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "12px"
                      }}
                    >
                      {(m.name || m.email || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>
                        {m.name || m.email}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{m.email}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      background: m.role === "owner" ? "#fef3c7" : "#eff6ff",
                      color: m.role === "owner" ? "#b45309" : "var(--accent-blue)",
                      textTransform: "uppercase"
                    }}
                  >
                    {m.role || "Faculty"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Showing <strong>{filteredCandidates.length}</strong> enrolled student seats of <strong>{maxCapacity.toLocaleString()}</strong> capacity limit.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: "7px 18px", fontSize: "12px" }}
          >
            Close Roster
          </button>
        </div>
      </div>
    
      {/* Bulk Revocation Confirmation Popup Modal */}
      {showBulkRevokeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => !bulkRevoking && setShowBulkRevokeModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <TrashIcon size={22} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: "700",
                    color: "#0f172a",
                    letterSpacing: "-0.01em"
                  }}
                >
                  Revoke {selectedIds.size} Candidate Seats?
                </h3>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "13px",
                    color: "#475569",
                    lineHeight: 1.55
                  }}
                >
                  Are you sure you want to revoke and remove the{" "}
                  <strong style={{ color: "#0f172a" }}>{selectedIds.size} selected candidate seat(s)</strong>?
                </p>
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#9f1239",
                    lineHeight: 1.5
                  }}
                >
                  These student seats will be <strong>immediately freed up</strong> in your organization capacity ({currentCount} / {maxCapacity}), and exam access credentials will be revoked.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "20px"
              }}
            >
              <button
                type="button"
                disabled={bulkRevoking}
                onClick={() => setShowBulkRevokeModal(false)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkRevoking}
                onClick={handleConfirmBulkRevoke}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: bulkRevoking ? "#94a3b8" : "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: bulkRevoking ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <TrashIcon size={14} color="#ffffff" />
                <span>{bulkRevoking ? "Removing..." : `Yes, Revoke (${selectedIds.size})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Popup Modal */}
      {candidateToRevoke && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => !revoking && setCandidateToRevoke(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <TrashIcon size={22} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: "700",
                    color: "#0f172a",
                    letterSpacing: "-0.01em"
                  }}
                >
                  Revoke Candidate Seat?
                </h3>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "13px",
                    color: "#475569",
                    lineHeight: 1.55
                  }}
                >
                  Are you sure you want to revoke the seat for candidate{" "}
                  <strong style={{ color: "#0f172a" }}>
                    {candidateToRevoke.candidate_name || "Candidate"}
                  </strong>{" "}
                  (<span style={{ fontFamily: "monospace", color: "#dc2626", fontWeight: "700" }}>{candidateToRevoke.candidate_uid}</span>)?
                </p>
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#9f1239",
                    lineHeight: 1.5
                  }}
                >
                  This student's seat will be <strong>immediately freed up</strong> in your organization capacity, and their examination credentials will be revoked.
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px"
              }}
            >
              <button
                type="button"
                disabled={revoking}
                onClick={() => setCandidateToRevoke(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: revoking ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={handleConfirmRevoke}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: revoking ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)"
                }}
              >
                {revoking ? "Revoking..." : "Revoke Seat"}
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}

