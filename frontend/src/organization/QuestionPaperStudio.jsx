import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import { toast } from "../shared/toast";
import {
  FileTextIcon, PlusIcon, EditIcon, TrashIcon, CheckIcon, XIcon,
  SearchIcon, DownloadIcon, SparklesIcon, RefreshIcon,
  AlertTriangleIcon, LockIcon, UnlockIcon, ArrowUpIcon, ArrowDownIcon,
  LayersIcon, ClockIcon, TrophyIcon, ShieldIcon, CheckIcon as VerifiedIcon
} from "../shared/Icons";

export default function QuestionPaperStudio({
  organizationId,
  initialTemplateForCreation = null,
  onNavigateToTemplates
}) {
  const [activeTab, setActiveTab] = useState(initialTemplateForCreation ? "create" : "papers");

  // Papers List State
  const [papers, setPapers] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [paperFilterStatus, setPaperFilterStatus] = useState("all");

  // Generation / Creation State
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateForCreation?.id || "");
  const [customTitle, setCustomTitle] = useState(
    initialTemplateForCreation ? `${initialTemplateForCreation.title} - Question Paper` : ""
  );
  const [customInstructions, setCustomInstructions] = useState(
    initialTemplateForCreation?.instructions || ""
  );
  const [bankRatio, setBankRatio] = useState(50); // 0 to 100%
  const [generating, setGenerating] = useState(false);

  // Workbench / Review State
  const [currentPaper, setCurrentPaper] = useState(null);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activeSetKey, setActiveSetKey] = useState("master"); // 'master', 'SET A', 'SET B', etc.
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [validationReport, setValidationReport] = useState(null);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Question Bank Picker for replacement
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankPickerTarget, setBankPickerTarget] = useState(null); // { sectionId, qIndex, subject }
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  // Sets generation modal
  const [setsModalOpen, setSetsModalOpen] = useState(false);
  const [generatingSets, setGeneratingSets] = useState(false);
  const [setCountToGenerate, setSetCountToGenerate] = useState(3);

  // Delete modal
  const [deleteConfirmPaper, setDeleteConfirmPaper] = useState(null);
  const [deletingPaper, setDeletingPaper] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadPapers();
      loadTemplates();
    }
  }, [organizationId]);

  useEffect(() => {
    if (initialTemplateForCreation) {
      setSelectedTemplateId(initialTemplateForCreation.id);
      setCustomTitle(`${initialTemplateForCreation.title} - Examination Paper`);
      setCustomInstructions(initialTemplateForCreation.instructions || "");
      setActiveTab("create");
    }
  }, [initialTemplateForCreation]);

  const loadPapers = async () => {
    setLoadingPapers(true);
    try {
      const res = await api.getGeneratedPapers(organizationId);
      const list = Array.isArray(res) ? res : (res?.papers || []);
      setPapers(list);
    } catch (err) {
      toast.error(err.message || "Failed to load generated papers.");
    } finally {
      setLoadingPapers(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTemplates(organizationId);
      const list = Array.isArray(res) ? res : (res?.templates || []);
      setTemplates(list);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const openWorkbench = async (paperId) => {
    setLoadingPaper(true);
    try {
      const res = await api.getGeneratedPaper(paperId);
      const paper = res?.paper || res;
      if (!paper) throw new Error("Paper data could not be retrieved.");
      setCurrentPaper(paper);
      setActiveSetKey("master");
      const secs = paper.sections_data_json || paper.sections || [];
      if (secs.length > 0) {
        setActiveSectionId(secs[0].id);
      }
      setActiveTab("workbench");
      // auto-validate
      runValidation(paper.id);
    } catch (err) {
      toast.error(err.message || "Failed to load paper details.");
    } finally {
      setLoadingPaper(false);
    }
  };

  const handleGeneratePaper = async (e) => {
    e.preventDefault();
    if (!selectedTemplateId) {
      toast.error("Please select a question paper template.");
      return;
    }

    setGenerating(true);
    try {
      let targetOrgId = organizationId;
      if (!targetOrgId && initialTemplateForCreation?.organization_id) {
        targetOrgId = initialTemplateForCreation.organization_id;
      }
      if (!targetOrgId) {
        try {
          const saved = localStorage.getItem("lunaris_user");
          targetOrgId = saved ? JSON.parse(saved)?.organization_id : "";
        } catch (e) {}
      }

      const ratio = bankRatio / 100.0;
      const res = await api.generatePaper({
        organization_id: targetOrgId || undefined,
        template_id: selectedTemplateId,
        title: customTitle.trim() || undefined,
        instructions: customInstructions.trim() || undefined,
        instructions_override: customInstructions.trim() || undefined,
        bank_to_ai_ratio: ratio
      });

      toast.success("Question paper synthesized and populated successfully!");
      await loadPapers();
      const generatedId = res?.paper?.id || res?.id;
      if (generatedId) {
        await openWorkbench(generatedId);
      }
    } catch (err) {
      console.error("Generate paper error:", err);
      toast.error(err.message || "Failed to generate question paper.");
    } finally {
      setGenerating(false);
    }
  };

  const runValidation = async (paperId = currentPaper?.id) => {
    if (!paperId) return;
    setValidating(true);
    try {
      const res = await api.validateGeneratedPaper(paperId);
      setValidationReport(res);
      if (res.valid) {
        // toast.success("Question paper satisfies all blueprint specifications!");
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setValidating(false);
    }
  };

  const handleMoveQuestion = async (sectionId, fromIndex, toIndex) => {
    if (!currentPaper) return;
    const updatedSecs = JSON.parse(JSON.stringify(currentPaper?.sections_data_json || currentPaper?.sections || []));
    const sec = updatedSecs.find((s) => s.id === sectionId);
    if (!sec || !sec.questions) return;

    if (toIndex < 0 || toIndex >= sec.questions.length) return;

    const [movedQ] = sec.questions.splice(fromIndex, 1);
    sec.questions.splice(toIndex, 0, movedQ);

    try {
      const res = await api.updateGeneratedPaper(currentPaper.id, {
        sections_data_json: updatedSecs
      });
      setCurrentPaper(res?.paper || res);
      runValidation(res.paper.id);
    } catch (err) {
      toast.error("Failed to reorder question.");
    }
  };

  const handleToggleLock = async (sectionId, qIndex) => {
    if (!currentPaper) return;
    const updatedSecs = JSON.parse(JSON.stringify(currentPaper?.sections_data_json || currentPaper?.sections || []));
    const sec = updatedSecs.find((s) => s.id === sectionId);
    if (!sec || !sec.questions || !sec.questions[qIndex]) return;

    const q = sec.questions[qIndex];
    q.is_locked = !q.is_locked;

    try {
      const res = await api.updateGeneratedPaper(currentPaper.id, {
        sections_data_json: updatedSecs
      });
      setCurrentPaper(res?.paper || res);
      toast.success(q.is_locked ? "Question locked in position." : "Question unlocked.");
    } catch (err) {
      toast.error("Failed to update question lock.");
    }
  };

  const handleStartEdit = (q) => {
    setEditingQuestionId(q.id);
    setEditFormData({
      text: q.content?.text || "",
      options: q.content?.options ? [...q.content.options] : [],
      correct_answer: q.correct_answer || (q.content?.correct_options ? q.content.correct_options[0] : ""),
      correct_options: q.content?.correct_options || [],
      numerical_value: q.numerical_value || "",
      explanation: q.content?.explanation || ""
    });
  };

  const handleSaveEdit = async (sectionId, qIndex) => {
    if (!currentPaper) return;
    const updatedSecs = JSON.parse(JSON.stringify(currentPaper?.sections_data_json || currentPaper?.sections || []));
    const sec = updatedSecs.find((s) => s.id === sectionId);
    if (!sec || !sec.questions || !sec.questions[qIndex]) return;

    const q = sec.questions[qIndex];
    q.content = {
      ...q.content,
      text: editFormData.text,
      options: editFormData.options,
      correct_options: editFormData.correct_options,
      explanation: editFormData.explanation
    };
    q.correct_answer = editFormData.correct_answer;
    if (editFormData.numerical_value !== undefined) {
      q.numerical_value = editFormData.numerical_value;
    }

    try {
      const res = await api.updateGeneratedPaper(currentPaper.id, {
        sections_data_json: updatedSecs
      });
      setCurrentPaper(res?.paper || res);
      setEditingQuestionId(null);
      toast.success("Question edits saved.");
      runValidation(res.paper.id);
    } catch (err) {
      toast.error("Failed to save edits.");
    }
  };

  const handleReplaceWithAi = async (sectionId, qIndex) => {
    if (!currentPaper) return;
    try {
      toast.info("Generating replacement question using syllabus context...");
      const res = await api.replacePaperQuestion(
        currentPaper.id,
        sectionId,
        qIndex,
        "ai"
      );
      setCurrentPaper(res?.paper || res);
      toast.success("Question replaced with fresh AI question!");
      runValidation(res.paper.id);
    } catch (err) {
      toast.error(err.message || "Failed to replace question with AI.");
    }
  };

  const openBankPicker = async (sectionId, qIndex, subject) => {
    setBankPickerTarget({ sectionId, qIndex, subject });
    setBankPickerOpen(true);
    setBankLoading(true);
    try {
      const res = await api.getQuestionsFiltered({
        organization_id: organizationId,
        subject: subject || undefined
      });
      setBankQuestions(res.questions || []);
    } catch (err) {
      toast.error("Failed to load Question Bank items.");
      setBankQuestions([]);
    } finally {
      setBankLoading(false);
    }
  };

  const handleSelectBankQuestion = async (bankQ) => {
    if (!currentPaper || !bankPickerTarget) return;
    const { sectionId, qIndex } = bankPickerTarget;
    try {
      const res = await api.replacePaperQuestion(
        currentPaper.id,
        sectionId,
        qIndex,
        "bank",
        bankQ.id
      );
      setCurrentPaper(res?.paper || res);
      setBankPickerOpen(false);
      setBankPickerTarget(null);
      toast.success("Question replaced with selected Question Bank question!");
      runValidation(res.paper.id);
    } catch (err) {
      toast.error(err.message || "Failed to replace question from Question Bank.");
    }
  };

  const handleGenerateSets = async () => {
    if (!currentPaper) return;
    setGeneratingSets(true);
    try {
      const res = await api.generatePaperSets(currentPaper.id, setCountToGenerate, true);
      setCurrentPaper(res?.paper || res);
      setSetsModalOpen(false);
      toast.success(`Generated ${Object.keys(res.sets || {}).length} unique sets (Set A, Set B...) with randomized answer keys!`);
    } catch (err) {
      toast.error(err.message || "Failed to generate sets.");
    } finally {
      setGeneratingSets(false);
    }
  };

  const handleSaveAiQuestionsToBank = async () => {
    if (!currentPaper) return;
    setSavingQuestions(true);
    try {
      const res = await api.saveAiQuestionsToBank(currentPaper.id);
      toast.success(
        res.saved_count > 0
          ? `Successfully saved ${res.saved_count} AI questions to the Question Bank with full provenance!`
          : "All AI questions in this paper are already registered in the Question Bank."
      );
    } catch (err) {
      toast.error(err.message || "Failed to save questions to bank.");
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleDownloadPdf = async (docType = "student") => {
    if (!currentPaper) return;
    setDownloadingPdf(true);
    try {
      await api.downloadPaperPdf(
        currentPaper.id,
        docType,
        activeSetKey === "master" ? "SET A" : activeSetKey,
        currentPaper.title || "Question Paper"
      );
      toast.success(
        docType === "student"
          ? "Student Question Paper PDF downloaded!"
          : "Teacher Marking Scheme & Answer Key PDF downloaded!"
      );
    } catch (err) {
      toast.error(err.message || "Failed to download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePublishToExam = async () => {
    if (!currentPaper) return;
    if (validationReport && !validationReport.valid) {
      toast.error("Please resolve blueprint validation warnings before publishing to online assessment.");
      return;
    }

    setPublishing(true);
    try {
      const res = await api.publishPaperToExam(currentPaper.id);
      toast.success("Successfully published to Lunaris Online Assessment Engine!");
      // Reload paper to update status
      const updated = await api.getGeneratedPaper(currentPaper.id);
      setCurrentPaper(updated?.paper || updated);
      loadPapers();
    } catch (err) {
      toast.error(err.message || "Failed to publish paper to online exam.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePaper = async () => {
    if (!deleteConfirmPaper) return;
    setDeletingPaper(true);
    try {
      await api.deleteGeneratedPaper(deleteConfirmPaper.id);
      toast.success("Question paper deleted.");
      setDeleteConfirmPaper(null);
      if (currentPaper?.id === deleteConfirmPaper.id) {
        setCurrentPaper(null);
        setActiveTab("papers");
      }
      await loadPapers();
    } catch (err) {
      toast.error(err.message || "Failed to delete paper.");
    } finally {
      setDeletingPaper(false);
    }
  };

  // Get current active questions based on activeSetKey and activeSectionId
  const getActiveSectionQuestions = () => {
    if (!currentPaper) return [];
    if (activeSetKey !== "master") {
      const setsObj = currentPaper.sets_data_json?.sets || currentPaper.sets_data_json || {};
      const setInfo = setsObj[activeSetKey];
      const setSecs = setInfo?.sections || (Array.isArray(setInfo) ? setInfo : []);
      const found = setSecs.find((s) => s.id === activeSectionId);
      return found?.questions || [];
    }
    const secs = Array.isArray(currentPaper.sections_data_json) ? currentPaper.sections_data_json : [];
    const found = secs.find((s) => s.id === activeSectionId);
    return found?.questions || [];
  };

  const activeQuestions = getActiveSectionQuestions();
  const activeSection = (currentPaper?.sections_data_json || []).find((s) => s.id === activeSectionId);

  // Calculate difficulty distribution of current paper
  const calculateDifficultyStats = () => {
    if (!currentPaper) return { easy: 0, medium: 0, hard: 0, total: 0 };
    let easy = 0, med = 0, hard = 0, total = 0;
    (currentPaper?.sections_data_json || currentPaper?.sections || []).forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        total++;
        const d = (q.difficulty || "medium").toLowerCase();
        if (d === "easy") easy++;
        else if (d === "hard") hard++;
        else med++;
      });
    });
    return {
      easy: total ? Math.round((easy / total) * 100) : 0,
      medium: total ? Math.round((med / total) * 100) : 0,
      hard: total ? Math.round((hard / total) * 100) : 0,
      total
    };
  };

  const diffStats = calculateDifficultyStats();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Studio Header & Navigation Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "#ffffff",
          padding: "16px 20px",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--accent-blue-subtle)",
              color: "var(--accent-blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <SparklesIcon size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "var(--text-primary)" }}>
              Question Paper Studio
            </h2>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Intelligent hybrid paper generation, review workbench, multiple randomized sets, and print-ready PDF export.
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "8px",
            fontSize: "13px"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("papers")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "papers" ? "#ffffff" : "transparent",
              color: activeTab === "papers" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === "papers" ? "700" : "500",
              cursor: "pointer",
              boxShadow: activeTab === "papers" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
            }}
          >
            All Papers ({papers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("create")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "create" ? "#ffffff" : "transparent",
              color: activeTab === "create" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === "create" ? "700" : "500",
              cursor: "pointer",
              boxShadow: activeTab === "create" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
            }}
          >
            + Create / Generate
          </button>

          {currentPaper && (
            <button
              type="button"
              onClick={() => setActiveTab("workbench")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "workbench" ? "#ffffff" : "transparent",
                color: activeTab === "workbench" ? "var(--accent-blue)" : "var(--text-secondary)",
                fontWeight: activeTab === "workbench" ? "700" : "500",
                cursor: "pointer",
                boxShadow: activeTab === "workbench" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <FileTextIcon size={13} /> Review Studio
            </button>
          )}
        </div>
      </div>

      {/* ---
          TAB 1: ALL GENERATED PAPERS LIST
      --- */}
      {activeTab === "papers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#ffffff",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)"
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
                Filter Status:
              </span>
              <select
                value={paperFilterStatus}
                onChange={(e) => setPaperFilterStatus(e.target.value)}
                style={{
                  padding: "6px 12px",
                  fontSize: "13px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                  background: "#ffffff"
                }}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="validated">Validated</option>
                <option value="published">Published Online</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadPapers}
                title="Refresh"
                style={{ padding: "6px 10px" }}
              >
                <RefreshIcon size={14} />
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab("create")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
              >
                <PlusIcon size={14} /> Synthesize New Paper
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {loadingPapers ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
              <RefreshIcon size={24} style={{ animation: "spin 1s linear infinite", marginBottom: "8px" }} />
              <div>Loading papers...</div>
            </div>
          ) : papers.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px dashed var(--border-subtle)",
                padding: "48px 24px",
                textAlign: "center"
              }}
            >
              <FileTextIcon size={32} color="var(--accent-blue)" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700" }}>
                No Generated Papers Yet
              </h3>
              <p style={{ margin: "0 auto 20px", fontSize: "13px", color: "var(--text-secondary)", maxWidth: "440px" }}>
                Select a blueprint template and synthesize balanced question papers using questions from your bank and curriculum-aligned AI.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab("create")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <PlusIcon size={14} /> Generate First Paper
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "18px"
              }}
            >
              {papers
                .filter((p) => paperFilterStatus === "all" || p.status === paperFilterStatus)
                .map((p) => {
                  const secs = p.sections_data_json || [];
                  const sets = p.sets_data_json ? Object.keys(p.sets_data_json) : [];
                  const isPublished = p.status === "published";

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "#ffffff",
                        borderRadius: "12px",
                        border: isPublished ? "1.5px solid #10b981" : "1px solid var(--border-subtle)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                textTransform: "uppercase",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: isPublished ? "#ecfdf5" : "#f1f5f9",
                                color: isPublished ? "#059669" : "#64748b",
                                border: `1px solid ${isPublished ? "#a7f3d0" : "#e2e8f0"}`
                              }}
                            >
                              {p.status}
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "var(--accent-blue-subtle)",
                                color: "var(--accent-blue)"
                              }}
                            >
                              {p.exam_type?.toUpperCase().replace("_", " ")}
                            </span>
                            {sets.length > 0 && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309"
                                }}
                              >
                                {sets.length} Sets
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPaper(p)}
                            title="Delete Paper"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>

                        <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                          {p.title}
                        </h3>

                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                          Created on {new Date(p.created_at).toLocaleDateString()}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            padding: "8px 10px",
                            background: "#f8fafc",
                            borderRadius: "6px",
                            fontSize: "12px",
                            marginBottom: "14px"
                          }}
                        >
                          <div><strong>{p.total_questions || 0}</strong> Questions</div>
                          <div style={{ color: "var(--text-muted)" }}>|</div>
                          <div><strong>{p.total_marks || 0}</strong> Marks</div>
                          <div style={{ color: "var(--text-muted)" }}>|</div>
                          <div><strong>{secs.length}</strong> Sections</div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border-subtle)"
                        }}
                      >
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            api.downloadPaperPdf(p.id, "student", "SET A", p.title);
                            toast.success("Downloading Student Paper PDF...");
                          }}
                          style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <DownloadIcon size={12} /> PDF
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => openWorkbench(p.id)}
                          style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        >
                          <FileTextIcon size={12} /> Open in Studio
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ---
          TAB 2: CREATE / GENERATE NEW PAPER (HYBRID AI + QUESTION BANK)
      --- */}
      {activeTab === "create" && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            padding: "24px",
            maxWidth: "760px",
            margin: "0 auto",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <SparklesIcon size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                Synthesize Question Paper
              </h3>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Select a blueprint template and configure the Question Bank to AI generation blend ratio.
              </div>
            </div>
          </div>

          <form onSubmit={handleGeneratePaper} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Template Selection */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                  Question Paper Template <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {onNavigateToTemplates && (
                  <button
                    type="button"
                    onClick={onNavigateToTemplates}
                    style={{ background: "none", border: "none", fontSize: "12px", color: "var(--accent-blue)", cursor: "pointer" }}
                  >
                    Manage Templates -&gt;
                  </button>
                )}
              </div>

              {templates.length === 0 ? (
                <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--border-subtle)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  No examination templates found. Please create a template first.
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedTemplateId(id);
                    const tmpl = templates.find((t) => t.id === id);
                    if (tmpl) {
                      setCustomTitle(`${tmpl.title} - Examination Paper`);
                      setCustomInstructions(tmpl.instructions || "");
                    }
                  }}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    outline: "none",
                    background: "#ffffff"
                  }}
                >
                  <option value="">-- Choose Blueprint Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.exam_type?.toUpperCase()} | {t.total_questions} Qs | {t.total_marks} Marks)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Custom Paper Title */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                Examination Paper Title
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. JEE Main 2026 Mock Test Series - Paper 1"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  outline: "none"
                }}
              />
            </div>

            {/* Intelligent Hybrid Ratio Slider */}
            <div
              style={{
                background: "#f8fafc",
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                  Question Bank vs. AI Synthesis Ratio
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--accent-blue)"
                  }}
                >
                  {bankRatio}% Bank / {100 - bankRatio}% AI
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={bankRatio}
                onChange={(e) => setBankRatio(Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "var(--accent-blue)" }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  marginTop: "6px"
                }}
              >
                <span>0% (100% Fresh AI)</span>
                <span>50% Balanced Blend</span>
                <span>100% (Strictly Bank Questions)</span>
              </div>

              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.4" }}>
                <strong>Note:</strong> Any questions pre-assigned or locked in the template blueprint are guaranteed to be included regardless of the ratio slider.
              </div>
            </div>

            {/* Custom Instructions */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                Candidate Instructions & Examination Rules
              </label>
              <textarea
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  outline: "none",
                  fontFamily: "inherit"
                }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab("papers")}
                disabled={generating}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={generating || !selectedTemplateId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 20px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                {generating ? (
                  <>
                    <RefreshIcon size={14} style={{ animation: "spin 1s linear infinite" }} /> Synthesizing Paper...
                  </>
                ) : (
                  <>
                    <SparklesIcon size={14} /> Generate Examination Paper
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---
          TAB 3: PAPER REVIEW & STUDIO WORKBENCH
      --- */}
      {activeTab === "workbench" && currentPaper && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Top Workbench Summary & Control Bar */}
          <div
            style={{
              background: "#ffffff",
              padding: "20px 24px",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: currentPaper.status === "published" ? "#ecfdf5" : "#f1f5f9",
                    color: currentPaper.status === "published" ? "#059669" : "#64748b",
                    border: `1px solid ${currentPaper.status === "published" ? "#a7f3d0" : "#e2e8f0"}`
                  }}
                >
                  {currentPaper.status}
                </span>

                {validationReport && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      background: validationReport.valid ? "#ecfdf5" : "#fffbeb",
                      color: validationReport.valid ? "#059669" : "#d97706",
                      border: `1px solid ${validationReport.valid ? "#a7f3d0" : "#fde68a"}`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {validationReport.valid ? <VerifiedIcon size={12} /> : <AlertTriangleIcon size={12} />}
                    {validationReport.valid ? "Blueprint Validated" : "Validation Warnings"}
                  </span>
                )}
              </div>

              <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>
                {currentPaper.title}
              </h2>

              <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>
                <span><strong>{currentPaper.total_questions}</strong> Questions</span>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <span><strong>{currentPaper.total_marks}</strong> Marks</span>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <span><strong>{currentPaper.duration_minutes || 180}</strong> Mins</span>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <span>Difficulty: Easy {diffStats.easy}% / Med {diffStats.medium}% / Hard {diffStats.hard}%</span>
              </div>
            </div>

            {/* Actions Cluster */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Set Switcher & Generator */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)" }}>SET:</span>
                <select
                  value={activeSetKey}
                  onChange={(e) => setActiveSetKey(e.target.value)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  <option value="master">Master Layout</option>
                  {(() => {
                    const setsObj = currentPaper.sets_data_json?.sets || currentPaper.sets_data_json || {};
                    return Object.keys(setsObj)
                      .filter((k) => k !== "active_set")
                      .map((sKey) => (
                        <option key={sKey} value={sKey}>
                          {sKey}
                        </option>
                      ));
                  })()}
                </select>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSetsModalOpen(true)}
                  title="Generate Shuffled Sets (Set A, B, C)"
                  style={{ fontSize: "11px", padding: "3px 7px" }}
                >
                  Generate Sets
                </button>
              </div>

              {/* PDF Downloads */}
              <button
                type="button"
                className="btn-secondary"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf("student")}
                style={{ fontSize: "12px", padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <DownloadIcon size={13} /> Student PDF
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf("teacher")}
                style={{ fontSize: "12px", padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <DownloadIcon size={13} /> Answer Key PDF
              </button>

              {/* Save AI Qs to Bank */}
              <button
                type="button"
                className="btn-secondary"
                disabled={savingQuestions}
                onClick={handleSaveAiQuestionsToBank}
                title="Save all approved AI questions to the Question Bank"
                style={{ fontSize: "12px", padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <PlusIcon size={13} /> Export to Bank
              </button>

              {/* One-Click Publish to Exam */}
              <button
                type="button"
                className="btn-primary"
                disabled={publishing}
                onClick={handlePublishToExam}
                style={{
                  fontSize: "12px",
                  padding: "7px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: currentPaper.status === "published" ? "#10b981" : "var(--accent-blue)"
                }}
              >
                <ShieldIcon size={13} />
                {currentPaper.status === "published" ? "Live in Exam Engine" : "Publish to Online Engine"}
              </button>
            </div>
          </div>

          {/* Validation Warnings Alert (if any) */}
          {validationReport && !validationReport.valid && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px"
              }}
            >
              <AlertTriangleIcon size={18} color="#d97706" style={{ marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400e" }}>
                  Blueprint Validation Discrepancies
                </div>
                <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                  {validationReport.errors?.join(" | ") || "Paper does not perfectly match template rules."}
                </div>
              </div>
            </div>
          )}

          {/* Section Navigation Tabs */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid var(--border-subtle)",
              paddingBottom: "8px",
              overflowX: "auto"
            }}
          >
            {(currentPaper?.sections_data_json || currentPaper?.sections || []).map((sec, idx) => {
              const isActive = sec.id === activeSectionId;
              const qCount = sec.questions?.length || 0;
              const req = sec.required_questions || 0;

              return (
                <button
                  key={sec.id || idx}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: isActive ? "var(--accent-blue-subtle)" : "#ffffff",
                    color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                    fontWeight: isActive ? "700" : "500",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap"
                  }}
                >
                  <span>{sec.name}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "1px 6px",
                      borderRadius: "999px",
                      background: isActive ? "var(--accent-blue)" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "var(--text-secondary)"
                    }}
                  >
                    {qCount}/{req} Qs
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section Info Header */}
          {activeSection && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "#f8fafc",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-secondary)"
              }}
            >
              <div>
                <strong>{activeSection.name}</strong> | Subject: {activeSection.subject || "General"} | Marks/Q: +{activeSection.marks_per_question} | Negative: -{activeSection.negative_marks || 0}
              </div>
              <div>
                Ordering: {activeSetKey !== "master" ? `Viewing ${activeSetKey} sequence` : "Master blueprint sequence"}
              </div>
            </div>
          )}

          {/* Question Review Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeQuestions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                No questions assigned to this section.
              </div>
            ) : (
              activeQuestions.map((q, qIndex) => {
                const isEditing = editingQuestionId === q.id;
                const isLocked = Boolean(q.is_locked);
                const isAi = q.source === "ai" || q.source === "curriculum_synthesis";

                return (
                  <div
                    key={q.id || qIndex}
                    style={{
                      background: "#ffffff",
                      borderRadius: "10px",
                      border: isLocked ? "1.5px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      padding: "18px 20px"
                    }}
                  >
                    {/* Question Header Row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                        gap: "8px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "800",
                            color: "var(--text-primary)",
                            background: "#f1f5f9",
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}
                        >
                          Q{qIndex + 1}
                        </span>

                        {/* Origin Pill */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: isAi ? "#f5f3ff" : "#eff6ff",
                            color: isAi ? "#7c3aed" : "#2563eb",
                            border: `1px solid ${isAi ? "#ddd6fe" : "#bfdbfe"}`
                          }}
                        >
                          {isAi ? "AI Generated" : "Question Bank"}
                        </span>

                        {/* Type Pill */}
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#f8fafc",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-secondary)"
                          }}
                        >
                          {q.question_type?.toUpperCase().replace("_", " ")}
                        </span>

                        {/* Difficulty */}
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              q.difficulty === "easy"
                                ? "#ecfdf5"
                                : q.difficulty === "hard"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              q.difficulty === "easy"
                                ? "#059669"
                                : q.difficulty === "hard"
                                ? "#dc2626"
                                : "#b45309"
                          }}
                        >
                          {q.difficulty?.toUpperCase()}
                        </span>

                        {/* Marks */}
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          +{q.marks || 4} / -{q.negative_marks || 0}
                        </span>
                      </div>

                      {/* Controls: Reorder, Lock, Replace, Edit */}
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {activeSetKey === "master" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(activeSectionId, qIndex, qIndex - 1)}
                              disabled={qIndex === 0}
                              title="Move Up"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: qIndex === 0 ? "not-allowed" : "pointer",
                                opacity: qIndex === 0 ? 0.3 : 1,
                                padding: "4px"
                              }}
                            >
                              <ArrowUpIcon size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(activeSectionId, qIndex, qIndex + 1)}
                              disabled={qIndex === activeQuestions.length - 1}
                              title="Move Down"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: qIndex === activeQuestions.length - 1 ? "not-allowed" : "pointer",
                                opacity: qIndex === activeQuestions.length - 1 ? 0.3 : 1,
                                padding: "4px"
                              }}
                            >
                              <ArrowDownIcon size={14} />
                            </button>
                          </>
                        )}

                        {/* Lock Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleLock(activeSectionId, qIndex)}
                          title={isLocked ? "Unlock question" : "Lock question in place"}
                          style={{
                            background: isLocked ? "var(--accent-blue-subtle)" : "none",
                            border: "none",
                            cursor: "pointer",
                            color: isLocked ? "var(--accent-blue)" : "var(--text-secondary)",
                            padding: "4px 6px",
                            borderRadius: "4px"
                          }}
                        >
                          {isLocked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
                        </button>

                        {/* Replace Dropdown / Actions */}
                        {activeSetKey === "master" && !isEditing && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleReplaceWithAi(activeSectionId, qIndex)}
                              style={{ fontSize: "11px", padding: "4px 8px" }}
                            >
                              Replace (AI)
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openBankPicker(activeSectionId, qIndex, activeSection?.subject)}
                              style={{ fontSize: "11px", padding: "4px 8px" }}
                            >
                              Replace (Bank)
                            </button>
                          </div>
                        )}

                        {/* Edit Toggle */}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => (isEditing ? setEditingQuestionId(null) : handleStartEdit(q))}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                      </div>
                    </div>

                    {/* Question Content / In-Place Editor */}
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                            Question Statement:
                          </label>
                          <textarea
                            rows={3}
                            value={editFormData.text}
                            onChange={(e) => setEditFormData({ ...editFormData, text: e.target.value })}
                            style={{ width: "100%", padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>

                        {/* Options Editor if MCQ */}
                        {editFormData.options && editFormData.options.length > 0 && (
                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                              Options & Correct Choice:
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {editFormData.options.map((opt, oIdx) => {
                                const isCorrect = editFormData.correct_answer === opt.id || (editFormData.correct_options || []).includes(opt.id);
                                return (
                                  <div key={opt.id || oIdx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <input
                                      type="radio"
                                      name={`correct_${q.id}`}
                                      checked={editFormData.correct_answer === opt.id}
                                      onChange={() => setEditFormData({ ...editFormData, correct_answer: opt.id })}
                                    />
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => {
                                        const newOpts = [...editFormData.options];
                                        newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                                        setEditFormData({ ...editFormData, options: newOpts });
                                      }}
                                      style={{ flex: 1, padding: "6px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                            Explanation & Solution Walkthrough:
                          </label>
                          <textarea
                            rows={2}
                            value={editFormData.explanation}
                            onChange={(e) => setEditFormData({ ...editFormData, explanation: e.target.value })}
                            style={{ width: "100%", padding: "8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingQuestionId(null)}
                            style={{ fontSize: "12px" }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleSaveEdit(activeSectionId, qIndex)}
                            style={{ fontSize: "12px" }}
                          >
                            Save Question
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Statement */}
                        <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: "1.5", marginBottom: "12px", whiteSpace: "pre-wrap" }}>
                          {q.content?.text || "Question statement..."}
                        </div>

                        {/* Options */}
                        {q.content?.options && q.content.options.length > 0 && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                              gap: "8px",
                              marginBottom: "12px"
                            }}
                          >
                            {q.content.options.map((opt, oIdx) => {
                              const isCorrect =
                                q.correct_answer === opt.id ||
                                (q.content?.correct_options || []).includes(opt.id);

                              return (
                                <div
                                  key={opt.id || oIdx}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: isCorrect ? "1.5px solid #10b981" : "1px solid var(--border-subtle)",
                                    background: isCorrect ? "#ecfdf5" : "#ffffff",
                                    fontSize: "12px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px"
                                  }}
                                >
                                  <span style={{ fontWeight: "700", color: isCorrect ? "#059669" : "var(--text-secondary)" }}>
                                    {String.fromCharCode(65 + oIdx)}.
                                  </span>
                                  <span style={{ flex: 1, color: isCorrect ? "#065f46" : "var(--text-primary)" }}>
                                    {opt.text}
                                  </span>
                                  {isCorrect && <CheckIcon size={14} color="#059669" />}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Numerical / Value Key */}
                        {q.question_type === "numerical" && (
                          <div style={{ fontSize: "12px", marginBottom: "10px", color: "#065f46", background: "#ecfdf5", padding: "6px 10px", borderRadius: "6px" }}>
                            <strong>Numerical Key:</strong> {q.numerical_value || q.correct_answer || "N/A"}
                          </div>
                        )}

                        {/* Explanation Box */}
                        {q.content?.explanation && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              background: "#f8fafc",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              borderLeft: "3px solid var(--accent-blue)"
                            }}
                          >
                            <strong>Explanation:</strong> {q.content.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ---
          MODAL: GENERATE MULTIPLE RANDOMIZED SETS
      --- */}
      {setsModalOpen && (
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
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700" }}>
              Generate Randomized Question Sets
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Shuffle question order and MCQ option choices across distinct series (Set A, Set B, Set C). Locked questions remain in place, and answer keys are automatically synced.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Number of Sets to Generate:
              </label>
              <select
                value={setCountToGenerate}
                onChange={(e) => setSetCountToGenerate(Number(e.target.value))}
                style={{ width: "100%", padding: "8px 12px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
              >
                <option value={2}>2 Sets (Set A, Set B)</option>
                <option value={3}>3 Sets (Set A, Set B, Set C)</option>
                <option value={4}>4 Sets (Set A, Set B, Set C, Set D)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={generatingSets}
                onClick={() => setSetsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={generatingSets}
                onClick={handleGenerateSets}
              >
                {generatingSets ? "Shuffling & Permuting..." : "Generate Sets"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---
          MODAL: PICK REPLACEMENT QUESTION FROM QUESTION BANK
      --- */}
      {bankPickerOpen && (
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
              maxWidth: "680px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "85vh",
              overflow: "hidden"
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
                  Select Replacement from Question Bank
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Showing bank questions for subject: {bankPickerTarget?.subject || "All Subjects"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBankPickerOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              <input
                type="text"
                placeholder="Search bank questions by text or topic..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                style={{ width: "100%", padding: "7px 12px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
              />
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              {bankLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                  Loading bank questions...
                </div>
              ) : bankQuestions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                  No matching questions found in Question Bank for this subject.
                </div>
              ) : (
                bankQuestions
                  .filter((q) => !bankSearch || q.content?.text?.toLowerCase().includes(bankSearch.toLowerCase()))
                  .map((q) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: "#f1f5f9" }}>
                            {q.subject} | {q.question_type} | {q.difficulty || "medium"}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.4" }}>
                          {q.content?.text}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleSelectBankQuestion(q)}
                        style={{ fontSize: "12px", padding: "6px 12px", whiteSpace: "nowrap" }}
                      >
                        Use This Question
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBankPickerOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---
          MODAL: DELETE PAPER CONFIRMATION
      --- */}
      {deleteConfirmPaper && (
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
              Delete Question Paper?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Are you sure you want to delete <strong>"{deleteConfirmPaper.title}"</strong>? This will permanently remove all sections, generated sets, and keys for this paper.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={deletingPaper}
                onClick={() => setDeleteConfirmPaper(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePaper}
                disabled={deletingPaper}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: deletingPaper ? "not-allowed" : "pointer"
                }}
              >
                {deletingPaper ? "Deleting..." : "Delete Paper"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

