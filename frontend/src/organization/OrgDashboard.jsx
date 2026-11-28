import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon, GraduationCapIcon,
  BookIcon, MenuIcon, LayersIcon
} from "../shared/Icons";
import TemplateManager from "./TemplateManager";
import QuestionPaperStudio from "./QuestionPaperStudio";
import CreateQuestionModal from "./CreateQuestionModal";
import ExamAnalyticsModal from "./ExamAnalyticsModal";
import AiQuestionStudio from "./AiQuestionStudio";
import PlansBillingView from "./PlansBillingView";
import ExamCreationWizard from "./ExamCreationWizard";
import AdSlot from "../shared/AdSlot";
import EnrollmentManagerModal from "./EnrollmentManagerModal";
import LiveProctorDashboard from "../proctor-console/LiveProctorDashboard";
import CandidateCapacityModal from "./CandidateCapacityModal";
import { toast } from "../shared/toast";

// ── helpers ──────────────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function avatarColor(name = "") {
  const palette = [
    "linear-gradient(135deg,#2563eb,#7c3aed)",
    "linear-gradient(135deg,#059669,#0891b2)",
    "linear-gradient(135deg,#d97706,#e11d48)",
    "linear-gradient(135deg,#7c3aed,#e11d48)",
    "linear-gradient(135deg,#0891b2,#2563eb)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
  return palette[h];
}

function subjectColor(subject = "") {
  const map = {
    physics: { border: "#2563eb", bg: "#eff6ff", text: "#2563eb" },
    chemistry: { border: "#7c3aed", bg: "#f5f3ff", text: "#7c3aed" },
    mathematics: { border: "#059669", bg: "#ecfdf5", text: "#059669" },
    math: { border: "#059669", bg: "#ecfdf5", text: "#059669" },
    biology: { border: "#d97706", bg: "#fffbeb", text: "#d97706" },
  };
  return map[subject.toLowerCase()] || { border: "#64748b", bg: "#f8fafc", text: "#334155" };
}

