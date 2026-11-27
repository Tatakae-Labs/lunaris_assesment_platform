import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import {
  FileTextIcon, PlusIcon, EditIcon, TrashIcon, CopyIcon,
  CheckIcon, XIcon, SearchIcon, ClockIcon, TrophyIcon,
  LayersIcon, SparklesIcon, RefreshIcon, AlertTriangleIcon
} from "../shared/Icons";
import TemplateBuilderModal from "./TemplateBuilderModal";

export default function TemplateManager({
  organizationId,
  onGeneratePaperFromTemplate,
  onNavigateToStudio
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modal states
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Version history modal state
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [activeVersionTemplate, setActiveVersionTemplate] = useState(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Delete confirm modal state
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadTemplates();
    }
  }, [organizationId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.getTemplates(organizationId);
      const list = Array.isArray(res) ? res : (res?.templates || []);
      setTemplates(list);
    } catch (err) {
      console.error("Failed to load templates:", err);
      toast.error(err.message || "Failed to load examination templates.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setBuilderOpen(true);
  };

  const handleEdit = (tmpl) => {
    setSelectedTemplate(tmpl);
    setBuilderOpen(true);
  };

  const handleDuplicate = async (tmpl) => {
    try {
      const res = await api.duplicateTemplate(tmpl.id);
      toast.success(`Template duplicated as "${res.template?.title || "Copy"}"`);
      await loadTemplates();
    } catch (err) {
      toast.error(err.message || "Failed to duplicate template.");
    }
  };

  const handleTogglePublish = async (tmpl) => {
    const nextStatus = tmpl.status === "published" ? "draft" : "published";
    try {
      await api.publishTemplate(tmpl.id, nextStatus === "published");
      toast.success(
        nextStatus === "published"
          ? `Template "${tmpl.title}" published for examination use.`
          : `Template "${tmpl.title}" moved back to draft.`
      );
      await loadTemplates();
    } catch (err) {
      toast.error(err.message || "Failed to update template status.");
    }
  };

  const openVersionHistory = async (tmpl) => {
    setActiveVersionTemplate(tmpl);
    setVersionModalOpen(true);
    setLoadingVersions(true);
    try {
      const res = await api.getTemplateVersions(tmpl.id);
      setVersionHistory(res.versions || []);
    } catch (err) {
      toast.error(err.message || "Failed to fetch version history.");
      setVersionHistory([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (versionNum) => {
    if (!activeVersionTemplate) return;
    try {
      await api.rollbackTemplateVersion(activeVersionTemplate.id, versionNum);
      toast.success(`Rolled back to version v${versionNum} successfully.`);
      setVersionModalOpen(false);
      await loadTemplates();
    } catch (err) {
      toast.error(err.message || "Rollback failed.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTemplate) return;
    setDeleting(true);
    try {
      await api.deleteTemplate(deleteConfirmTemplate.id);
      toast.success("Template deleted successfully.");
      setDeleteConfirmTemplate(null);
      await loadTemplates();
    } catch (err) {
      toast.error(err.message || "Failed to delete template.");
    } finally {
      setDeleting(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.exam_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === "all" || t.exam_type === filterType;
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header / Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          background: "#ffffff",
          padding: "20px 24px",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <FileTextIcon size={16} />
            </div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>
              Question Paper Templates
            </h2>
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#f1f5f9",
                color: "var(--text-secondary)",
                fontWeight: "600"
              }}
            >
              {templates.length} total
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
            Design, configure and version assessment blueprints. Create standardized papers using Question Bank questions and context-aware AI.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {onNavigateToStudio && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToStudio}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                padding: "8px 14px"
              }}
            >
              <SparklesIcon size={14} /> Paper Studio Workbench
            </button>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateNew}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              padding: "8px 16px"
            }}
          >
            <PlusIcon size={15} /> Create Template
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "#ffffff",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid var(--border-subtle)"
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <SearchIcon
            size={14}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)"
            }}
          />
          <input
            type="text"
            placeholder="Search templates by title, description or exam type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 12px 7px 34px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle)",
              outline: "none"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle)",
              background: "#ffffff",
              color: "var(--text-primary)"
            }}
          >
            <option value="all">All Exam Types</option>
            <option value="cbt">Computer Based Test (CBT)</option>
            <option value="jee_main">JEE Main Pattern</option>
            <option value="neet">NEET Pattern</option>
            <option value="school_exam">Term / Semester Exam</option>
            <option value="custom">Custom Format</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle)",
              background: "#ffffff",
              color: "var(--text-primary)"
            }}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>

          <button
            type="button"
            className="btn-secondary"
            onClick={loadTemplates}
            title="Refresh Templates"
            style={{ padding: "7px 10px" }}
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <RefreshIcon size={24} style={{ animation: "spin 1s linear infinite", marginBottom: "8px" }} />
          <div style={{ fontSize: "14px" }}>Loading examination blueprints...</div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px dashed var(--border-subtle)",
            padding: "48px 24px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--accent-blue-subtle)",
              color: "var(--accent-blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}
          >
            <FileTextIcon size={24} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
            {templates.length === 0 ? "No Examination Templates Yet" : "No Matching Templates Found"}
          </h3>
          <p
            style={{
              margin: "0 auto 20px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              maxWidth: "440px"
            }}
          >
            {templates.length === 0
              ? "Design reusable question paper blueprints with section rules, difficulty distributions, and automated mark calculations."
              : "Try adjusting your search terms or filters to find what you're looking for."}
          </p>
          {templates.length === 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateNew}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <PlusIcon size={14} /> Create Your First Template
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "20px"
          }}
        >
          {filteredTemplates.map((tmpl) => {
            const sections = tmpl.sections || tmpl.sections_json || tmpl.sections_summary || [];
            const isPublished = tmpl.status === "published";

            return (
              <div
                key={tmpl.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: isPublished ? "1.5px solid #e2e8f0" : "1px dashed #cbd5e1",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  overflow: "hidden"
                }}
              >
                {/* Card Top */}
                <div style={{ padding: "18px 20px 14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "10px",
                      gap: "8px"
                    }}
                  >
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: isPublished ? "#ecfdf5" : "#f1f5f9",
                          color: isPublished ? "#059669" : "#64748b",
                          border: `1px solid ${isPublished ? "#a7f3d0" : "#e2e8f0"}`
                        }}
                      >
                        {tmpl.status}
                      </span>

                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "var(--accent-blue-subtle)",
                          color: "var(--accent-blue)"
                        }}
                      >
                        {tmpl.exam_type?.toUpperCase().replace("_", " ")}
                      </span>

                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          background: "#f8fafc",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)"
                        }}
                      >
                        v{tmpl.current_version || 1}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        onClick={() => openVersionHistory(tmpl)}
                        title="Version History & Rollback"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          padding: "4px",
                          borderRadius: "4px"
                        }}
                      >
                        <RefreshIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(tmpl)}
                        title="Duplicate Template"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          padding: "4px",
                          borderRadius: "4px"
                        }}
                      >
                        <CopyIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmTemplate(tmpl)}
                        title="Delete Template"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          padding: "4px",
                          borderRadius: "4px"
                        }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "var(--text-primary)",
                      lineHeight: "1.3"
                    }}
                  >
                    {tmpl.title}
                  </h3>

                  {tmpl.description && (
                    <p
                      style={{
                        margin: "0 0 14px",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: "1.4",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}
                    >
                      {tmpl.description}
                    </p>
                  )}

                  {/* Quantitative Chips */}
                  <div
                    style={{
                      display: "flex",
                      gap: "14px",
                      padding: "10px 12px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      fontSize: "12px",
                      marginBottom: "12px",
                      border: "1px solid var(--border-subtle)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <FileTextIcon size={13} color="var(--accent-blue)" />
                      <span>
                        <strong>{tmpl.total_questions || 0}</strong> Qs
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <TrophyIcon size={13} color="#f59e0b" />
                      <span>
                        <strong>{tmpl.total_marks || 0}</strong> Marks
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <ClockIcon size={13} color="#10b981" />
                      <span>
                        <strong>{tmpl.duration_minutes || 0}</strong> min
                      </span>
                    </div>
                  </div>

                  {/* Section Pills */}
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "6px"
                      }}
                    >
                      Sections ({sections.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {sections.map((sec, idx) => (
                        <span
                          key={sec.id || idx}
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "#ffffff",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <span style={{ fontWeight: "600" }}>{sec.name}</span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            ({sec.required_questions} Qs)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Bottom / Actions */}
                <div
                  style={{
                    padding: "12px 20px",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleEdit(tmpl)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <EditIcon size={12} /> Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePublish(tmpl)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                        background: "#ffffff",
                        color: isPublished ? "#64748b" : "#059669",
                        cursor: "pointer",
                        fontWeight: "600"
                      }}
                    >
                      {isPublished ? "Unpublish" : "Publish"}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (onGeneratePaperFromTemplate) {
                        onGeneratePaperFromTemplate(tmpl);
                      }
                    }}
                    style={{
                      fontSize: "12px",
                      padding: "6px 14px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }}
                  >
                    <SparklesIcon size={12} /> Create Paper
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Builder Modal */}
      {builderOpen && (
        <TemplateBuilderModal
          organizationId={organizationId}
          templateId={selectedTemplate?.id || null}
          initialTemplate={selectedTemplate}
          onClose={() => {
            setBuilderOpen(false);
            setSelectedTemplate(null);
          }}
          onSaved={async (savedTmpl) => {
            setBuilderOpen(false);
            setSelectedTemplate(null);
            await loadTemplates();
          }}
        />
      )}

      {/* Version History Modal */}
      {versionModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "600px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "85vh"
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                  Version History & Audit
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {activeVersionTemplate?.title} (Current: v{activeVersionTemplate?.current_version})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVersionModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
              {loadingVersions ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
                  Loading revision snapshots...
                </div>
              ) : versionHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
                  No historical snapshots recorded yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {versionHistory.map((ver) => {
                    const snap = ver.snapshot_json || {};
                    const isCurrent = ver.version_number === activeVersionTemplate?.current_version;

                    return (
                      <div
                        key={ver.id}
                        style={{
                          padding: "14px",
                          borderRadius: "8px",
                          border: isCurrent ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                          background: isCurrent ? "var(--accent-blue-subtle)" : "#ffffff",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                              Version {ver.version_number}
                            </span>
                            {isCurrent && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--accent-blue)",
                                  color: "#ffffff"
                                }}
                              >
                                Active
                              </span>
                            )}
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                              {new Date(ver.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                            {ver.change_summary || "Automated blueprint snapshot"}
                          </div>

                          <div style={{ fontSize: "11px", color: "var(--text-primary)" }}>
                            {snap.total_questions || 0} Questions | {snap.total_marks || 0} Marks | {snap.sections?.length || 0} Sections
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleRollback(ver.version_number)}
                            style={{ fontSize: "12px", padding: "5px 10px" }}
                          >
                            Rollback
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-subtle)",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "flex-end"
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setVersionModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              padding: "24px"
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px"
              }}
            >
              <AlertTriangleIcon size={22} />
            </div>

            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700" }}>
              Delete Template?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Are you sure you want to permanently delete template <strong>"{deleteConfirmTemplate.title}"</strong>? Any papers already generated from this template will remain intact.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmTemplate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: deleting ? "not-allowed" : "pointer"
                }}
              >
                {deleting ? "Deleting..." : "Delete Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

