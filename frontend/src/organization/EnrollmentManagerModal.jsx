import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import { TrashIcon, XIcon } from "../shared/Icons";

export default function EnrollmentManagerModal({
  exam,
  organizationId,
  onClose,
  onTestAsCandidate
}) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generateCount, setGenerateCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isClassroomSyncing, setIsClassroomSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [deletingSingle, setDeletingSingle] = useState(false);

  // Single Candidate Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    candidate_name: "",
    candidate_email: "",
    candidate_uid: "",
    access_pin: "",
    max_attempts: 1
  });
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);

  // Edit Candidate Modal
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editForm, setEditForm] = useState({
    candidate_name: "",
    candidate_email: "",
    access_pin: "",
    max_attempts: 1,
    status: "active"
  });
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);

  const examIdentifier = exam?.slug || exam?.id || "allen-kota-mock";

  useEffect(() => {
    loadEnrollments();
  }, [exam?.id]);

  async function loadEnrollments() {
    if (!exam) return;
    setLoading(true);
    try {
      const res = await api.getExamEnrollments(exam.id);
      setEnrollments(res || []);
    } catch (err) {
      console.warn("Failed loading enrollments:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkGenerate() {
    setIsGenerating(true);
    setStatusMsg("");
    try {
      await api.bulkGenerateEnrollments(exam.id, {
        count: generateCount,
        max_attempts: 1
      });
      setStatusMsg(`Successfully generated ${generateCount} candidate UIDs & PINs!`);
      toast.success(`Successfully generated ${generateCount} candidate UIDs & PINs!`);
      loadEnrollments();
    } catch (err) {
      toast.error("Error generating UIDs: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleImportFromClassroom() {
    const orgId = organizationId || exam?.organization_id;
    if (!orgId) {
      toast.error("Organization context missing.");
      return;
    }
    setIsClassroomSyncing(true);
    setStatusMsg("");
    try {
      const statusRes = await api.getClassroomStatus(orgId).catch(() => null);
      if (!statusRes?.connected) {
        // Prompt OAuth connection
        const activeCid = import.meta.env.VITE_GOOGLE_CLIENT_ID || "539216233370-eca2ktq30qc3m74o04b17q7bp90sds0j.apps.googleusercontent.com";
        if (!window.google?.accounts?.oauth2) {
          toast.warning("Google Identity Services is initializing. Please try again in 2 seconds.");
          setIsClassroomSyncing(false);
          return;
        }
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeCid,
          scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/drive.file",
          callback: async (tokenResp) => {
            if (tokenResp?.access_token) {
              await api.connectClassroom({ organization_id: orgId, access_token: tokenResp.access_token });
              await proceedWithClassroomImport(orgId);
            } else {
              setIsClassroomSyncing(false);
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: "consent" });
        return;
      }

      await proceedWithClassroomImport(orgId);
    } catch (err) {
      toast.error("Classroom import error: " + err.message);
      setIsClassroomSyncing(false);
    }
  }

  async function proceedWithClassroomImport(orgId) {
    try {
      const courses = await api.getClassroomCourses(orgId);
      if (!courses || courses.length === 0) {
        toast.warning("No active Google Classroom courses found on your account.");
        setIsClassroomSyncing(false);
        return;
      }
      const courseId = exam?.classroom_course_id || courses[0].id;
      const res = await api.importClassroomStudents(courseId, exam.id);
      setStatusMsg(` ${res.message}`);
      toast.success(` ${res.message}\n• Downloaded Candidate Credentials PDF (Login IDs & Passwords)`);
      await loadEnrollments();

      // Download updated credentials PDF automatically
      try {
        await api.downloadExamCredentialsPdf(exam.id, exam.room_code || "CLASSROOM");
      } catch (pdfErr) {
        console.warn("Could not auto-download PDF:", pdfErr);
      }
    } catch (err) {
      toast.error("Failed to import students from Classroom: " + err.message);
    } finally {
      setIsClassroomSyncing(false);
    }
  }

  async function handleRevoke(enrollmentId, uid) {
    if (!window.confirm(`Are you sure you want to revoke access for UID ${uid}?`)) return;
    try {
      await api.revokeEnrollment(exam.id, enrollmentId);
      toast.info(`Access revoked for candidate UID ${uid}.`);
      loadEnrollments();
    } catch (err) {
      toast.error("Error revoking enrollment: " + err.message);
    }
  }

  async function handleCreateSingleCandidate(e) {
    e.preventDefault();
    if (!addForm.candidate_name.trim()) {
      toast.warning("Candidate name is required");
      return;
    }
    setIsAddingCandidate(true);
    try {
      const res = await api.createEnrollment(exam.id, {
        candidate_name: addForm.candidate_name.trim(),
        candidate_email: addForm.candidate_email.trim() || undefined,
        candidate_uid: addForm.candidate_uid.trim() || undefined,
        access_pin: addForm.access_pin.trim() || undefined,
        max_attempts: Number(addForm.max_attempts) || 1
      });
      setStatusMsg(`Enrolled student ${res.candidate_name} (UID: ${res.candidate_uid}, PIN: ${res.access_pin})!`);
      toast.success(`Enrolled student ${res.candidate_name}!\n• UID: ${res.candidate_uid}\n• PIN: ${res.access_pin}`);
      setShowAddModal(false);
      setAddForm({
        candidate_name: "",
        candidate_email: "",
        candidate_uid: "",
        access_pin: "",
        max_attempts: 1
      });
      loadEnrollments();
    } catch (err) {
      toast.error("Failed to enroll candidate: " + err.message);
    } finally {
      setIsAddingCandidate(false);
    }
  }

  function handleOpenEditCandidate(candidate) {
    setEditingCandidate(candidate);
    setEditForm({
      candidate_name: candidate.candidate_name || "",
      candidate_email: candidate.candidate_email || "",
      access_pin: candidate.access_pin || "",
      max_attempts: candidate.max_attempts || 1,
      status: candidate.status || "active"
    });
  }

  async function handleSaveEditCandidate(e) {
    e.preventDefault();
    if (!editingCandidate) return;
    if (!editForm.candidate_name.trim()) {
      alert("Candidate name is required");
      return;
    }
    setIsUpdatingCandidate(true);
    try {
      await api.updateEnrollment(exam.id, editingCandidate.id, {
        candidate_name: editForm.candidate_name.trim(),
        candidate_email: editForm.candidate_email.trim() || undefined,
        access_pin: editForm.access_pin.trim() || undefined,
        max_attempts: Number(editForm.max_attempts) || 1,
        status: editForm.status
      });
      setStatusMsg(`Updated candidate ${editingCandidate.candidate_uid}!`);
      setEditingCandidate(null);
      loadEnrollments();
    } catch (err) {
      alert("Failed to update candidate: " + err.message);
    } finally {
      setIsUpdatingCandidate(false);
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
    if (enrollments.length === 0) return;
    const allSelected = enrollments.every((e) => selectedIds.has(e.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        enrollments.forEach((e) => next.delete(e.id));
      } else {
        enrollments.forEach((e) => next.add(e.id));
      }
      return next;
    });
  }

  function handleDeleteCandidate(enrollmentId, name, uid) {
    setCandidateToDelete({ id: enrollmentId, name, uid });
  }

  async function handleConfirmSingleDelete() {
    if (!candidateToDelete) return;
    setDeletingSingle(true);
    try {
      await api.deleteEnrollment(exam.id, candidateToDelete.id);
      toast.success(`Removed candidate ${candidateToDelete.name} (${candidateToDelete.uid}).`);
      setCandidateToDelete(null);
      loadEnrollments();
    } catch (err) {
      toast.error("Failed to delete candidate: " + err.message);
    } finally {
      setDeletingSingle(false);
    }
  }

  async function handleConfirmBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await api.bulkDeleteEnrollments(exam.id, Array.from(selectedIds));
      toast.success(res.message || `Successfully removed ${selectedIds.size} student enrollment(s)!`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      loadEnrollments();
    } catch (err) {
      toast.error("Failed to remove enrollments: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  function getJoinBaseUrl() {
    if (exam?.mode === "quick_quiz" && exam?.room_code) {
      return `${window.location.origin}/quiz/${encodeURIComponent(exam.room_code)}`;
    }
    return `${window.location.origin}/exam/${encodeURIComponent(examIdentifier)}`;
  }

  function handleCopyInviteLink(e) {
    const base = getJoinBaseUrl();
    const directUrl = exam?.mode === "quick_quiz"
      ? base
      : `${base}?uid=${encodeURIComponent(e.candidate_uid)}&pin=${encodeURIComponent(e.access_pin || '')}`;
    navigator.clipboard.writeText(directUrl);
    setStatusMsg(`Copied direct exam link for ${e.candidate_name}!`);
  }

  function handleCopyFullInvite(e) {
    const base = getJoinBaseUrl();
    const directUrl = exam?.mode === "quick_quiz"
      ? base
      : `${base}?uid=${encodeURIComponent(e.candidate_uid)}&pin=${encodeURIComponent(e.access_pin || '')}`;
    const text = `Dear ${e.candidate_name},

You have been invited to take the examination:
 "${exam.title}"

Please access the examination portal using your secure credentials below:
 Direct Exam Link: ${directUrl}
 Enrollment UID: ${e.candidate_uid}
 Access PIN: ${e.access_pin || 'None'}

Important Instructions:
1. Complete device and camera verification before beginning.
2. Ensure a quiet environment and do not leave fullscreen mode.
3. Your answers will be automatically autosaved.`;

    navigator.clipboard.writeText(text);
    setStatusMsg(`Copied full exam invitation text for ${e.candidate_name} to clipboard!`);
  }

  function handleExportCsv() {
    if (enrollments.length === 0) return;
    const header = "Candidate Name,Candidate UID,Access PIN,Direct Exam URL,Attempts Used,Max Attempts,Status\n";
    const rows = enrollments.map((e) => {
      const base = getJoinBaseUrl();
      const directUrl = exam?.mode === "quick_quiz"
        ? base
        : `${base}?uid=${encodeURIComponent(e.candidate_uid)}&pin=${encodeURIComponent(e.access_pin || '')}`;
      return `"${e.candidate_name}","${e.candidate_uid}","${e.access_pin || ''}","${directUrl}",${e.attempts_used},${e.max_attempts},"${e.status}"`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${exam.title.replace(/\s+/g, '_')}_candidate_invitations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100
    }}>
      <div className="dash-card" style={{
        width: "920px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        borderRadius: "16px"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
              Exam Candidate Invitations & Enrollments
            </h2>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Exam: <strong>{exam?.title}</strong> • Students take exams with an enrollment UID (No permanent account needed)
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", fontSize: "18px", color: "var(--text-muted)", cursor: "pointer" }}
          >
            
          </button>
        </div>

        {/* Global Exam Invitation Link & Live QR Code Box */}
        <div style={{
          padding: "16px 28px",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Live QR Code generated for students */}
            <div style={{
              background: "#ffffff",
              padding: "6px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              placeItems: "center"
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(getJoinBaseUrl())}`}
                alt="Student Exam QR Code"
                style={{ width: "90px", height: "90px", display: "block" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", background: "var(--accent-emerald-subtle)", color: "var(--accent-emerald)", padding: "2px 8px", borderRadius: "4px" }}>
                  NO STUDENT SIGN-UP REQUIRED
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Scan QR or open link on any mobile or desktop
                </span>
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                Candidate Examination Link & Mobile QR Pass
              </div>
              <code style={{ background: "#ffffff", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--accent-blue)" }}>
                {getJoinBaseUrl()}
              </code>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const url = getJoinBaseUrl();
                navigator.clipboard.writeText(url);
                setStatusMsg("Copied direct student exam link to clipboard!");
              }}
              style={{ fontSize: "12px", padding: "8px 14px" }}
            >
               Copy Direct Link
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div style={{
          padding: "16px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Generate More UIDs:</span>
            <input
              type="number"
              className="lunaris-input"
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              min={1}
              max={500}
              style={{ width: "70px", padding: "6px 8px", fontSize: "13px" }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleBulkGenerate}
              disabled={isGenerating}
              style={{ padding: "7px 14px", fontSize: "13px" }}
            >
              {isGenerating ? "Generating..." : "+ Batch Generate UIDs"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleImportFromClassroom}
              disabled={isClassroomSyncing}
              style={{
                padding: "7px 14px",
                fontSize: "13px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "700",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {isClassroomSyncing ? "Syncing..." : " + Sync Google Classroom"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                padding: "7px 14px",
                fontSize: "13px",
                background: "var(--accent-emerald)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
               + Add Single Student
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCsv}
              disabled={enrollments.length === 0}
              style={{ padding: "7px 14px", fontSize: "13px" }}
            >
               Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => api.downloadExamCredentialsPdf(exam.id, exam.room_code || "EXAM")}
              disabled={enrollments.length === 0}
              style={{
                padding: "7px 14px",
                fontSize: "13px",
                fontWeight: "700",
                background: "#eff6ff",
                color: "#2563eb",
                borderColor: "#bfdbfe"
              }}
            >
               Download Credentials PDF
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadEnrollments}
              style={{ padding: "7px 12px", fontSize: "13px" }}
            >
              Refresh
            </button>
          </div>
        </div>

        {statusMsg && (
          <div style={{
            margin: "12px 28px 0",
            padding: "8px 14px",
            background: "var(--accent-emerald-subtle)",
            color: "var(--accent-emerald)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: "600"
          }}>
             {statusMsg}
          </div>
        )}

        {/* Enrollment Table */}
        <div style={{ flex: 1, padding: "16px 28px", overflowY: "auto" }}>
          {selectedIds.size > 0 && (
            <div style={{
              padding: "10px 16px",
              marginBottom: "12px",
              background: "#eff6ff",
              borderRadius: "8px",
              border: "1px solid #bfdbfe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#1e40af" }}>
                  {selectedIds.size} student{selectedIds.size > 1 ? "s" : ""} selected
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
                onClick={() => setShowBulkDeleteModal(true)}
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
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ width: "36px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={enrollments.length > 0 && enrollments.every(e => selectedIds.has(e.id))}
                    onChange={handleToggleSelectAll}
                    style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--accent-blue)" }}
                    title="Select All Candidates"
                  />
                </th>
                <th>Candidate Name</th>
                <th>Enrollment UID</th>
                <th>Access PIN</th>
                <th>Attempts</th>
                <th>Status</th>
                <th>Invite & Launch</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => {
                const isSelected = selectedIds.has(e.id);
                return (
                <tr key={e.id} style={{ background: isSelected ? "#f0f7ff" : "transparent" }}>
                  <td style={{ width: "36px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(e.id)}
                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--accent-blue)" }}
                    />
                  </td>
                  <td>
                    <strong>{e.candidate_name}</strong>
                    {e.candidate_email && (
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                        {e.candidate_email}
                      </span>
                    )}
                  </td>
                  <td>
                    <code style={{
                      background: "var(--bg-secondary)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "var(--accent-blue)",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      {e.candidate_uid}
                    </code>
                  </td>
                  <td>
                    <code style={{
                      background: "var(--bg-secondary)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "700"
                    }}>
                      {e.access_pin || "None"}
                    </code>
                  </td>
                  <td style={{ fontSize: "13px" }}>
                    {e.attempts_used} / {e.max_attempts}
                  </td>
                  <td>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: "700",
                      background: e.status === "active" ? "var(--accent-emerald-subtle)" : "var(--accent-rose-subtle)",
                      color: e.status === "active" ? "var(--accent-emerald)" : "var(--accent-rose)"
                    }}>
                      {e.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(e)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          background: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          fontWeight: "600",
                          color: "var(--text-primary)"
                        }}
                      >
                         Copy Link
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyFullInvite(e)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          background: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          fontWeight: "600",
                          color: "var(--text-primary)"
                        }}
                      >
                        Copy Message
                      </button>

                      {onTestAsCandidate && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onTestAsCandidate(examIdentifier, e.candidate_uid, e.access_pin || '');
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            background: "var(--accent-blue)",
                            color: "#ffffff",
                            fontWeight: "700"
                          }}
                        >
                           Test Exam
                        </button>
                      )}

                      {e.status === "active" && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(e.id, e.candidate_uid)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            background: "#ffffff",
                            color: "#d97706",
                            border: "1px solid #fde68a",
                            fontWeight: "600"
                          }}
                          title="Revoke access"
                        >
                          Revoke
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditCandidate(e)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          background: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          fontWeight: "600",
                          color: "var(--text-primary)"
                        }}
                        title="Edit Student Information"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(e.id, e.candidate_name, e.candidate_uid)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          background: "var(--accent-rose-subtle, rgba(244, 63, 94, 0.1))",
                          border: "1px solid rgba(244, 63, 94, 0.25)",
                          fontWeight: "700",
                          color: "#e11d48"
                        }}
                        title="Permanently Delete Student Record"
                      >
                         Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
              {enrollments.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No candidates enrolled yet. Click "Batch Generate UIDs" to generate secure exam credentials!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Single Candidate Modal */}
        {showAddModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px"
          }}>
            <div className="dash-card" style={{ maxWidth: "520px", width: "100%", padding: "28px", borderRadius: "16px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
                     Enroll Single Student / Candidate
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Add an individual candidate with custom or automated UID & PIN
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  
                </button>
              </div>

              <form onSubmit={handleCreateSingleCandidate}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    className="lunaris-input"
                    value={addForm.candidate_name}
                    onChange={(e) => setAddForm({ ...addForm, candidate_name: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    required
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Student Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="lunaris-input"
                    value={addForm.candidate_email}
                    onChange={(e) => setAddForm({ ...addForm, candidate_email: e.target.value })}
                    placeholder="e.g. aarav.sharma@example.com"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Enrollment UID (Optional)
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={addForm.candidate_uid}
                      onChange={(e) => setAddForm({ ...addForm, candidate_uid: e.target.value })}
                      placeholder="Auto: LUN-XXXXXX"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Access PIN (Optional)
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={addForm.access_pin}
                      onChange={(e) => setAddForm({ ...addForm, access_pin: e.target.value })}
                      placeholder="Auto: 4 digits"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Max Exam Attempts
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="lunaris-input"
                    value={addForm.max_attempts}
                    onChange={(e) => setAddForm({ ...addForm, max_attempts: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isAddingCandidate}
                    style={{ padding: "8px 20px", fontSize: "13px", background: "var(--accent-emerald)" }}
                  >
                    {isAddingCandidate ? "Enrolling..." : "Enroll Candidate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Single Candidate Delete Confirmation Modal */}
        {candidateToDelete && (
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}>
            <div style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "440px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
                Remove Candidate Enrollment?
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Are you sure you want to remove <strong>{candidateToDelete.name}</strong> ({candidateToDelete.uid})? All associated attempts and exam credentials will be revoked.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setCandidateToDelete(null)}
                  style={{ padding: "8px 14px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingSingle}
                  onClick={handleConfirmSingleDelete}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "#dc2626", color: "#ffffff", border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  {deletingSingle ? "Removing..." : "Remove Candidate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}>
            <div style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "440px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
                Remove {selectedIds.size} Candidate Enrollments?
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Are you sure you want to remove the <strong>{selectedIds.size} selected candidate(s)</strong> from this examination? Their access credentials and attempt sessions will be permanently revoked.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={handleConfirmBulkDelete}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "#dc2626", color: "#ffffff", border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  {bulkDeleting ? "Removing..." : `Yes, Remove (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Candidate Modal */}
        {editingCandidate && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px"
          }}>
            <div className="dash-card" style={{ maxWidth: "520px", width: "100%", padding: "28px", borderRadius: "16px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
                    Edit Candidate ({editingCandidate.candidate_uid})
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Update candidate details, security PIN, or enrollment status
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  
                </button>
              </div>

              <form onSubmit={handleSaveEditCandidate}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    className="lunaris-input"
                    value={editForm.candidate_name}
                    onChange={(e) => setEditForm({ ...editForm, candidate_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Student Email
                  </label>
                  <input
                    type="email"
                    className="lunaris-input"
                    value={editForm.candidate_email}
                    onChange={(e) => setEditForm({ ...editForm, candidate_email: e.target.value })}
                    placeholder="candidate@example.com"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Access PIN
                    </label>
                    <input
                      type="text"
                      className="lunaris-input"
                      value={editForm.access_pin}
                      onChange={(e) => setEditForm({ ...editForm, access_pin: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="lunaris-input"
                      value={editForm.max_attempts}
                      onChange={(e) => setEditForm({ ...editForm, max_attempts: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Enrollment Status
                  </label>
                  <select
                    className="lunaris-input"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="revoked">Revoked (Access Suspended)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingCandidate(null)}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isUpdatingCandidate}
                    style={{ padding: "8px 20px", fontSize: "13px" }}
                  >
                    {isUpdatingCandidate ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "14px 28px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Total Enrolled: <strong>{enrollments.length} Candidates</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ fontSize: "13px" }}>
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