// ── component ─────────────────────────────────────────────────────────────────
export default function OrgDashboard({
  onTakeExam,
  onTakeQuickQuiz,
  currentUser,
  currentOrg,
  onLogout,
  onExitToPublic,
  onOpenProctorConsole
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "exams");
  const [selectedTemplateForStudio, setSelectedTemplateForStudio] = useState(null); // 'exams', 'questions', 'ai_studio', 'members', 'billing'
  const [loading, setLoading] = useState(false);

  // Derive active organization ID and meta with multi-academy switching
  const [selectedOrg, setSelectedOrg] = useState(() => currentOrg || { id: "", name: "" });
  const activeOrgId = selectedOrg?.id || selectedOrg?.slug || currentOrg?.id || currentOrg?.slug || "";
  const orgName = selectedOrg?.name || currentOrg?.name || (activeOrgId ? "Academy Workspace" : "Select or Create Academy");
  const currentPlan = selectedOrg?.plan_id || currentOrg?.plan_id || "free";

  // Multi-Academy Creation & Management
  const [showCreateAcademyModal, setShowCreateAcademyModal] = useState(false);
  const [newAcademyName, setNewAcademyName] = useState("");
  const [creatingAcademy, setCreatingAcademy] = useState(false);

  // Join Existing Academy Workspace
  const [showJoinOrgModal, setShowJoinOrgModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joiningOrg, setJoiningOrg] = useState(false);

  // Rename Academy Workspace
  const [showRenameOrgModal, setShowRenameOrgModal] = useState(false);
  const [editOrgName, setEditOrgName] = useState("");
  const [renamingOrg, setRenamingOrg] = useState(false);

  function handleOpenRenameModal() {
    setEditOrgName(selectedOrg?.name || orgName || "");
    setShowRenameOrgModal(true);
  }

  async function handleUpdateOrgName(e) {
    if (e) e.preventDefault();
    const cleanName = editOrgName.trim();
    if (!cleanName) {
      toast.warning("Please enter a valid academy name.");
      return;
    }
    setRenamingOrg(true);
    try {
      await api.updateOrganization(activeOrgId, cleanName);
      setSelectedOrg((prev) => ({ ...prev, name: cleanName }));
      setMyOrgs((prev) => prev.map((o) => (o.id === activeOrgId || o.slug === activeOrgId ? { ...o, name: cleanName } : o)));
      const saved = localStorage.getItem("lunaris_user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.organization_id === activeOrgId || u.organization_slug === activeOrgId) {
          u.organization_name = cleanName;
          localStorage.setItem("lunaris_user", JSON.stringify(u));
        }
      }
      setShowRenameOrgModal(false);
      toast.success(`Academy successfully renamed to "${cleanName}"!`, { title: "Academy Renamed" });
      await loadAllData();
    } catch (err) {
      toast.error("Failed to rename academy: " + err.message);
    } finally {
      setRenamingOrg(false);
    }
  }

  function handleSwitchOrg(newOrg) {
    if (!newOrg) return;
    setSelectedOrg(newOrg);
    const saved = localStorage.getItem("lunaris_user");
    if (saved) {
      const u = JSON.parse(saved);
      u.organization_id = newOrg.id;
      u.organization_slug = newOrg.slug;
      u.organization_name = newOrg.name;
      u.plan_id = newOrg.plan_id || "free";
      localStorage.setItem("lunaris_user", JSON.stringify(u));
    }
    setSelectedSubject("");
  }

  async function handleCreateAcademy(e) {
    if (e) e.preventDefault();
    if (!newAcademyName.trim()) {
      toast.warning("Please enter a name for your academy.");
      return;
    }
    setCreatingAcademy(true);
    try {
      const res = await api.createOrganization(newAcademyName.trim());
      const updatedList = await api.getMyOrganizations().catch(() => []);
      setMyOrgs(updatedList || []);
      handleSwitchOrg(res);
      setShowCreateAcademyModal(false);
      setNewAcademyName("");
      toast.success(`Academy "${res.name}" created successfully! You are now managing this academy.`);
    } catch (err) {
      toast.error("Failed to create academy: " + err.message);
    } finally {
      setCreatingAcademy(false);
    }
  }

  async function handleJoinAcademy(e) {
    if (e) e.preventDefault();
    const cleanCode = joinInviteCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.warning("Please enter an academy invite code (e.g. ORG-CODE).");
      return;
    }
    setJoiningOrg(true);
    try {
      const res = await api.joinOrganization(cleanCode);
      const updatedList = await api.getMyOrganizations().catch(() => []);
      setMyOrgs(updatedList || []);
      handleSwitchOrg(res);
      setShowJoinOrgModal(false);
      setJoinInviteCode("");
      toast.success(`Successfully joined "${res.name || res.organization_name}"!`, { title: "Academy Joined" });
      await loadAllData();
    } catch (err) {
      toast.error("Failed to join academy: " + err.message);
    } finally {
      setJoiningOrg(false);
    }
  }

  // Detect ?join=ORG-CODE in dashboard URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinParam = params.get("join");
      if (joinParam && joinParam.trim()) {
        const clean = joinParam.trim().toUpperCase();
        setJoinInviteCode(clean);
        setShowJoinOrgModal(true);
      }
    } catch (e) {
      console.warn("URL join check notice:", e);
    }
  }, []);

  // Data states
  const [orgServices, setOrgServices] = useState({
    ai_studio: true,
    live_proctoring: true,
    proctor_console: true,
    quick_quiz: true,
    bulk_enrollment: true,
    pdf_import: true,
    detailed_analytics: true,
    advanced_scoring: true
  });
  const [orgProperties, setOrgProperties] = useState({});
  const [myOrgs, setMyOrgs] = useState([]);
  const [orgUsage, setOrgUsage] = useState(null);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [orgSubjects, setOrgSubjects] = useState([]);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState("");
  const [newSubjCategory, setNewSubjCategory] = useState("General");
  const [newSubjCode, setNewSubjCode] = useState("");
  const [isSeedingPack, setIsSeedingPack] = useState(false);
  const [inviteCode, setInviteCode] = useState(activeOrgId ? `ORG-${activeOrgId.toUpperCase().replace(/[^A-Z0-9]/g, "-")}` : "");

  // Sidebar Collapsible & Responsive State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Google Classroom Integration State
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [classroomActiveTab, setClassroomActiveTab] = useState("upload_anything"); // "upload_anything", "publish_exam", "roster_sync"
  const [classroomUploadType, setClassroomUploadType] = useState("assignment"); // "assignment", "announcement", "material"
  const [classroomUploadTitle, setClassroomUploadTitle] = useState("");
  const [classroomUploadDesc, setClassroomUploadDesc] = useState("");
  const [classroomUploadLink, setClassroomUploadLink] = useState("");
  const [classroomUploadExamId, setClassroomUploadExamId] = useState("");
  const [classroomUploadFileBase64, setClassroomUploadFileBase64] = useState("");
  const [classroomUploadFileName, setClassroomUploadFileName] = useState("");
  const [classroomUploadFileMime, setClassroomUploadFileMime] = useState("application/pdf");
  const [classroomUploadPoints, setClassroomUploadPoints] = useState(100);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [selectedClassroomCourse, setSelectedClassroomCourse] = useState("");
  const [selectedClassroomExam, setSelectedClassroomExam] = useState("");
  const [classroomStudents, setClassroomStudents] = useState([]);
  const [classroomStudentsLoading, setClassroomStudentsLoading] = useState(false);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomSyncResult, setClassroomSyncResult] = useState(null);
  const [classroomEnrolledResult, setClassroomEnrolledResult] = useState(null);

  // Modals
  const [showCreateQModal, setShowCreateQModal] = useState(false);
  const [analyticsExamId, setAnalyticsExamId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("exam_author");
  const [inviteModalSent, setInviteModalSent] = useState(null);
  const [selectedEnrollmentExam, setSelectedEnrollmentExam] = useState(null);

  // Members list state (initialized with authenticated user only, no mock members)
  const [members, setMembers] = useState(() => {
    if (currentUser) {
      return [
        {
          id: currentUser.id || "1",
          name: currentUser.full_name || currentUser.email,
          email: currentUser.email,
          role: currentUser.role || "owner",
          status: "Active",
          permissions: "Full Platform Administration"
        }
      ];
    }
    return [];
  });

  // Exam deletion state
  const [examToDelete, setExamToDelete] = useState(null);
  const [deletingExam, setDeletingExam] = useState(false);

  // Pagination states for Examinations and Question Bank
  const [examPage, setExamPage] = useState(1);
  const examPageSize = 10;
  const [qPage, setQPage] = useState(1);
  const qPageSize = 10;

  // Create Exam Wizard state
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamMode, setNewExamMode] = useState("proctored_cbt");
  const [newExamDuration, setNewExamDuration] = useState(180);

  // Quick Quiz Room Hosting state
  const [hostedRoomModal, setHostedRoomModal] = useState(null);
  const [hostingRoom, setHostingRoom] = useState(false);
  const [hostedRoomLeaderboard, setHostedRoomLeaderboard] = useState([]);
  const [hostedRoomCooldown, setHostedRoomCooldown] = useState(0);

  // Exam Edit & Delete State
  const [editingExam, setEditingExam] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    duration_minutes: 180,
    mode: "proctored_cbt",
    status: "draft"
  });
  const [isUpdatingExam, setIsUpdatingExam] = useState(false);

  // Search & Filter state
  const [examSearchQuery, setExamSearchQuery] = useState("");
  const [examModeFilter, setExamModeFilter] = useState("all");
  const [examStatusFilter, setExamStatusFilter] = useState("all");
  const [copiedExamId, setCopiedExamId] = useState(null);
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [bulkDeletingExams, setBulkDeletingExams] = useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [calibrationMap, setCalibrationMap] = useState({});
  const [sendingInvitesExamId, setSendingInvitesExamId] = useState(null);
  const [brandingForm, setBrandingForm] = useState({ brand_logo_url: "", brand_primary_color: "#2563eb", brand_tagline: "" });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingLogoError, setBrandingLogoError] = useState(false);

  function handleCopyExamLink(examId) {
    const url = `${window.location.origin}/exam/${examId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => { });
    }
    setCopiedExamId(examId);
    setTimeout(() => setCopiedExamId(null), 2500);
  }

  useEffect(() => {
    if (activeOrgId) {
      loadAllData();
    }
    loadMyOrgs();
  }, [activeOrgId, selectedSubject]);

  async function loadMyOrgs() {
    try {
      const list = await api.getMyOrganizations().catch(() => []);
      if (list && list.length > 0) {
        setMyOrgs(list);
      }
    } catch (e) {
      console.warn("My orgs load notice:", e);
    }
  }

  async function loadAllData() {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      // 1. Fetch organization services and properties configured by Platform SuperAdmin
      const sData = await api.getOrgServices(activeOrgId).catch(() => null);
      if (sData?.services) {
        setOrgServices(sData.services);
        if (sData.properties) setOrgProperties(sData.properties);
      }

      // 2. Load usage
      const usageData = await api.getOrgUsage(activeOrgId).catch(() => null);
      if (usageData) setOrgUsage(usageData);

      // 3. Load exams
      const examsData = await api.getExams(activeOrgId).catch(() => []);
      setExams(examsData);

      // 4. Load questions & calibration
      const [qData, calData, brandData] = await Promise.all([
        api.getQuestions(activeOrgId, selectedSubject).catch(() => []),
        api.getQuestionCalibration(activeOrgId).catch(() => []),
        api.getOrgBranding(activeOrgId).catch(() => null),
      ]);
      setQuestions(qData);
      if (Array.isArray(calData)) {
        const cmap = {};
        calData.forEach((c) => { cmap[c.question_id] = c; });
        setCalibrationMap(cmap);
      }
      if (brandData) {
        setBrandingForm({
          brand_logo_url: brandData.brand_logo_url || "",
          brand_primary_color: brandData.brand_primary_color || "#2563eb",
          brand_tagline: brandData.brand_tagline || "",
        });
      }

      // 5. Load real organization members from backend
      const membersData = await api.getOrgMembers(activeOrgId).catch(() => null);
      if (membersData && membersData.length > 0) {
        setMembers(membersData);
      } else if (currentUser) {
        setMembers([
          {
            id: currentUser.id || "1",
            name: currentUser.full_name || currentUser.email,
            email: currentUser.email,
            role: currentUser.role || "owner",
            status: "Active",
            permissions: "Full Platform Administration"
          }
        ]);
      } else {
        setMembers([]);
      }

      // 6. Load organization invite code
      const inviteData = await api.getOrgInviteCode(activeOrgId).catch(() => null);
      if (inviteData?.invite_code) {
        setInviteCode(inviteData.invite_code);
      }

      // 7. Load curriculum subjects
      const subjectsData = await api.getOrgSubjects(activeOrgId).catch(() => []);
      setOrgSubjects(subjectsData || []);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubject(e) {
    if (e) e.preventDefault();
    if (!newSubjName.trim()) return;
    try {
      const created = await api.createOrgSubject(activeOrgId, {
        name: newSubjName.trim(),
        code: newSubjCode.trim() || undefined,
        category: newSubjCategory.trim() || "General"
      });
      setOrgSubjects((prev) => [...prev, created]);
      setNewSubjName("");
      setNewSubjCode("");
      alert(`Subject "${created.name}" created!`);
    } catch (err) {
      alert("Failed to create subject: " + err.message);
    }
  }

  async function handleDeleteSubject(subjectId, subjectName) {
    if (!confirm(`Delete subject "${subjectName}"? Questions linked to this subject will remain intact.`)) return;
    try {
      await api.deleteOrgSubject(activeOrgId, subjectId);
      setOrgSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      if (selectedSubject === subjectName) setSelectedSubject("");
    } catch (err) {
      alert("Failed to delete subject: " + err.message);
    }
  }

  async function handleClearAllSubjects() {
    if (!confirm("Are you sure you want to remove all subjects from this academy? You can then create your own custom subjects.")) return;
    try {
      await api.clearAllOrgSubjects(activeOrgId);
      setOrgSubjects([]);
      setSelectedSubject("");
      alert("All subjects cleared. You can now define your custom subjects!");
    } catch (err) {
      alert("Failed to clear subjects: " + err.message);
    }
  }

  async function handleSeedPack(packKey) {
    setIsSeedingPack(true);
    try {
      const res = await api.seedOrgSubjectPack(activeOrgId, packKey);
      const updated = await api.getOrgSubjects(activeOrgId);
      setOrgSubjects(updated || []);
      alert(`Curriculum pack imported! ${res.added_count || 0} new subjects added (${(updated || []).length} total).`);
    } catch (err) {
      alert("Failed to seed curriculum pack: " + err.message);
    } finally {
      setIsSeedingPack(false);
    }
  }

  async function openClassroomModal(examId = null, tab = "upload_anything") {
    setShowClassroomModal(true);
    setClassroomActiveTab(tab);
    setClassroomSyncResult(null);
    setClassroomEnrolledResult(null);
    if (examId) {
      setSelectedClassroomExam(examId);
      setClassroomUploadExamId(examId);
      const targetExam = exams.find(e => e.id === examId);
      if (targetExam) {
        setClassroomUploadTitle(targetExam.title);
        setClassroomUploadDesc(`Assessment Paper: ${targetExam.title}\nDuration: ${targetExam.duration_minutes} Minutes\nRoom Code: ${targetExam.room_code || 'ACTIVE'}`);
      }
    } else if (exams.length > 0 && !selectedClassroomExam) {
      setSelectedClassroomExam(exams[0].id);
      setClassroomUploadExamId(exams[0].id);
      setClassroomUploadTitle(exams[0].title);
    }

    await refreshClassroomCourses();
  }

  function handleClassroomFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setClassroomUploadFileName(file.name);
    setClassroomUploadFileMime(file.type || "application/octet-stream");
    if (!classroomUploadTitle.trim()) {
      setClassroomUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setClassroomUploadFileBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadDirectToClassroom(e) {
    if (e) e.preventDefault();
    if (!selectedClassroomCourse) {
      alert("Please select a Google Classroom course.");
      return;
    }
    if (!classroomUploadTitle.trim()) {
      alert("Please enter a title for the content being uploaded to Google Classroom.");
      return;
    }
    setClassroomLoading(true);
    setClassroomSyncResult(null);
    try {
      const res = await api.uploadClassroomContent({
        organization_id: activeOrgId,
        course_id: selectedClassroomCourse,
        post_type: classroomUploadType,
        title: classroomUploadTitle.trim(),
        description: classroomUploadDesc.trim(),
        link_url: classroomUploadLink.trim() || undefined,
        exam_id: classroomUploadExamId || undefined,
        max_points: Number(classroomUploadPoints) || 100,
        file_content_base64: classroomUploadFileBase64 || undefined,
        file_name: classroomUploadFileName || undefined,
        file_mime_type: classroomUploadFileMime || "application/pdf"
      });
      setClassroomSyncResult({
        message: res.message || `Uploaded ${classroomUploadType} to Google Classroom!`,
        alternate_link: res.alternate_link,
        coursework_id: res.item_id || "LIVE"
      });
      alert(res.message || "Uploaded directly to Google Classroom!");
    } catch (err) {
      const errMsg = err.message || String(err);
      if (errMsg.includes("insufficient authentication scopes") || errMsg.includes("403")) {
        alert("Google Classroom requires permission for Announcements & Course Materials.\n\nPlease click 'Re-authorize Google' at the top of the Classroom Hub and ensure all permission boxes are checked on Google's consent screen.");
        handleConnectGoogleClassroom();
      } else if (errMsg.includes("invalid authentication credentials") || errMsg.includes("401") || errMsg.includes("re-connect") || errMsg.includes("Expected OAuth 2")) {
        setClassroomConnected(false);
        alert("Your Google Classroom login has expired.\n\nPlease click 'Connect Google Classroom' to sign in again.");
        handleConnectGoogleClassroom();
      } else if (errMsg.includes("drive.googleapis.com") || errMsg.includes("Google Drive API")) {
        alert("Notice: To enable native Google Drive file previews, please click 'Enable' on the Google Drive API in Google Cloud Console:\nhttps://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=539216233370");
      } else {
        alert("Failed to upload to Google Classroom: " + errMsg);
      }
    } finally {
      setClassroomLoading(false);
    }
  }

  function handleConnectGoogleClassroom() {
    const activeCid = import.meta.env.VITE_GOOGLE_CLIENT_ID || "539216233370-eca2ktq30qc3m74o04b17q7bp90sds0j.apps.googleusercontent.com";
    if (!window.google?.accounts?.oauth2) {
      alert("Google Identity Services is loading. Please click again in 2 seconds.");
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: activeCid,
      scope: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.coursework.students",
        "https://www.googleapis.com/auth/classroom.coursework.me",
        "https://www.googleapis.com/auth/classroom.announcements",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" "),
      callback: async (tokenResp) => {
        if (tokenResp?.error) {
          alert("Google Classroom authorization was cancelled: " + tokenResp.error);
          return;
        }
        if (tokenResp?.access_token) {
          setClassroomLoading(true);
          try {
            await api.connectClassroom({
              organization_id: activeOrgId,
              access_token: tokenResp.access_token
            });
            setClassroomConnected(true);
            await refreshClassroomCourses();
            alert("Google Classroom connected successfully! Loaded your available courses.");
          } catch (err) {
            alert("Failed to connect Google Classroom: " + err.message);
          } finally {
            setClassroomLoading(false);
          }
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  async function refreshClassroomCourses() {
    setClassroomLoading(true);
    try {
      const statusRes = await api.getClassroomStatus(activeOrgId);
      setClassroomConnected(Boolean(statusRes?.connected));
      const courses = await api.getClassroomCourses(activeOrgId);
      setClassroomCourses(courses || []);
      const targetCourseId = (courses && courses.length > 0)
        ? (courses.find(c => c.id === selectedClassroomCourse)?.id || courses[0].id)
        : "";
      setSelectedClassroomCourse(targetCourseId);
      if (targetCourseId) {
        await loadClassroomStudents(targetCourseId);
      } else {
        setClassroomStudents([]);
      }
    } catch (e) {
      console.warn("Classroom courses refresh error:", e);
      const errMsg = e.message || String(e);
      if (
        errMsg.includes("401") ||
        errMsg.includes("invalid authentication credentials") ||
        errMsg.includes("re-connect") ||
        errMsg.includes("Expected OAuth 2")
      ) {
        setClassroomConnected(false);
        setClassroomCourses([]);
      }
    } finally {
      setClassroomLoading(false);
    }
  }

  async function loadClassroomStudents(courseId) {
    if (!courseId) {
      setClassroomStudents([]);
      return;
    }
    setClassroomStudentsLoading(true);
    try {
      const students = await api.getClassroomStudents(activeOrgId, courseId);
      setClassroomStudents(students || []);
    } catch (e) {
      console.warn("Could not fetch students for course:", e);
      setClassroomStudents([]);
    } finally {
      setClassroomStudentsLoading(false);
    }
  }

  async function handleCourseChange(courseId) {
    setSelectedClassroomCourse(courseId);
    await loadClassroomStudents(courseId);
  }

  async function handlePublishToClassroom() {
    if (!selectedClassroomExam || !selectedClassroomCourse) {
      alert("Please select both a Google Classroom course and an examination.");
      return;
    }
    setClassroomLoading(true);
    setClassroomSyncResult(null);
    try {
      const res = await api.publishToClassroom({
        organization_id: activeOrgId,
        exam_id: selectedClassroomExam,
        course_id: selectedClassroomCourse,
        max_points: 100
      });
      setClassroomSyncResult(res);
      await loadAllData();

      // Download candidate credentials PDF sheet automatically
      try {
        const ex = exams.find((e) => e.id === selectedClassroomExam) || {};
        await api.downloadExamCredentialsPdf(selectedClassroomExam, ex.room_code || "CLASSROOM");
      } catch (pdfErr) {
        console.warn("Could not auto-download credentials PDF:", pdfErr);
      }

      toast.success(
        `Published to Google Classroom with Candidate Credentials PDF!\n\n` +
        `• Official CourseWork assignment posted to Classroom stream\n` +
        `• Candidate Credentials PDF Sheet attached directly in Classroom materials\n` +
        `• All student login UIDs & access PINs posted in instructions\n` +
        `• Credentials PDF also downloaded to your computer\n` +
        `• Students can log in at: ${window.location.origin}/candidate-login`,
        { title: "Google Classroom Published", duration: 7000 }
      );
    } catch (err) {
      toast.error("Failed to publish to Google Classroom: " + err.message);
    } finally {
      setClassroomLoading(false);
    }
  }

  async function handleImportClassroomStudents() {
    if (!selectedClassroomExam || !selectedClassroomCourse) {
      toast.warning("Please select both a Google Classroom course and an examination.");
      return;
    }
    setClassroomLoading(true);
    setClassroomEnrolledResult(null);
    try {
      const res = await api.importClassroomStudents(selectedClassroomCourse, selectedClassroomExam, classroomStudents);
      setClassroomEnrolledResult(res);
      await loadAllData();

      // Download candidate credentials PDF sheet automatically
      try {
        const ex = exams.find((e) => e.id === selectedClassroomExam) || {};
        await api.downloadExamCredentialsPdf(selectedClassroomExam, ex.room_code || "CLASSROOM");
      } catch (pdfErr) {
        console.warn("Could not auto-download credentials PDF:", pdfErr);
      }

      toast.success(
        `${res.message}\n\n` +
        `• Downloaded Candidate Credentials PDF (Login IDs & Passwords)\n` +
        `• Candidates can log in at ${window.location.origin}/candidate-login using their UID & PIN.`,
        { title: "Students Enrolled", duration: 6000 }
      );
    } catch (err) {
      toast.error("Failed to import students from Classroom: " + err.message);
    } finally {
      setClassroomLoading(false);
    }
  }

  async function handleSendMemberInvite(e) {
    if (e) e.preventDefault();
    if (!inviteEmail.trim()) {
      alert("Please enter a valid member email address.");
      return;
    }
    try {
      await api.inviteMember(activeOrgId, inviteEmail.trim(), inviteRole).catch(() => null);
    } catch (err) {
      console.warn("Backend invite notice:", err);
    }
    const simulatedDispatch = {
      to: inviteEmail.trim(),
      role: inviteRole,
      invite_code: inviteCode,
      smtp_status: "250 2.0.0 OK: Delivered via Nodemailer SMTP Transport",
      timestamp: new Date().toLocaleTimeString(),
      preview_subject: `You've been invited to join ${orgUsage?.organization_name || orgName} on Lunaris`,
      preview_body: `Dear Colleague,\n\nYou have been invited to join the ${orgUsage?.organization_name || orgName} assessment workspace on Lunaris as ${inviteRole.replace(/_/g, " ").toUpperCase()}.\n\n Organization Invite Code: ${inviteCode}\n Direct Join Link: ${window.location.origin}/?join=${inviteCode}\n\nPlease visit the platform and use the invite code to link your account.`
    };
    setInviteModalSent(simulatedDispatch);
    setMembers((prev) => [
      ...prev.filter(m => m.email.toLowerCase() !== inviteEmail.trim().toLowerCase()),
      {
        id: String(Date.now()),
        name: inviteEmail.split("@")[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "Invited (Pending Join)",
        permissions: inviteRole === "exam_author" ? "Paper Authoring & AI Studio" : inviteRole === "proctor" ? "Live Proctoring & Review" : "Full Platform Administration"
      }
    ]);
  }

  async function confirmDeleteExam() {
    if (!examToDelete) return;
    setDeletingExam(true);
    try {
      await api.deleteExam(examToDelete.id);
      setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
      setSelectedExamIds((prev) => prev.filter((id) => id !== examToDelete.id));
      toast.success(`Exam "${examToDelete.title}" deleted successfully`);
      setExamToDelete(null);
      api.getOrgUsage(activeOrgId).then((u) => u && setOrgUsage(u)).catch(() => {});
    } catch (err) {
      toast.error("Failed to delete exam: " + err.message);
    } finally {
      setDeletingExam(false);
    }
  }

  async function handleBulkDeleteExams() {
    if (selectedExamIds.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedExamIds.length} selected exam(s) and all their enrollments, attempts, and proctoring logs? This cannot be undone.`)) {
      return;
    }
    setBulkDeletingExams(true);
    try {
      await api.bulkDeleteExams(selectedExamIds);
      setExams((prev) => prev.filter((e) => !selectedExamIds.includes(e.id)));
      toast.success(`Deleted ${selectedExamIds.length} exam(s) successfully`);
      setSelectedExamIds([]);
      api.getOrgUsage(activeOrgId).then((u) => u && setOrgUsage(u)).catch(() => {});
    } catch (err) {
      toast.error("Failed to bulk delete exams: " + err.message);
    } finally {
      setBulkDeletingExams(false);
    }
  }

  async function handlePublishExam(examId) {
    try {
      const res = await api.publishExam(examId);
      const ex = exams.find((e) => e.id === examId) || {};
      const roomCode = res.room_code || ex.room_code || "ROOM";

      // Download the credentials sheet PDF automatically
      try {
        await api.downloadExamCredentialsPdf(examId, roomCode);
      } catch (pdfErr) {
        console.warn("Could not auto-download PDF:", pdfErr);
      }

      await loadAllData();

      const classroomMsg = res.classroom_synced
        ? `\n\nGoogle Classroom Synced: Auto-enrolled students from "${res.classroom_course_name || 'Active Course'}"!`
        : "";

      alert(
        `Exam Published Successfully!\n\n` +
        `• Snapshot Version #${res.version_number} locked\n` +
        `• Total Questions: ${res.question_count}\n` +
        `• Enrolled Candidates: ${res.enrolled_count || 0}${classroomMsg}\n` +
        `• Downloaded Candidate Credentials PDF (Login IDs & Passwords)\n\n` +
        `Candidates can now log in at:\n${window.location.origin}/candidate-login\nRoom Code: ${roomCode}`
      );
    } catch (err) {
      alert("Error publishing exam: " + err.message);
    }
  }

  async function handleAssignCandidate(examId) {
    const email = prompt("Enter Candidate Email to Invite:");
    if (!email) return;
    try {
      const res = await api.assignCandidates(examId, [email]);
      alert(`Candidate invited! Unique token: ${res.assignments[0]?.invite_token}`);
      loadAllData();
    } catch (err) {
      alert("Error inviting candidate: " + err.message);
    }
  }

  async function handleCreateExam() {
    if (!newExamTitle.trim()) {
      alert("Please provide an exam title");
      return;
    }
    try {
      await api.createExam({
        organization_id: activeOrgId,
        title: newExamTitle,
        mode: newExamMode,
        duration_minutes: parseInt(newExamDuration, 10) || 180,
        question_ids: []
      });
      setShowCreateExamModal(false);
      setNewExamTitle("");
      loadAllData();
    } catch (err) {
      alert("Failed to create exam: " + err.message);
    }
  }

  async function handleHostQuickQuizRoom(examId) {
    setHostingRoom(true);
    try {
      const res = await api.createQuickQuizRoom(examId, 20);
      setHostedRoomLeaderboard([]);
      setHostedRoomCooldown(res.cooldown_seconds ?? 5);
      setHostedRoomModal(res);
      loadAllData();
    } catch (err) {
      alert("Failed to host Quick Quiz Room: " + err.message);
    } finally {
      setHostingRoom(false);
    }
  }

  useEffect(() => {
    if (!hostedRoomModal?.room_code) return;
    let active = true;
    const fetchLeaderboard = async () => {
      try {
        const res = await api.getQuickQuizLeaderboard(hostedRoomModal.room_code);
        if (active) {
          setHostedRoomLeaderboard(res.leaderboard || []);
        }
      } catch {
        // Ignore transient polling errors while room is open
      }
    };
    fetchLeaderboard();
    const pollId = setInterval(fetchLeaderboard, 3000);
    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, [hostedRoomModal?.room_code]);

  useEffect(() => {
    if (!hostedRoomModal || hostedRoomCooldown <= 0) return;
    const timer = setInterval(() => {
      setHostedRoomCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [hostedRoomModal, hostedRoomCooldown]);

  function handleOpenEditExam(ex) {
    setEditingExam(ex);
    setEditFormData({
      title: ex.title || "",
      description: ex.description || "",
      duration_minutes: ex.duration_minutes || 180,
      mode: ex.mode || "proctored_cbt",
      status: ex.status || "draft"
    });
  }

  async function handleSaveEditExam(e) {
    e.preventDefault();
    if (!editingExam) return;
    if (!editFormData.title.trim()) {
      alert("Exam title is required");
      return;
    }
    setIsUpdatingExam(true);
    try {
      await api.updateExam(editingExam.id, {
        title: editFormData.title.trim(),
        description: editFormData.description,
        duration_minutes: parseInt(editFormData.duration_minutes, 10) || 180,
        mode: editFormData.mode,
        status: editFormData.status
      });
      setEditingExam(null);
      await loadAllData();
      alert("Exam updated successfully!");
    } catch (err) {
      alert("Failed to update exam: " + err.message);
    } finally {
      setIsUpdatingExam(false);
    }
  }

  async function handleDeleteExam(ex) {
    if (!window.confirm(`Are you sure you want to permanently delete the exam "${ex.title}"?\n\nThis will permanently delete:\n• All student candidate enrollments & access UIDs\n• All test attempts, candidate answers & incident logs\n• All question links and version snapshots\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteExam(ex.id);
      await loadAllData();
      alert(`Exam "${ex.title}" and all associated data have been deleted.`);
    } catch (err) {
      alert("Failed to delete exam: " + err.message);
    }
  }

  async function handleDeleteQuestion(q) {
    const qSnippet = (q.content?.text || "this question").slice(0, 60);
    if (!window.confirm(`Permanently delete this question from the Question Bank?\n\n"${qSnippet}..."\n\nThis cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteQuestion(q.id);
      setQuestions((prev) => prev.filter((item) => item.id !== q.id));
      if (orgUsage) {
        setOrgUsage((prev) => prev ? { ...prev, questions_count: Math.max(0, (prev.questions_count || 1) - 1) } : prev);
      }
    } catch (err) {
      alert("Failed to delete question: " + err.message);
    }
  }

  async function handleClearQuestions() {
    const filterDesc = selectedSubject ? `all questions under subject "${selectedSubject}"` : "ALL questions in the entire Question Bank";
    if (!window.confirm(`WARNING: Are you sure you want to delete ${filterDesc}?\n\nThis action is permanent and cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.clearQuestions(activeOrgId, selectedSubject);
      if (selectedSubject) {
        setQuestions((prev) => prev.filter((q) => q.subject !== selectedSubject));
      } else {
        setQuestions([]);
      }
      await loadAllData();
      alert(res.message || "Questions deleted successfully.");
    } catch (err) {
      alert("Failed to clear questions: " + err.message);
    }
  }

  async function handleRemoveMember(m) {
    if (m.role === "owner" && currentUser && m.email === currentUser.email) {
      alert("You cannot remove yourself as workspace owner.");
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${m.name} (${m.email}) from this organization?`)) {
      return;
    }
    try {
      await api.removeOrgMember(activeOrgId, m.id);
      await loadAllData();
      alert(`Member ${m.name} removed successfully.`);
    } catch (err) {
      alert("Failed to remove member: " + err.message);
    }
  }

  const filteredExams = exams.filter((ex) => {
    const matchesSearch =
      !examSearchQuery.trim() ||
      (ex.title && ex.title.toLowerCase().includes(examSearchQuery.toLowerCase())) ||
      (ex.room_code && ex.room_code.toLowerCase().includes(examSearchQuery.toLowerCase())) ||
      (ex.id && ex.id.toLowerCase().includes(examSearchQuery.toLowerCase()));
    const matchesMode =
      examModeFilter === "all"
        ? true
        : examModeFilter === "custom"
        ? !["proctored_cbt", "quick_quiz", "standard_quiz"].includes(ex.mode)
        : ex.mode === examModeFilter;
    const matchesStatus = examStatusFilter === "all" || ex.status === examStatusFilter;
    return matchesSearch && matchesMode && matchesStatus;
  });
  const totalExamPages = Math.ceil(filteredExams.length / examPageSize) || 1;
  const pagedExams = filteredExams.slice((examPage - 1) * examPageSize, examPage * examPageSize);


  const filteredQuestions = questions.filter((q) => {
    if (!questionSearchQuery.trim()) return true;
    const qLower = questionSearchQuery.toLowerCase();
    const textMatch = q.content?.text && q.content.text.toLowerCase().includes(qLower);
    const subjectMatch = q.subject && q.subject.toLowerCase().includes(qLower);
    return textMatch || subjectMatch;
  });
  const totalQPages = Math.ceil(filteredQuestions.length / qPageSize) || 1;
  const pagedQuestions = filteredQuestions.slice((qPage - 1) * qPageSize, qPage * qPageSize);


  const displayOrgName = orgUsage?.organization_name || orgName;
  const orgInitials = getInitials(displayOrgName);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", width: "100vw", overflow: "hidden", background: "#f8fafc", color: "var(--text-primary)", position: "relative" }}>

      {/* ── MOBILE BACKDROP OVERLAY ────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 90
          }}
        />
      )}

      {/* ── COLLAPSIBLE & RESPONSIVE SIDEBAR ─────────────────────────────────── */}
      <aside
        style={{
          width: sidebarCollapsed ? "72px" : "255px",
          minWidth: sidebarCollapsed ? "72px" : "255px",
          background: "#ffffff",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative", flexShrink: 0, maxHeight: "100vh",
          top: 0,
          height: "100vh",
          zIndex: 95,
          transition: "width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s ease",
          overflowX: "hidden",
          overflowY: "auto"
        }}
        className={mobileMenuOpen ? "mobile-sidebar-open" : ""}
      >
        {/* Top Part of Sidebar */}
        <div>
          {/* Brand Lockup & Collapse Button */}
          <div style={{
            height: "64px",
            padding: sidebarCollapsed ? "0 12px" : "0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "8px"
          }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0 }}
              onClick={onExitToPublic}
              title="Return to Lunaris Assessment Platform"
            >
              <img
                src="/logo.png"
                alt="Lunaris"
                style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "50%", flexShrink: 0 }}
              />
              {!sidebarCollapsed && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: "800",
                    fontSize: "15px",
                    letterSpacing: "0.5px",
                    color: "#0f172a",
                    lineHeight: "1.1",
                    whiteSpace: "nowrap"
                  }}>
                    LUNARIS
                  </span>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "var(--accent-blue)",
                    letterSpacing: "0.2px",
                    lineHeight: "1",
                    marginTop: "2px"
                  }}>
                    Assessment Platform
                  </span>
                </div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                background: "#f8fafc",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "12px",
                flexShrink: 0
              }}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? "▶" : "◀"}
            </button>
          </div>

          {/* Academy Selector in Sidebar */}
          <div style={{ padding: sidebarCollapsed ? "12px 8px" : "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
            {sidebarCollapsed ? (
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  margin: "0 auto",
                  borderRadius: "8px",
                  background: "var(--accent-blue-subtle)",
                  color: "var(--accent-blue)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  cursor: "pointer"
                }}
                title={`Active Academy: ${displayOrgName}`}
                onClick={handleOpenRenameModal}
              >
                
              </div>
            ) : (
              <div style={{
                background: "#f8fafc",
                border: `1.5px solid ${brandingForm.brand_primary_color || "var(--border-subtle)"}`,
                borderRadius: "8px",
                padding: "8px 10px"
              }}>
                {(brandingForm.brand_logo_url || brandingForm.brand_tagline) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid #e2e8f0" }}>
                    {brandingForm.brand_logo_url && !brandingLogoError && (
                      <img
                        src={brandingForm.brand_logo_url}
                        alt="Logo"
                        onError={() => setBrandingLogoError(true)}
                        style={{ width: "22px", height: "22px", objectFit: "contain", borderRadius: "4px" }}
                      />
                    )}
                    {brandingForm.brand_tagline && (
                      <span style={{ fontSize: "11px", fontWeight: "700", color: brandingForm.brand_primary_color || "#2563eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {brandingForm.brand_tagline}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                    Active Academy
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setShowJoinOrgModal(true)}
                      style={{ background: "none", border: "none", color: "#059669", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: "0 2px" }}
                      title="Join Academy with Invite Code"
                    >
                      + Join
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateAcademyModal(true)}
                      style={{ background: "none", border: "none", color: "var(--accent-blue)", fontSize: "11px", fontWeight: "700", cursor: "pointer", padding: "0 2px" }}
                      title="Create New Academy"
                    >
                      + New
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenRenameModal}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", cursor: "pointer", padding: "0 2px" }}
                      title="Rename Academy"
                    >
                      Rename
                    </button>
                  </div>
                </div>
                <select
                  value={activeOrgId}
                  onChange={(e) => {
                    const sel = myOrgs.find(o => o.id === e.target.value || o.slug === e.target.value);
                    if (sel) handleSwitchOrg(sel);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#0f172a",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  {myOrgs.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.plan_id ? `[${o.plan_id.toUpperCase()}]` : "[FREE]"}
                    </option>
                  ))}
                  {myOrgs.length === 0 && (
                    <option value={activeOrgId}>{orgName}</option>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Quick Action Buttons in Sidebar */}
          <div style={{ padding: sidebarCollapsed ? "12px 8px" : "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setShowCreateExamModal(true)}
              style={{
                width: "100%",
                padding: sidebarCollapsed ? "10px 0" : "9px 14px",
                background: "var(--accent-blue)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(37,99,235,0.25)"
              }}
              title="Create New Assessment Paper"
            >
              <span>+</span>
              {!sidebarCollapsed && <span>New Exam</span>}
            </button>

            {/* Direct Google Classroom Hub Launcher */}
            <button
              type="button"
              onClick={() => openClassroomModal(null, "upload_anything")}
              style={{
                width: "100%",
                padding: sidebarCollapsed ? "10px 0" : "8px 12px",
                background: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
              title="Upload anything directly to Google Classroom"
            >
              <GraduationCapIcon size={16} />
              {!sidebarCollapsed && <span>Classroom Hub</span>}
            </button>
          </div>

          {/* Navigation Items */}
          <nav style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { key: "exams", label: "Examinations", icon: FileTextIcon, count: exams.length },
              { key: "questions", label: "Question Bank", icon: BookIcon, count: questions.length },
              {
                key: "templates",
                label: "Paper Templates",
                icon: LayersIcon
              },
              {
                key: "paper_studio",
                label: "Paper Studio",
                icon: SparklesIcon
              },
              {
                key: "ai_studio",
                label: "AI Question Studio",
                icon: BotIcon,
                isDisabled: orgServices.ai_studio === false
              },
              {
                key: "live_proctor",
                label: "Live Proctoring",
                icon: ShieldIcon,
                isDisabled: orgServices.proctor_console === false
              },
              { key: "members", label: "Faculty & Members", icon: UsersIcon, count: members.length },
              { key: "billing", label: "Plans & Billing", icon: CreditCardIcon }
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (tab.key === "live_proctor") {
                      if (onOpenProctorConsole) {
                        onOpenProctorConsole();
                      } else {
                        window.open("/proctor", "_blank");
                      }
                      setMobileMenuOpen(false);
                      return;
                    }
                    setActiveTab(tab.key);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: sidebarCollapsed ? "12px 0" : "10px 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: isActive ? "700" : "500",
                    color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-blue-subtle)" : "transparent",
                    border: isActive ? "1px solid rgba(37,99,235,0.18)" : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "space-between",
                    gap: "8px",
                    opacity: tab.isDisabled ? 0.6 : 1,
                    transition: "all 0.14s ease"
                  }}
                  title={tab.label}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <tab.icon size={16} />
                    {!sidebarCollapsed && <span>{tab.label}</span>}
                  </div>

                  {!sidebarCollapsed && (
                    <div>
                      {typeof tab.count === "number" && (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "2px 7px",
                          borderRadius: "9999px",
                          background: isActive ? "#ffffff" : "#f1f5f9",
                          color: isActive ? "var(--accent-blue)" : "var(--text-muted)",
                          border: `1px solid ${isActive ? "rgba(37,99,235,0.2)" : "var(--border-subtle)"}`
                        }}>
                          {tab.count}
                        </span>
                      )}
                      {tab.isDisabled && <LockIcon size={12} color="var(--text-muted)" />}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile & External Links */}
        <div style={{
          padding: sidebarCollapsed ? "12px 8px" : "14px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          {currentUser?.is_superadmin && (
            <button
              type="button"
              onClick={() => navigate("/admin")}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: "8px"
              }}
              title="Platform SuperAdmin"
            >
              <ShieldIcon size={14} />
              {!sidebarCollapsed && <span>SuperAdmin</span>}
            </button>
          )}

          {/* Free-Tier / Ad-Enabled Sidebar Banner (160x300) */}
          {!sidebarCollapsed && (
            <AdSlot
              placement="160x300_1"
              show={(orgUsage?.ads_enabled !== undefined ? orgUsage.ads_enabled : (orgUsage?.plan_id || currentPlan || "free").toLowerCase() === "free") && !currentUser?.is_superadmin}
              onUpgradeClick={() => setActiveTab("billing")}
              style={{ margin: "8px auto 12px" }}
            />
          )}

          {/* User Identity Chip */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            gap: "8px",
            marginTop: "4px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "var(--accent-blue-subtle)",
                color: "var(--accent-blue)",
                fontSize: "12px",
                fontWeight: "800",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                {orgInitials || "LN"}
              </div>
              {!sidebarCollapsed && (
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentUser?.full_name || currentUser?.email || "Educator"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayOrgName}
                  </div>
                </div>
              )}
            </div>

            {onLogout && !sidebarCollapsed && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  padding: "2px 6px"
                }}
                title="Sign Out"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top Header Bar */}
        <header style={{
          flexShrink: 0,
          zIndex: 40,
          background: "#ffffff",
          borderBottom: "1px solid var(--border-subtle)",
          height: "64px",
          padding: "0 clamp(16px, 2vw, 28px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-menu-btn"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                background: "#ffffff",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                cursor: "pointer"
              }}
              title="Toggle Navigation Menu"
            >
              
            </button>

            <div>
              <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                {activeTab === "exams" && "Examinations and Assessments"}
                {activeTab === "questions" && "Curriculum Question Bank"}
                {activeTab === "templates" && "Question Paper Templates"}
                {activeTab === "paper_studio" && "Question Paper Studio"}
                {activeTab === "ai_studio" && "AI Question Studio"}
                {activeTab === "live_proctor" && "Live Invigilation Console"}
                {activeTab === "members" && "Faculty and Workspace Team"}
                {activeTab === "billing" && "Subscription and UPI Billing"}
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {displayOrgName} · {orgUsage?.plan_name || "Free Starter Tier"}
              </span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => openClassroomModal(null, "upload_anything")}
              style={{
                padding: "7px 12px",
                fontSize: "12px",
                fontWeight: "600",
                borderRadius: "6px",
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#16a34a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
              title="Upload anything directly to Google Classroom"
            >
              <GraduationCapIcon size={16} />
              <span className="hide-on-mobile">Google Classroom</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateExamModal(true)}
              style={{
                padding: "7px 14px",
                background: "var(--accent-blue)",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 1px 2px rgba(37,99,235,0.2)"
              }}
            >
              <span>+</span>
              <span className="hide-on-mobile">New Exam</span>
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "clamp(16px, 2vw, 28px)", width: "100%" }}>
          <div style={{ maxWidth: "1600px", width: "100%", margin: "0 auto" }}>

          {/* Plan-Controlled Dashboard Ads (never rendered for ad-free plans or SuperAdmins) */}
          <AdSlot
            placement="468x60_1"
            show={(orgUsage?.ads_enabled !== undefined ? orgUsage.ads_enabled : (orgUsage?.plan_id || currentPlan || "free").toLowerCase() === "free") && !currentUser?.is_superadmin}
            onUpgradeClick={() => setActiveTab("billing")}
            style={{ marginBottom: "18px", marginTop: "0" }}
          />

          {/* ── UNIFIED ACADEMY OVERVIEW & QUOTA RIBBON ───────────────────────── */}
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
          }}>
            {/* Top Row: Academy identity & Quick tool links */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "var(--accent-blue-subtle)",
                  color: "var(--accent-blue)",
                  fontSize: "18px",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(37,99,235,0.15)"
                }}>
                  {orgInitials || "LN"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", fontFamily: "var(--font-display)" }}>
                      {displayOrgName}
                    </h1>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      padding: "3px 9px",
                      borderRadius: "6px",
                      background: (orgUsage?.plan_id === "institution" ? "#eff6ff" : orgUsage?.plan_id === "creator_pro" ? "#f5f3ff" : "#f8fafc"),
                      color: (orgUsage?.plan_id === "institution" ? "#1d4ed8" : orgUsage?.plan_id === "creator_pro" ? "#6d28d9" : "#475569"),
                      border: `1px solid ${orgUsage?.plan_id === "institution" ? "#bfdbfe" : orgUsage?.plan_id === "creator_pro" ? "#ddd6fe" : "#cbd5e1"}`
                    }}>
                      {orgUsage?.plan_name || (currentPlan === "institution" ? "Institution Plan" : currentPlan === "creator_pro" ? "Creator Pro" : "Free Starter Tier")}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      ID: {activeOrgId.slice(0, 8)}...
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Multi-tenant specialized assessment workspace with automated anti-cheat, secure computer-based testing, and real-time proctoring.
                  </p>
                </div>
              </div>

              {/* Quick Action Tools */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => openClassroomModal(null, "upload_anything")}
                  style={{
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    borderRadius: "6px",
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                  title="Upload exam, notes, or announcement directly to Google Classroom"
                >
                  <span>Upload to Classroom</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  style={{
                    padding: "7px 12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    background: "#ffffff",
                    color: "var(--text-secondary)",
                    cursor: "pointer"
                  }}
                >
                  + Invite Faculty
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("billing")}
                  style={{
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: "700",
                    borderRadius: "6px",
                    border: "1px solid var(--accent-blue)",
                    background: "#ffffff",
                    color: "var(--accent-blue)",
                    cursor: "pointer"
                  }}
                >
                  Plan &amp; UPI Billing
                </button>
              </div>
            </div>

            {/* 4 Metrics & Quota Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              {/* Metric 1: Examinations */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "14px 16px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                    Examinations
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "600" }}>
                    Limit: {orgUsage?.max_exams || 3}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                    {exams.length}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--accent-emerald)", fontWeight: "600" }}>
                    {exams.filter(e => e.status === "published").length} Published
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (exams.length / (orgUsage?.max_exams || 3)) * 100)}%`,
                    height: "100%",
                    background: exams.length >= (orgUsage?.max_exams || 3) ? "#ef4444" : "var(--accent-blue)",
                    borderRadius: "2px",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>

              {/* Metric 2: Question Bank */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "14px 16px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                    Question Bank
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSubjectsModal(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-blue)",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    Taxonomy ({orgSubjects.length})
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                    {questions.length}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>
                    Items across {orgSubjects.length || "all"} subjects
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(10, questions.length * 2))}%`,
                    height: "100%",
                    background: "#7c3aed",
                    borderRadius: "2px"
                  }} />
                </div>
              </div>

              {/* Metric 3: Candidate Capacity & Enrolled Roster */}
              <div
                onClick={() => setShowCapacityModal(true)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                title="Click to view enrolled students, manage roster, and edit candidate capacity"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                    Candidate Capacity
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {orgUsage?.candidates_count || 0} / {orgUsage?.max_candidates || 5000}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--accent-blue)", fontWeight: "700", textDecoration: "underline" }}>
                      Manage Roster ↗
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                    {orgUsage?.candidates_count || 0}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>
                    Enrolled candidate seats (Click to view & edit)
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (((orgUsage?.candidates_count || 0) / (orgUsage?.max_candidates || 5000)) * 100))}%`,
                    height: "100%",
                    background: ((orgUsage?.candidates_count || 0) >= (orgUsage?.max_candidates || 5000)) ? "#ef4444" : "#059669",
                    borderRadius: "2px",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>

              {/* Metric 4: AI & Proctoring Attempts */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "14px 16px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                    AI Proctoring
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                    {orgUsage?.proctoring_used || 0} / {orgUsage?.max_proctoring_attempts || 5}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                    {orgUsage?.proctoring_used || 0}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--accent-blue)", fontWeight: "600" }}>
                    Invigilated sessions
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "#e2e8f0", borderRadius: "2px", marginTop: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (((orgUsage?.proctoring_used || 0) / (orgUsage?.max_proctoring_attempts || 5)) * 100))}%`,
                    height: "100%",
                    background: ((orgUsage?.proctoring_used || 0) >= (orgUsage?.max_proctoring_attempts || 5)) ? "#ef4444" : "#0891b2",
                    borderRadius: "2px",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── TAB 1: EXAMS ─────────────────────────────────────────────────── */}
          {activeTab === "exams" && (
            <div style={{
              background: "#ffffff",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
            }}>
              {/* Header bar */}
              <div style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px"
              }}>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    Scheduled and Published Examinations
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Configure assessment papers, computer-based testing parameters, candidate login sheets, and classroom sync.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {selectedExamIds.length > 0 && (
                    <button
                      type="button"
                      disabled={bulkDeletingExams}
                      onClick={handleBulkDeleteExams}
                      style={{
                        padding: "7px 14px",
                        background: "#dc2626",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        border: "none",
                        cursor: bulkDeletingExams ? "not-allowed" : "pointer"
                      }}
                    >
                      {bulkDeletingExams ? "Deleting..." : `Delete Selected (${selectedExamIds.length})`}
                    </button>
                  )}
                  <span style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    background: "#f8fafc",
                    border: "1px solid var(--border-subtle)",
                    padding: "4px 10px",
                    borderRadius: "9999px"
                  }}>
                    {filteredExams.length} of {exams.length} papers
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateExamModal(true)}
                    style={{
                      padding: "7px 14px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    + Create Exam
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div style={{
                padding: "12px 24px",
                background: "#f8fafc",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                {/* Search input */}
                <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px" }}>
                  <input
                    type="text"
                    placeholder="Search exam by title, room code, or ID..."
                    value={examSearchQuery}
                    onChange={(e) => setExamSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 32px 8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      background: "#ffffff",
                      fontSize: "13px",
                      color: "var(--text-primary)",
                      outline: "none"
                    }}
                  />
                  {examSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExamSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      
                    </button>
                  )}
                </div>

                {/* Mode Filters */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  {[
                    { id: "all", label: "All Modes" },
                    { id: "proctored_cbt", label: "Proctored CBT" },
                    { id: "standard_quiz", label: "Standard Practice" },
                    { id: "quick_quiz", label: "Quick Quiz" }
                  ].map(item => {
                    const isSelected = examModeFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setExamModeFilter(item.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: isSelected ? "700" : "500",
                          background: isSelected ? "var(--accent-blue)" : "#ffffff",
                          color: isSelected ? "#ffffff" : "var(--text-secondary)",
                          border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                          cursor: "pointer"
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Status Filters */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {[
                    { id: "all", label: "All Status" },
                    { id: "published", label: "Published" },
                    { id: "draft", label: "Draft" }
                  ].map(item => {
                    const isSelected = examStatusFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setExamStatusFilter(item.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: isSelected ? "700" : "500",
                          background: isSelected ? "#0f172a" : "#ffffff",
                          color: isSelected ? "#ffffff" : "var(--text-secondary)",
                          border: `1px solid ${isSelected ? "#0f172a" : "var(--border-subtle)"}`,
                          cursor: "pointer"
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th style={{ width: "36px" }}>
                        <input
                          type="checkbox"
                          checked={pagedExams.length > 0 && pagedExams.every((ex) => selectedExamIds.includes(ex.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExamIds(Array.from(new Set([...selectedExamIds, ...pagedExams.map((ex) => ex.id)])));
                            } else {
                              const pageIds = new Set(pagedExams.map((ex) => ex.id));
                              setSelectedExamIds((prev) => prev.filter((id) => !pageIds.has(id)));
                            }
                          }}
                          title="Select all exams on this page"
                        />
                      </th>
                      <th>Exam Title and Format</th>
                      <th>Room / Subject</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                          <div style={{ maxWidth: "360px", margin: "0 auto" }}>
                            <p style={{ fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px", fontSize: "15px" }}>
                              {exams.length === 0 ? "No examinations created yet" : "No examinations match your filter"}
                            </p>
                            <p style={{ fontSize: "13px", marginBottom: "16px" }}>
                              {exams.length === 0 ? "Click '+ Create Exam' to launch your first assessment paper." : "Try clearing your search query or mode filter."}
                            </p>
                            {exams.length > 0 && (
                              <button
                                type="button"
                                onClick={() => { setExamSearchQuery(""); setExamModeFilter("all"); setExamStatusFilter("all"); }}
                                style={{
                                  padding: "6px 14px",
                                  background: "#ffffff",
                                  border: "1px solid var(--border-subtle)",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer"
                                }}
                              >
                                Reset Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pagedExams.map((ex) => (
                        <tr key={ex.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedExamIds.includes(ex.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExamIds((prev) => [...prev, ex.id]);
                                } else {
                                  setSelectedExamIds((prev) => prev.filter((id) => id !== ex.id));
                                }
                              }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px", marginBottom: "4px" }}>
                              {ex.title}
                            </div>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: ex.mode === "quick_quiz"
                                ? "var(--accent-amber-subtle)"
                                : ex.mode === "standard_quiz"
                                  ? "var(--accent-emerald-subtle)"
                                  : "var(--accent-blue-subtle)",
                              color: ex.mode === "quick_quiz"
                                ? "var(--accent-amber)"
                                : ex.mode === "standard_quiz"
                                  ? "var(--accent-emerald)"
                                  : "var(--accent-blue)",
                              border: `1px solid ${
                                ex.mode === "quick_quiz"
                                  ? "rgba(217,119,6,0.2)"
                                  : ex.mode === "standard_quiz"
                                    ? "rgba(5,150,105,0.2)"
                                    : "rgba(37,99,235,0.2)"
                              }`
                            }}>
                              {ex.mode === "quick_quiz"
                                ? "Quick Quiz Arena"
                                : ex.mode === "standard_quiz"
                                  ? "Standard Practice"
                                  : "Proctored CBT"}
                            </span>
                          </td>
                          <td>
                            {ex.room_code ? (
                              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--accent-blue)", fontSize: "13px" }}>
                                {ex.room_code}
                              </span>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                Standard Roster
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: "600", fontSize: "13px" }}>
                              {ex.duration_minutes}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
                              min
                            </span>
                          </td>
                          <td>
                            <span style={{
                              padding: "3px 9px",
                              borderRadius: "9999px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: ex.status === "published" ? "#ecfdf5" : "#f1f5f9",
                              color: ex.status === "published" ? "#059669" : "#475569",
                              border: `1px solid ${ex.status === "published" ? "#a7f3d0" : "#e2e8f0"}`
                            }}>
                              {ex.status === "published" ? "Published" : ex.status === "archived" ? "Archived" : "Draft"}
                            </span>
                          </td>
                          <td>
                            <div className="action-bar">
                              {/* Attempt Preview */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (onTakeExam) {
                                    onTakeExam(ex.slug || ex.id, "TEST-CANDIDATE-01", "2026");
                                  } else {
                                    navigate(`/exam/${ex.slug || ex.id}`);
                                  }
                                }}
                                title="Take / Test Run Exam as Candidate"
                                style={{ color: "var(--accent-blue)", fontWeight: "700" }}
                              >
                                Attempt
                              </button>

                              {/* Copy Link */}
                              <button
                                type="button"
                                onClick={() => handleCopyExamLink(ex.id)}
                                title="Copy Candidate Portal Link"
                                className={copiedExamId === ex.id ? "success" : ""}
                              >
                                {copiedExamId === ex.id ? "Copied" : "Link"}
                              </button>

                              {/* Google Classroom Direct Upload */}
                              <button
                                type="button"
                                onClick={() => openClassroomModal(ex.id, "upload_anything")}
                                title="Upload this exam directly to Google Classroom"
                                style={ex.classroom_coursework_id ? { color: "#16a34a", fontWeight: "700" } : {}}
                              >
                                Classroom {ex.classroom_coursework_id ? "" : ""}
                              </button>

                              {ex.status === "draft" && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishExam(ex.id)}
                                  title="Publish Exam to Candidates"
                                  className="success"
                                >
                                  Publish
                                </button>
                              )}

                              {orgServices.bulk_enrollment !== false && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedEnrollmentExam(ex)}
                                  title="Manage Candidate UIDs and Passwords"
                                >
                                  UIDs
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => api.downloadExamCredentialsPdf(ex.id, ex.room_code || "EXAM")}
                                title="Download Printable Credentials Sheet (Login UIDs & Passwords PDF)"
                              >
                                PDF
                              </button>

                              {ex.mode === "quick_quiz" && orgServices.quick_quiz !== false && (
                                <button
                                  type="button"
                                  onClick={() => handleHostQuickQuizRoom(ex.id)}
                                  disabled={hostingRoom}
                                  title="Host Quick Quiz Arena"
                                  style={{ color: "var(--accent-amber)" }}
                                >
                                  Host
                                </button>
                              )}

                              {orgServices.detailed_analytics !== false && (
                                <button
                                  type="button"
                                  onClick={() => setAnalyticsExamId(ex.id)}
                                  title="View Candidate Analytics"
                                >
                                  Stats
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEditExam(ex)}
                                title="Edit Exam Configuration"
                              >
                                Edit
                              </button>

                              {/* Send Scheduled Email Invites */}
                              <button
                                type="button"
                                disabled={sendingInvitesExamId === ex.id}
                                onClick={async () => {
                                  setSendingInvitesExamId(ex.id);
                                  try {
                                    const res = await api.sendExamInvites(ex.id);
                                    toast.success(res.message || `Sent ${res.sent || 0} email invites!`);
                                  } catch (err) {
                                    toast.error(err.message || "Failed to send invites");
                                  } finally {
                                    setSendingInvitesExamId(null);
                                  }
                                }}
                                title="Send Email Invites to Enrolled Candidates"
                                style={{
                                  color: "#059669",
                                  fontWeight: "600"
                                }}
                              >
                                {sendingInvitesExamId === ex.id ? "Sending..." : "Email Invites"}
                              </button>

                              {/* Dedicated Live Proctor Console Shortcut */}
                              {ex.mode === "proctored_cbt" && (
                                <button
                                  type="button"
                                  onClick={() => window.open("/proctor", "_blank")}
                                  title="Open Live Proctoring Console in New Window"
                                  style={{
                                    color: "#0284c7",
                                    fontWeight: "600"
                                  }}
                                >
                                  Proctor ↗
                                </button>
                              )}

                              {/* Delete Exam Action Button */}
                              <button
                                type="button"
                                onClick={() => setExamToDelete(ex)}
                                title="Permanently Delete Examination"
                                style={{
                                  color: "#dc2626",
                                  fontWeight: "600"
                                }}
                              >
                                Delete
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteExam(ex)}
                                title="Delete Exam Permanently"
                                className="danger"
                              >
                                
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Examinations Table Pagination */}
              {filteredExams.length > examPageSize && (
                <div
                  style={{
                    padding: "12px 20px",
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
                    Showing <strong>{((examPage - 1) * examPageSize) + 1}</strong> - <strong>{Math.min(examPage * examPageSize, filteredExams.length)}</strong> of <strong>{filteredExams.length}</strong> examinations
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={examPage <= 1}
                      onClick={() => setExamPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                        background: examPage <= 1 ? "#f1f5f9" : "#ffffff",
                        color: examPage <= 1 ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: examPage <= 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: totalExamPages }, (_, i) => i + 1).map((num) => {
                      if (totalExamPages > 7 && Math.abs(num - examPage) > 2 && num !== 1 && num !== totalExamPages) {
                        if (Math.abs(num - examPage) === 3) {
                          return <span key={num} style={{ fontSize: "11px", color: "#94a3b8", padding: "0 2px" }}>...</span>;
                        }
                        return null;
                      }
                      const isCur = num === examPage;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setExamPage(num)}
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
                      disabled={examPage >= totalExamPages}
                      onClick={() => setExamPage((p) => Math.min(totalExamPages, p + 1))}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                        background: examPage >= totalExamPages ? "#f1f5f9" : "#ffffff",
                        color: examPage >= totalExamPages ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: examPage >= totalExamPages ? "not-allowed" : "pointer"
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: QUESTION BANK ─────────────────────────────────────────── */}
          {activeTab === "questions" && (
            <div>
              {/* Top Toolbar */}
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
              }}>
                {/* Subject filters & search */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("templates")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: "var(--accent-blue-subtle)",
                      color: "var(--accent-blue)",
                      border: "1px solid rgba(37,99,235,0.2)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginRight: "4px"
                    }}
                  >
                    <LayersIcon size={13} /> Blueprints & Templates →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("paper_studio")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: "#fdf4ff",
                      color: "#9333ea",
                      border: "1px solid #f0abfc",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginRight: "8px"
                    }}
                  >
                    <SparklesIcon size={13} /> Paper Studio →
                  </button>
                  {["", ...(orgSubjects.length > 0 ? orgSubjects.map(s => s.name) : Array.from(new Set(questions.map(q => q.subject).filter(Boolean))))].map((s, sIdx) => {
                    const isSel = selectedSubject === s;
                    return (
                      <button
                        key={`subj-filter-${s || "all"}-${sIdx}`}
                        type="button"
                        onClick={() => setSelectedSubject(s)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: isSel ? "700" : "500",
                          background: isSel ? "var(--accent-blue)" : "#f8fafc",
                          color: isSel ? "#ffffff" : "var(--text-secondary)",
                          border: `1px solid ${isSel ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                          cursor: "pointer"
                        }}
                      >
                        {s === "" ? "All Subjects" : s}
                      </button>
                    );
                  })}

                  <input
                    type="text"
                    placeholder="Search question text or stem..."
                    value={questionSearchQuery}
                    onChange={(e) => setQuestionSearchQuery(e.target.value)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "13px",
                      minWidth: "220px",
                      background: "#ffffff",
                      outline: "none"
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("ai_studio")}
                    style={{
                      padding: "7px 14px",
                      fontSize: "12px",
                      fontWeight: "700",
                      background: "#f0fdf4",
                      color: "#16a34a",
                      border: "1px solid #bbf7d0",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    title="Import past year papers (PYQ), test sheets, or notes"
                  >
                    <UploadIcon size={14} />
                    <span>Import File / PYQ</span>
                  </button>
                  {questions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearQuestions}
                      style={{
                        padding: "7px 12px",
                        fontSize: "12px",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        borderRadius: "6px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Clear {selectedSubject ? `${selectedSubject} (${filteredQuestions.length})` : `All (${questions.length})`}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowSubjectsModal(true)}
                    style={{
                      padding: "7px 12px",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      cursor: "pointer"
                    }}
                  >
                    Curriculum Taxonomy ({orgSubjects.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateQModal(true)}
                    style={{
                      padding: "7px 14px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    + Author Question
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                {filteredQuestions.length === 0 ? (
                  <div style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    padding: "48px 24px",
                    textAlign: "center",
                    color: "var(--text-muted)"
                  }}>
                    <p style={{ fontWeight: "700", color: "#0f172a", fontSize: "15px", marginBottom: "4px" }}>
                      {questions.length === 0 ? "No questions in bank yet" : "No questions match your query"}
                    </p>
                    <p style={{ fontSize: "13px" }}>
                      {questions.length === 0 ? "Click '+ Author Question' or use AI Studio to generate curriculum-aligned items." : "Try clearing your search query or subject filter."}
                    </p>
                  </div>
                ) : (
                  pagedQuestions.map((q, idx) => {
                    const sc = subjectColor(q.subject || "");
                    return (
                      <div
                        key={q.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "10px",
                          padding: "18px 20px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{
                              padding: "2px 8px",
                              background: sc.bg,
                              color: sc.text,
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase"
                            }}>
                              {q.subject}
                            </span>
                            <span style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              fontWeight: "600",
                              background: "#f1f5f9",
                              padding: "2px 8px",
                              borderRadius: "4px"
                            }}>
                              {q.question_type === "numerical" ? "NVQ Numerical" : "MCQ Multiple Choice"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {calibrationMap[q.id] && (
                              <span
                                title={`Accuracy: ${calibrationMap[q.id].accuracy_pct}% across ${calibrationMap[q.id].total_attempts} attempts`}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background: calibrationMap[q.id].calibrated_difficulty === "Hard" ? "#fef2f2" : calibrationMap[q.id].calibrated_difficulty === "Easy" ? "#ecfdf5" : "#fffbeb",
                                  color: calibrationMap[q.id].calibrated_difficulty === "Hard" ? "#dc2626" : calibrationMap[q.id].calibrated_difficulty === "Easy" ? "#059669" : "#d97706"
                                }}
                              >
                                {calibrationMap[q.id].calibrated_difficulty} ({calibrationMap[q.id].accuracy_pct}% acc • {calibrationMap[q.id].avg_time_sec}s avg)
                              </span>
                            )}
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>
                              Item #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q)}
                              title="Delete question from bank"
                              style={{
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer"
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <p style={{ fontSize: "14px", color: "#0f172a", lineHeight: "1.6", marginBottom: "14px", fontWeight: "500" }}>
                          {q.content.text}
                        </p>

                        {q.question_type === "numerical" ? (
                          <div style={{
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#059669",
                            fontWeight: "600",
                            display: "inline-block"
                          }}>
                            Correct Answer: {q.content.numerical_answer} (Tolerance ±{q.content.tolerance || 0.01})
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            {q.content.options?.map((opt, i) => {
                              const isCorrect = opt.id === q.content.correct_option_id;
                              return (
                                <div
                                  key={opt.id}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    background: isCorrect ? "#ecfdf5" : "#f8fafc",
                                    color: isCorrect ? "#059669" : "var(--text-secondary)",
                                    fontWeight: isCorrect ? "700" : "500",
                                    border: `1px solid ${isCorrect ? "#a7f3d0" : "var(--border-subtle)"}`,
                                    fontSize: "13px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px"
                                  }}
                                >
                                  <span style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    background: isCorrect ? "#059669" : "#e2e8f0",
                                    color: isCorrect ? "#ffffff" : "#475569",
                                    fontSize: "10px",
                                    fontWeight: "700",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0
                                  }}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span>{opt.text}</span>
                                  {isCorrect && <span style={{ marginLeft: "auto", fontSize: "12px" }}></span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: AI QUESTION STUDIO ─────────────────────────────────────── */}
          {activeTab === "ai_studio" && (
            orgServices.ai_studio === false ? (
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "48px 24px",
                textAlign: "center"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>AI Question Studio Disabled</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: "8px auto 0 auto", lineHeight: "1.5" }}>
                  The AI Question Studio service is currently disabled for this organization by the platform administrator.
                </p>
              </div>
            ) : (
              <AiQuestionStudio
                organizationId={activeOrgId}
                onQuestionApproved={loadAllData}
              />
            )
          )}

          {/* ── TAB 4: LIVE PROCTOR ──────────────────────────────────────────── */}
          {activeTab === "live_proctor" && (
            orgServices.proctor_console === false ? (
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "48px 24px",
                textAlign: "center"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>Live Proctor Console Disabled</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: "8px auto 0 auto", lineHeight: "1.5" }}>
                  Live invigilation and streaming proctor console services are currently disabled for this organization by the platform administrator.
                </p>
              </div>
            ) : (
              <div>
                <LiveProctorDashboard organizationId={activeOrgId} />
              </div>
            )
          )}

          {/* ── TAB 5: MEMBERS & FACULTY ─────────────────────────────────────── */}
          {activeTab === "members" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Invite Code Card */}
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "20px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
              }}>
                <div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--accent-blue)",
                    background: "var(--accent-blue-subtle)",
                    padding: "2px 8px",
                    borderRadius: "4px"
                  }}>
                    Workspace Invite Key
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginTop: "6px" }}>
                    Organization Faculty Invite Code
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "520px", marginTop: "4px" }}>
                    Share this code with faculty colleagues to link their account directly to this academy workspace.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{
                    padding: "10px 20px",
                    background: "#f8fafc",
                    border: "1px dashed var(--accent-blue)",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "20px",
                    fontWeight: "800",
                    color: "var(--accent-blue)",
                    letterSpacing: "2px"
                  }}>
                    {inviteCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      alert(`Copied Invite Code: ${inviteCode}`);
                    }}
                    style={{
                      padding: "9px 14px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Copy Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const joinUrl = `${window.location.origin}/?join=${inviteCode}`;
                      navigator.clipboard.writeText(joinUrl);
                      alert(`Copied Join URL: ${joinUrl}`);
                    }}
                    style={{
                      padding: "9px 14px",
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
              }}>
                <div style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                      Workspace Faculty and Team ({members.length})
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Exam authors, proctors, and administrators active in this workspace
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInviteModalSent(null); setShowInviteModal(true); }}
                    style={{
                      padding: "7px 14px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    + Invite Member
                  </button>
                </div>

                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>User Identity</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Permissions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                          <p style={{ fontWeight: "700", color: "#0f172a", fontSize: "15px", marginBottom: "4px" }}>No members enrolled yet</p>
                          <p style={{ fontSize: "13px" }}>Click "+ Invite Member" or share the invite key above.</p>
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => {
                        const initials = getInitials(m.name || m.email);
                        const grad = avatarColor(m.name || m.email);
                        const roleColor = m.role === "owner"
                          ? { bg: "var(--accent-blue-subtle)", text: "var(--accent-blue)" }
                          : m.role === "exam_author"
                            ? { bg: "var(--accent-amber-subtle)", text: "var(--accent-amber)" }
                            : m.role === "proctor"
                              ? { bg: "var(--accent-purple-subtle)", text: "var(--accent-purple)" }
                              : { bg: "#f1f5f9", text: "#475569" };
                        return (
                          <tr key={m.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="avatar-circle-sm" style={{ background: grad }}>{initials || "?"}</div>
                                <div>
                                  <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "13px" }}>{m.name}</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                padding: "2px 8px",
                                background: roleColor.bg,
                                color: roleColor.text,
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "700",
                                textTransform: "capitalize"
                              }}>
                                {m.role.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td style={{
                              color: m.status.includes("Pending") ? "var(--accent-amber)" : "var(--accent-emerald)",
                              fontWeight: "600",
                              fontSize: "12px"
                            }}>
                              {m.status.includes("Pending") ? "Pending" : "Active"}
                            </td>
                            <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{m.permissions}</td>
                            <td>
                              {m.role !== "owner" || (currentUser && m.email !== currentUser.email) ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(m)}
                                  style={{
                                    padding: "4px 10px",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    border: "1px solid #fecaca",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    cursor: "pointer"
                                  }}
                                >
                                  Remove
                                </button>
                              ) : (
                                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                  Owner
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* White-Label Institution Branding Card */}
              <div style={{
                marginTop: "24px",
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "10px",
                padding: "20px"
              }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>
                  White-Label Institution Branding
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Customize your institution logo, accent color, and tagline displayed on the Candidate Exam Portal and Scorecards.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 140px 1fr auto", gap: "12px", alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Logo URL or Upload Image
                    </label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={brandingForm.brand_logo_url}
                        onChange={(e) => {
                          setBrandingLogoError(false);
                          setBrandingForm((b) => ({ ...b, brand_logo_url: e.target.value }));
                        }}
                        placeholder="https://.../logo.png or upload image"
                        style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "13px" }}
                      />
                      <label
                        style={{
                          padding: "8px 12px",
                          background: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              setBrandingLogoError(false);
                              setBrandingForm((b) => ({ ...b, brand_logo_url: String(reader.result || "") }));
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>Primary Color</label>
                    <input
                      type="color"
                      value={brandingForm.brand_primary_color || "#2563eb"}
                      onChange={(e) => setBrandingForm((b) => ({ ...b, brand_primary_color: e.target.value }))}
                      style={{ width: "100%", height: "36px", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>Portal Tagline</label>
                    <input
                      type="text"
                      value={brandingForm.brand_tagline}
                      onChange={(e) => setBrandingForm((b) => ({ ...b, brand_tagline: e.target.value }))}
                      placeholder="Official Examination Portal"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingBranding}
                    onClick={async () => {
                      setSavingBranding(true);
                      try {
                        await api.updateOrgBranding(activeOrgId, brandingForm);
                        toast.success("Institution branding saved!");
                      } catch (err) {
                        toast.error(err.message || "Failed to save branding");
                      } finally {
                        setSavingBranding(false);
                      }
                    }}
                    style={{
                      padding: "9px 16px",
                      background: "var(--accent-blue)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {savingBranding ? "Saving..." : "Save Branding"}
                  </button>
                </div>
                {(brandingForm.brand_logo_url || brandingForm.brand_tagline) && (
                  <div style={{ marginTop: "12px", padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", border: `1px solid ${brandingForm.brand_primary_color || "#e2e8f0"}`, display: "flex", alignItems: "center", gap: "12px" }}>
                    {brandingForm.brand_logo_url && !brandingLogoError && (
                      <img
                        src={brandingForm.brand_logo_url}
                        alt="Institution Logo Preview"
                        onError={() => setBrandingLogoError(true)}
                        style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "6px", background: "#ffffff", border: "1px solid #e2e8f0" }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: brandingForm.brand_primary_color || "#0f172a" }}>
                        {brandingForm.brand_tagline || orgName}
                      </div>
                      {brandingLogoError && (
                        <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: "600", marginTop: "2px" }}>
                          Logo URL failed to load as an image. Page links (like kommodo.ai/i/...) are HTML pages — use a direct image URL (.png/.jpg/.svg) or click Upload.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 6: BILLING & UPI ─────────────────────────────────────────── */}
          {activeTab === "billing" && (
            <PlansBillingView
              organizationId={activeOrgId}
              currentPlanId={orgUsage?.plan_id || currentPlan}
              onPlanChanged={loadAllData}
            />
          )}

          {/* ── TAB 7: PAPER BLUEPRINT TEMPLATES ─────────────────────────────── */}
          {activeTab === "templates" && (
            <TemplateManager
              organizationId={activeOrgId}
              onGeneratePaperFromTemplate={(tmpl) => {
                setSelectedTemplateForStudio(tmpl);
                setActiveTab("paper_studio");
              }}
              onNavigateToStudio={() => setActiveTab("paper_studio")}
            />
          )}

          {/* ── TAB 8: QUESTION PAPER STUDIO WORKBENCH ──────────────────────── */}
          {activeTab === "paper_studio" && (
            <QuestionPaperStudio
              organizationId={activeOrgId}
              initialTemplateForCreation={selectedTemplateForStudio}
              onNavigateToTemplates={() => setActiveTab("templates")}
            />
          )}
        </div>
        </main>
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      {/* Create Question Modal */}
      {showCreateQModal && (
        <CreateQuestionModal
          organizationId={activeOrgId}
          onClose={() => setShowCreateQModal(false)}
          onCreated={loadAllData}
        />
      )}

      {/* Analytics Modal */}
      {analyticsExamId && (
        <ExamAnalyticsModal
          examId={analyticsExamId}
          onClose={() => setAnalyticsExamId(null)}
        />
      )}

      {/* 8-Step Exam Creation Wizard */}
      {showCreateExamModal && (
        <ExamCreationWizard
          organizationId={activeOrgId}
          onClose={() => setShowCreateExamModal(false)}
          onNavigateToBilling={() => {
            setShowCreateExamModal(false);
            setActiveTab("billing");
          }}
          onExamCreated={(newEx) => {
            setShowCreateExamModal(false);
            loadAllData();
          }}
        />
      )}

      {/* Candidate Enrollment & UID Management Modal */}
      {selectedEnrollmentExam && (
        <EnrollmentManagerModal
          exam={selectedEnrollmentExam}
          organizationId={activeOrgId}
          onClose={() => {
            setSelectedEnrollmentExam(null);
            loadAllData();
          }}
          onTestAsCandidate={(slug, uid, pin) => {
            if (onTakeExam) {
              onTakeExam(slug, uid, pin);
            }
          }}
        />
      )}

      {/* ── EDIT EXAM MODAL ──────────────────────────────────────────────── */}
      {editingExam && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(5px)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div className="dash-card" style={{ maxWidth: "580px", width: "100%", padding: "0", borderRadius: "16px", background: "#ffffff", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{
              background: "linear-gradient(90deg, var(--accent-blue-subtle), var(--accent-purple-subtle))",
              borderBottom: "1px solid var(--border-subtle)",
              padding: "20px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>Edit Examination</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Update exam parameters, duration, mode, or publication status</span>
              </div>
              <button type="button" onClick={() => setEditingExam(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}><XIcon size={16} /></button>
            </div>

            <form onSubmit={handleSaveEditExam} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "5px" }}>
                  Exam Title *
                </label>
                <input
                  type="text"
                  className="lunaris-input"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "5px" }}>
                  Description / Instructions
                </label>
                <textarea
                  className="lunaris-input"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Instructions for test takers..."
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "5px" }}>
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={1} max={600}
                    className="lunaris-input"
                    value={editFormData.duration_minutes}
                    onChange={(e) => setEditFormData({ ...editFormData, duration_minutes: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "5px" }}>
                    Publication Status
                  </label>
                  <select
                    className="lunaris-input"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="draft">Draft (Editing / Authoring)</option>
                    <option value="published">Published (Ready for testing)</option>
                    <option value="archived">Archived (Closed)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "5px" }}>
                  Examination Mode
                </label>
                <select
                  className="lunaris-input"
                  value={["proctored_cbt", "quick_quiz", "standard_quiz"].includes(editFormData.mode) ? editFormData.mode : "custom"}
                  onChange={(e) => setEditFormData({ ...editFormData, mode: e.target.value })}
                >
                  <option value="proctored_cbt">AI Proctored Examination (AI Webcam + Audio + Tab Security)</option>
                  <option value="standard_quiz">Standard Assessment (Self-paced Practice Assessment)</option>
                  <option value="quick_quiz">Quick Quiz (Live Speed Arena with Join Code)</option>
                  <option value="custom">Custom Examination Format</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingExam(null)} style={{ padding: "9px 18px", fontSize: "13px" }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isUpdatingExam} style={{ padding: "9px 22px", fontSize: "13px" }}>
                  {isUpdatingExam ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HOSTED QUICK QUIZ ROOM MODAL ─────────────────────────────────── */}
      {hostedRoomModal && (
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
            maxWidth: "500px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "28px",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.05)"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--accent-blue-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px auto"
            }}>
              <ZapIcon size={24} color="var(--accent-blue)" />
            </div>

            <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
              Quick Quiz Room Live!
            </h3>
            <p style={{ fontSize: "14px", color: "#475569", marginTop: "6px", marginBottom: "20px" }}>
              {hostedRoomModal.exam_title}
            </p>

            <div style={{
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "22px"
            }}>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                Join Code for Students
              </div>
              <div style={{
                fontSize: "40px",
                fontWeight: "900",
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent-blue)",
                letterSpacing: "4px",
                margin: "4px 0 6px"
              }}>
                {hostedRoomModal.room_code}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                {hostedRoomModal.per_question_seconds}s per question · Speed Bonus Scoring Active
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                <div style={{ background: "#ffffff", padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/quiz/${hostedRoomModal.room_code}`)}`}
                    alt="Quick Quiz Join QR Code"
                    style={{ width: "140px", height: "140px", display: "block" }}
                  />
                </div>
                <div style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>
                  Scan QR to join directly on mobile
                </div>
              </div>
            </div>

            {/* Live Leaderboard */}
            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "18px",
              textAlign: "left"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Live Leaderboard
                </span>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: "999px" }}>
                  {hostedRoomLeaderboard.length} {hostedRoomLeaderboard.length === 1 ? "player" : "players"}
                </span>
              </div>
              {hostedRoomLeaderboard.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#64748b", textAlign: "center", padding: "10px 0" }}>
                  Waiting for students to join via code or QR...
                </div>
              ) : (
                <div style={{ maxHeight: "170px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {hostedRoomLeaderboard.map((p) => (
                    <div
                      key={p.session_id || `${p.rank}-${p.nickname}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        fontSize: "13px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ fontWeight: "800", color: p.rank <= 3 ? "#2563eb" : "#64748b", width: "22px" }}>
                          #{p.rank}
                        </span>
                        <span style={{ fontWeight: "600", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.nickname}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                        {p.streak > 0 && (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#d97706", background: "#fef3c7", padding: "1px 6px", borderRadius: "6px" }}>
                            {p.streak}x
                          </span>
                        )}
                        <span style={{ fontWeight: "800", color: "#0f172a", fontFamily: "var(--font-mono, monospace)" }}>
                          {p.score} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(hostedRoomModal.room_code);
                    toast.success(`Copied room code ${hostedRoomModal.room_code} to clipboard`);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <CopyIcon size={14} />
                  <span>Copy Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const joinUrl = `${window.location.origin}/quiz/${hostedRoomModal.room_code}`;
                    navigator.clipboard.writeText(joinUrl);
                    toast.success("Copied Quick Quiz join link to clipboard");
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    background: "#ffffff",
                    color: "var(--accent-blue)",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <CopyIcon size={14} />
                  <span>Copy Join Link</span>
                </button>
              </div>

              {onTakeQuickQuiz && (
                <button
                  type="button"
                  disabled={hostedRoomCooldown > 0}
                  onClick={() => {
                    const code = hostedRoomModal.room_code;
                    setHostedRoomModal(null);
                    onTakeQuickQuiz(code);
                  }}
                  style={{
                    padding: "11px 18px",
                    background: hostedRoomCooldown > 0 ? "#94a3b8" : "var(--accent-blue)",
                    color: "#ffffff",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: hostedRoomCooldown > 0 ? "not-allowed" : "pointer",
                    boxShadow: hostedRoomCooldown > 0 ? "none" : "0 2px 8px rgba(37,99,235,0.25)"
                  }}
                >
                  {hostedRoomCooldown > 0
                    ? `Initializing room (${hostedRoomCooldown}s)...`
                    : "Enter Room in Quick Quiz Arena"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setHostedRoomModal(null)}
                style={{
                  padding: "9px 14px",
                  background: "transparent",
                  color: "#64748b",
                  border: "1px solid transparent",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  borderRadius: "8px"
                }}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE MEMBER MODAL ──────────────────────────────────────────── */}
      {showInviteModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(5px)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div className="dash-card" style={{ maxWidth: "520px", width: "100%", padding: "0", borderRadius: "16px", overflow: "hidden" }}>
            {inviteModalSent ? (
              <div style={{ padding: "28px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", background: "var(--accent-emerald-subtle)", color: "var(--accent-emerald)", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", marginBottom: "14px" }}>
                  Nodemailer SMTP Delivered
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", marginBottom: "6px" }}>
                  Invitation Dispatched!
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "18px" }}>
                  An automated email invitation has been queued for recipient delivery.
                </p>

                <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-subtle)", padding: "16px", fontSize: "12px", marginBottom: "22px" }}>
                  {[
                    ["SMTP Server", "smtp.lunaris.internal:587"],
                    ["Recipient", inviteModalSent.to],
                    ["Role Assigned", inviteModalSent.role.replace(/_/g, " ")],
                    ["Status", inviteModalSent.smtp_status]
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>{label}:</span>
                      <span style={{ fontWeight: "600", color: "var(--text-primary)", fontFamily: label === "SMTP Server" ? "monospace" : "inherit", textAlign: "right", maxWidth: "60%" }}>{val}</span>
                    </div>
                  ))}

                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                      Included Organization Invite Code:
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "#ffffff", padding: "9px 14px", borderRadius: "8px",
                      border: "1px dashed var(--accent-blue)",
                      fontFamily: "var(--font-mono)", fontWeight: "800", color: "var(--accent-blue)"
                    }}>
                      <span>{inviteModalSent.invite_code}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteModalSent.invite_code);
                          alert(`Copied Invite Code: ${inviteModalSent.invite_code}`);
                        }}
                        style={{ background: "var(--accent-blue-subtle)", border: "none", color: "var(--accent-blue)", padding: "3px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                      >Copy</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={() => { setInviteEmail(""); setInviteModalSent(null); }} className="btn-secondary" style={{ padding: "9px 18px", fontSize: "13px" }}>
                    + Invite Another
                  </button>
                  <button type="button" onClick={() => setShowInviteModal(false)} className="btn-primary" style={{ padding: "9px 22px", fontSize: "13px" }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Modal header */}
                <div style={{
                  background: "linear-gradient(90deg, var(--accent-blue-subtle), var(--accent-purple-subtle))",
                  borderBottom: "1px solid var(--border-subtle)",
                  padding: "20px 24px",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>Invite Organization Member</h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Send an invitation via Nodemailer SMTP</span>
                  </div>
                  <button type="button" onClick={() => setShowInviteModal(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}><XIcon size={16} /></button>
                </div>

                <div style={{ padding: "24px" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                    Add faculty authors, proctors, or candidates. An invitation with the org invite code will be sent.
                  </p>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Member Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="faculty@allen.ac.in"
                      className="lunaris-input"
                      required
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Assigned Role
                    </label>
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="lunaris-input">
                      <option value="exam_author">Exam Author (Creates questions & papers)</option>
                      <option value="proctor">Proctor / Reviewer (Monitors live sessions)</option>
                      <option value="admin">Administrator (Manages members & settings)</option>
                      <option value="candidate">Candidate (Takes assigned tests)</option>
                    </select>
                  </div>

                  <div style={{ padding: "10px 14px", background: "var(--accent-blue-subtle)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "8px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "22px" }}>
                    Recipient will receive code: <strong style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>{inviteCode}</strong> to link their account.
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary" style={{ padding: "9px 18px", fontSize: "13px" }}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleSendMemberInvite} className="btn-primary" style={{ padding: "9px 22px", fontSize: "13px" }}>
                      Send Invitation via Nodemailer →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CURRICULUM SUBJECTS MANAGER MODAL ─────────────────────────── */}
      {showSubjectsModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1050,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "760px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)"
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(90deg, #f8fafc, #f1f5f9)"
            }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
                  Curriculum Taxonomy & Subjects
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Manage domain subjects used for question authoring, AI generation, and candidate exams.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {orgSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllSubjects}
                    style={{
                      padding: "6px 12px",
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: "6px",
                      color: "#e11d48",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                    title="Remove all current subjects to start fresh with your own"
                  >
                    Clear All ({orgSubjects.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSubjectsModal(false)}
                  style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
                ><XIcon size={16} /></button>
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              {/* Preset Packs Section */}
              <div style={{ marginBottom: "24px", padding: "16px", background: "var(--accent-blue-subtle)", borderRadius: "12px", border: "1px solid rgba(37,99,235,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-blue)" }}>
                      Instant 1-Click Curriculum Packs
                    </h4>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Quickly seed industry-standard domains and subjects into your organization.
                    </p>
                  </div>
                  {isSeedingPack && <span style={{ fontSize: "12px", color: "var(--accent-blue)", fontWeight: "600" }}>Importing...</span>}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={isSeedingPack}
                    onClick={() => handleSeedPack("tech")}
                    style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Tech & Computer Science
                  </button>
                  <button
                    type="button"
                    disabled={isSeedingPack}
                    onClick={() => handleSeedPack("law")}
                    style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Law & Judicial Services
                  </button>
                  <button
                    type="button"
                    disabled={isSeedingPack}
                    onClick={() => handleSeedPack("medical")}
                    style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Medicine & Health
                  </button>
                  <button
                    type="button"
                    disabled={isSeedingPack}
                    onClick={() => handleSeedPack("commerce")}
                    style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Commerce & Finance
                  </button>
                  <button
                    type="button"
                    disabled={isSeedingPack}
                    onClick={() => handleSeedPack("stem")}
                    style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Universal STEM
                  </button>
                </div>
              </div>

              {/* Add Custom Subject Form */}
              <form onSubmit={handleCreateSubject} style={{ marginBottom: "24px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="e.g. Constitutional Law, DSA, Pathology"
                    className="lunaris-input"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Category
                  </label>
                  <select
                    value={newSubjCategory}
                    onChange={(e) => setNewSubjCategory(e.target.value)}
                    className="lunaris-input"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Law">Law & Judiciary</option>
                    <option value="Medical">Medical & Health</option>
                    <option value="Commerce">Commerce & Business</option>
                    <option value="Engineering">Engineering & STEM</option>
                    <option value="General">General / Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newSubjCode}
                    onChange={(e) => setNewSubjCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CS101"
                    className="lunaris-input"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 18px", fontSize: "13px", height: "40px" }}
                >
                  + Add Subject
                </button>
              </form>

              {/* Active Subjects List */}
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: "700" }}>Subject</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: "700" }}>Category</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: "700" }}>Code</th>
                      <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: "700" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                          No subjects configured yet. Import a curriculum pack above or add one manually.
                        </td>
                      </tr>
                    ) : (
                      orgSubjects.map((s) => (
                        <tr key={s.id || s.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-primary)" }}>
                            {s.name}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{
                              padding: "2px 8px",
                              background: "var(--bg-secondary)",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "600",
                              color: "var(--text-secondary)"
                            }}>
                              {s.category || "General"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
                            {s.code || "-"}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(s.id, s.name)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowSubjectsModal(false)}
                className="btn-primary"
                style={{ padding: "9px 24px", fontSize: "13px" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ── GOOGLE CLASSROOM INTEGRATION HUB & UPLOADER MODAL ───────────── */}
      {showClassroomModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1060,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "760px",
            maxHeight: "92vh",
            overflowY: "auto",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f0fdf4"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#16a34a",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px"
                }}>
                  
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#14532d", margin: 0 }}>
                    Google Classroom Integration Hub
                  </h3>
                  <p style={{ fontSize: "12px", color: "#166534", margin: "2px 0 0 0" }}>
                    Upload exams, notes, documents, or announcements directly to Google Classroom.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClassroomModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#166534" }}
              >
                
              </button>
            </div>

            {/* Connection Status Ribbon */}
            <div style={{
              padding: "12px 24px",
              background: classroomConnected ? "#ffffff" : "#fefce8",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: classroomConnected ? "#16a34a" : "#ca8a04",
                  display: "inline-block"
                }} />
                <span style={{ fontSize: "13px", fontWeight: "600", color: classroomConnected ? "#14532d" : "#713f12" }}>
                  {classroomConnected
                    ? `Connected: ${currentUser?.email || "Google Account"} (${classroomCourses.length} active courses)`
                    : "Google Classroom Not Linked Yet"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={handleConnectGoogleClassroom}
                  disabled={classroomLoading}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    fontWeight: "700",
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  {classroomConnected ? "Re-authorize Google" : "Connect Google Classroom"}
                </button>
                <button
                  type="button"
                  onClick={refreshClassroomCourses}
                  disabled={classroomLoading}
                  style={{
                    padding: "5px 10px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  {classroomLoading ? "..." : "Refresh"}
                </button>
              </div>
            </div>

            {/* Segmented Modal Tabs */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid var(--border-subtle)",
              background: "#f8fafc",
              padding: "0 24px"
            }}>
              {[
                { id: "upload_anything", label: "Upload Anything to Classroom" },
                { id: "publish_exam", label: "Coursework & Credentials PDF" },
                { id: "roster_sync", label: "Student Roster Import" }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClassroomActiveTab(tab.id)}
                  style={{
                    padding: "12px 16px",
                    fontSize: "13px",
                    fontWeight: classroomActiveTab === tab.id ? "700" : "500",
                    color: classroomActiveTab === tab.id ? "var(--accent-blue)" : "var(--text-secondary)",
                    background: classroomActiveTab === tab.id ? "#ffffff" : "transparent",
                    borderBottom: classroomActiveTab === tab.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    cursor: "pointer"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Course Selector Dropdown (Shared across all tabs) */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Select Target Google Classroom Course:
                </label>
                {classroomCourses.length > 0 ? (
                  <select
                    value={selectedClassroomCourse}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="lunaris-input"
                  >
                    {classroomCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed var(--border-subtle)" }}>
                    No Google Classroom courses found. Connect your Google Educator account above to load your active classrooms.
                  </div>
                )}
              </div>

              {/* ── TAB 1: UPLOAD ANYTHING DIRECTLY TO CLASSROOM ─────────── */}
              {classroomActiveTab === "upload_anything" && (
                <form onSubmit={handleUploadDirectToClassroom} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Post Type Selector */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Upload Type:
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {[
                        { id: "assignment", label: "CourseWork Assignment", desc: "Graded assessment or test" },
                        { id: "announcement", label: "Stream Announcement", desc: "Post to class stream feed" },
                        { id: "material", label: "Course Material", desc: "Notes, syllabus & docs" }
                      ].map(t => (
                        <div
                          key={t.id}
                          onClick={() => setClassroomUploadType(t.id)}
                          style={{
                            padding: "10px",
                            borderRadius: "8px",
                            border: `1px solid ${classroomUploadType === t.id ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                            background: classroomUploadType === t.id ? "var(--accent-blue-subtle)" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", color: classroomUploadType === t.id ? "var(--accent-blue)" : "#0f172a" }}>
                            {t.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {t.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Title / Headline *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Midterm Assessment Paper 1 / Computer Science Notes"
                      value={classroomUploadTitle}
                      onChange={(e) => setClassroomUploadTitle(e.target.value)}
                      className="lunaris-input"
                    />
                  </div>

                  {/* Description / Instructions */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Instructions or Notes
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Provide student instructions, syllabus coverage, or test guidance..."
                      value={classroomUploadDesc}
                      onChange={(e) => setClassroomUploadDesc(e.target.value)}
                      className="lunaris-input"
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  {/* Attachment Options Grid */}
                  <div style={{ background: "#f8fafc", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                      Attach Content to Classroom Post:
                    </span>

                    {/* Option A: Attach Lunaris Exam */}
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Option 1: Link Lunaris Exam / Assessment Paper
                      </label>
                      <select
                        value={classroomUploadExamId}
                        onChange={(e) => {
                          const exId = e.target.value;
                          setClassroomUploadExamId(exId);
                          const ex = exams.find(x => x.id === exId);
                          if (ex && !classroomUploadTitle) {
                            setClassroomUploadTitle(ex.title);
                          }
                        }}
                        className="lunaris-input"
                        style={{ fontSize: "12px" }}
                      >
                        <option value="">-- None (No Exam Link) --</option>
                        {exams.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.title} ({ex.duration_minutes}m • {ex.mode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Option B: Upload Local File / PDF */}
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Option 2: Upload File / PDF from Computer (Direct to Google Drive &amp; Classroom)
                      </label>
                      <input
                        type="file"
                        onChange={handleClassroomFileSelect}
                        style={{ fontSize: "12px" }}
                      />
                      {classroomUploadFileName && (
                        <div style={{ fontSize: "11px", color: "var(--accent-emerald)", marginTop: "4px", fontWeight: "600" }}>
                          Selected file: {classroomUploadFileName} (will be attached to Classroom)
                        </div>
                      )}
                    </div>

                    {/* Option C: Direct Web Link */}
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Option 3: External Resource URL / Study Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/notes.pdf"
                        value={classroomUploadLink}
                        onChange={(e) => setClassroomUploadLink(e.target.value)}
                        className="lunaris-input"
                        style={{ fontSize: "12px" }}
                      />
                    </div>
                  </div>

                  {/* Points (if assignment) */}
                  {classroomUploadType === "assignment" && (
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px" }}>
                          Maximum Points / Grade:
                        </label>
                        <input
                          type="number"
                          value={classroomUploadPoints}
                          onChange={(e) => setClassroomUploadPoints(e.target.value)}
                          className="lunaris-input"
                          min="1"
                          max="1000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setShowClassroomModal(false)}
                      style={{
                        padding: "9px 16px",
                        background: "#ffffff",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={classroomLoading || !selectedClassroomCourse || !classroomUploadTitle.trim()}
                      style={{
                        padding: "9px 20px",
                        background: "#16a34a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {classroomLoading ? "Uploading to Classroom..." : "Upload to Google Classroom"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── TAB 2: PUBLISH EXAM & CREDENTIALS PDF ───────────────── */}
              {classroomActiveTab === "publish_exam" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Select Lunaris Examination to Publish:
                    </label>
                    <select
                      value={selectedClassroomExam}
                      onChange={(e) => setSelectedClassroomExam(e.target.value)}
                      className="lunaris-input"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.duration_minutes}m • {ex.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      Automated Coursework &amp; Credentials PDF Publishing:
                    </strong>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Publishes this examination as an official CourseWork assignment on Google Classroom. Automatically generates candidate credentials, attaches the PDF credential sheet, and sets up automated grading sync.
                    </p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handlePublishToClassroom}
                      disabled={classroomLoading || !selectedClassroomExam || !selectedClassroomCourse}
                      style={{
                        padding: "9px 20px",
                        background: "#16a34a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      {classroomLoading ? "Publishing Coursework..." : "Push Quiz &amp; Credentials PDF to Classroom"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB 3: IMPORT STUDENT ROSTER ────────────────────────── */}
              {classroomActiveTab === "roster_sync" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Select Target Examination:
                    </label>
                    <select
                      value={selectedClassroomExam}
                      onChange={(e) => setSelectedClassroomExam(e.target.value)}
                      className="lunaris-input"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.duration_minutes}m • {ex.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                      Students Loaded from Course: {classroomStudents.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleImportClassroomStudents}
                      disabled={classroomLoading || classroomStudentsLoading || classroomStudents.length === 0 || !selectedClassroomExam}
                      style={{
                        padding: "8px 16px",
                        background: "var(--accent-blue)",
                        color: "#ffffff",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Enroll {classroomStudents.length} Students into Exam
                    </button>
                  </div>

                  {classroomStudentsLoading ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      Fetching students from Google Classroom...
                    </div>
                  ) : classroomStudents.length > 0 ? (
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "6px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px" }}>Student Name</th>
                            <th style={{ padding: "8px 12px" }}>Email</th>
                            <th style={{ padding: "8px 12px" }}>User ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classroomStudents.map((stu, i) => (
                            <tr key={stu.userId || i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "6px 12px", fontWeight: "600" }}>{stu.name}</td>
                              <td style={{ padding: "6px 12px", color: "var(--text-secondary)" }}>{stu.email}</td>
                              <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{stu.userId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      No students detected in this course.
                    </div>
                  )}
                </div>
              )}

              {/* Live Success Banner */}
              {classroomSyncResult && (
                <div style={{
                  padding: "14px 18px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #bbf7d0",
                  fontSize: "13px",
                  color: "#166534"
                }}>
                  <div style={{ fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckIcon size={14} color="#16a34a" />
                    <span>{classroomSyncResult.message}</span>
                  </div>
                  {classroomSyncResult.alternate_link && (
                    <div style={{ marginTop: "10px" }}>
                      <a
                        href={classroomSyncResult.alternate_link}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "6px 14px",
                          background: "#16a34a",
                          color: "#ffffff",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontSize: "12px",
                          fontWeight: "700",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        Open in Google Classroom ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── JOIN EXISTING ACADEMY / ORGANIZATION MODAL ───────────────────────── */}
      {showJoinOrgModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1070,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8fafc"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <UsersIcon size={20} color="var(--accent-blue)" />
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                  Join Academy Workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinOrgModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
              ><XIcon size={16} /></button>
            </div>

            <form onSubmit={handleJoinAcademy} style={{ padding: "24px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
                Enter the unique organization invite code provided by your administrator. Once joined, this academy workspace will be linked to your account and accessible from your Academy Switcher at any time.
              </p>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px", color: "#334155" }}>
                  Organization Invite Code *
                </label>
                <input
                  type="text"
                  required
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ORG-APEX, ORG-STANFORD, or slug"
                  className="lunaris-input"
                  style={{
                    width: "100%",
                    height: "44px",
                    fontSize: "14px",
                    fontWeight: "700",
                    letterSpacing: "1px",
                    fontFamily: "var(--font-mono, monospace)"
                  }}
                  autoFocus
                />
                <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "block" }}>
                  Invite codes are formatted as ORG-SLUG or your academy's unique handle.
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowJoinOrgModal(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningOrg || !joinInviteCode.trim()}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    background: joiningOrg || !joinInviteCode.trim() ? "#94a3b8" : "var(--accent-blue)",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: joiningOrg || !joinInviteCode.trim() ? "not-allowed" : "pointer"
                  }}
                >
                  {joiningOrg ? "Joining..." : "Join Academy Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE NEW ACADEMY / ORGANIZATION MODAL ───────────────────────── */}
      {showCreateAcademyModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1070,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8fafc"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}></span>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)" }}>
                  Create New Academy Workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAcademyModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
              ><XIcon size={16} /></button>
            </div>

            <form onSubmit={handleCreateAcademy} style={{ padding: "24px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
                Every academy operates in total isolation: completely distinct candidate rosters, examinations, question banks, staff faculty, and linked Google Classrooms.
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                  Academy / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAcademyName}
                  onChange={(e) => setNewAcademyName(e.target.value)}
                  placeholder="e.g. Apex Physics Kota, Medical Prep 2026, Engineering Dept"
                  className="lunaris-input"
                  style={{ width: "100%", height: "42px", fontSize: "13px" }}
                  autoFocus
                />
              </div>

              <div style={{
                padding: "12px 14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "20px"
              }}>
                <div style={{ fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                  Instant Workspace Features:
                </div>
                • Free Starter Plan activated instantly (30 candidate seats, 3 exams)<br />
                • Independent Google Classroom integration & stream publishing<br />
                • Switch seamlessly between all your academies anytime from the top bar
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateAcademyModal(false)}
                  className="btn-secondary"
                  style={{ padding: "9px 18px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAcademy || !newAcademyName.trim()}
                  className="btn-primary"
                  style={{ padding: "9px 22px", fontSize: "13px" }}
                >
                  {creatingAcademy ? "Creating Academy..." : "Create Academy →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Academy Workspace Modal */}
      {showCapacityModal && (
        <CandidateCapacityModal
          organizationId={activeOrgId}
          orgUsage={orgUsage}
          members={members}
          exams={exams}
          onClose={() => setShowCapacityModal(false)}
          onCapacityUpdated={(newCap) => {
            if (newCap) {
              setOrgUsage((prev) => prev ? { ...prev, max_candidates: newCap } : prev);
            }
            loadAllData();
          }}
        />
      )}

      {showRenameOrgModal && (
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
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8fafc"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <EditIcon size={18} />
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)" }}>
                  Rename Academy Workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRenameOrgModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
              ><XIcon size={16} /></button>
            </div>

            <form onSubmit={handleUpdateOrgName} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                  Academy / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  placeholder="Enter new academy name"
                  className="lunaris-input"
                  style={{ width: "100%", height: "42px", fontSize: "13px" }}
                  autoFocus
                />
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px", lineHeight: "1.5" }}>
                This updates your organization's display name across all candidate portals, credential sheets, member invites, and Google Classroom connections.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRenameOrgModal(false)}
                  className="btn-secondary"
                  style={{ padding: "9px 18px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renamingOrg || !editOrgName.trim()}
                  className="btn-primary"
                  style={{ padding: "9px 22px", fontSize: "13px" }}
                >
                  {renamingOrg ? "Saving..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    
      {/* Delete Exam Confirmation Modal Popup */}
      {examToDelete && (
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
            padding: "20px",
            animation: "fadeIn 0.15s ease-out"
          }}
          onClick={() => !deletingExam && setExamToDelete(null)}
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a", letterSpacing: "-0.01em" }}>
                  Delete Examination?
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  Are you sure you want to permanently delete{" "}
                  <strong style={{ color: "#0f172a" }}>{examToDelete.title}</strong>?
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
                  All candidate sessions, answers, proctoring events, and enrolled candidate records for this examination will be permanently removed.
                </div>
              </div>
            </div>

            <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={deletingExam}
                onClick={() => setExamToDelete(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: deletingExam ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingExam}
                onClick={confirmDeleteExam}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: deletingExam ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)"
                }}
              >
                {deletingExam ? "Deleting..." : "Delete Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
