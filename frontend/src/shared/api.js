export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? (window.location.hostname.endsWith("tatakaelabs.tech") ||
       window.location.hostname === "lunarisbuild.vercel.app" ||
       (window.location.hostname.endsWith(".vercel.app") && !window.location.hostname.includes("assesment"))
        ? "https://lunaris-assesment-platform.vercel.app/api/v1"
        : `${window.location.origin}/api/v1`)
    : "http://localhost:8000/api/v1");

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("lunaris_token");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      let errMsg = "Request failed";
      if (typeof errData.detail === "string") {
        errMsg = errData.detail;
      } else if (Array.isArray(errData.detail)) {
        errMsg = errData.detail
          .map((d) => (d.loc ? `${d.loc[d.loc.length - 1]}: ` : "") + d.msg)
          .join("; ");
      } else if (errData.detail && typeof errData.detail === "object") {
        errMsg = JSON.stringify(errData.detail);
      } else if (errData.message) {
        errMsg = errData.message;
      }

      // Only trigger auto-logout when the Lunaris session/JWT itself is invalid or expired
      // (never on third-party 401s like Razorpay, Google Classroom, or AI provider keys)
      const isThirdPartyOrAuthRoute =
        endpoint.startsWith("/auth/login") ||
        endpoint.startsWith("/auth/register") ||
        endpoint.startsWith("/auth/google") ||
        endpoint.startsWith("/candidate/") ||
        endpoint.startsWith("/plans/razorpay") ||
        endpoint.startsWith("/integrations/") ||
        endpoint.startsWith("/ai/");
      const lowerMsg = errMsg.toLowerCase();
      const isSessionExpiredMsg =
        lowerMsg.includes("session") ||
        lowerMsg.includes("validate credentials") ||
        lowerMsg.includes("authentication required") ||
        lowerMsg.includes("invalid token") ||
        lowerMsg.includes("user not found");

      if (
        res.status === 401 &&
        token &&
        !isThirdPartyOrAuthRoute &&
        isSessionExpiredMsg &&
        typeof window !== "undefined"
      ) {
        localStorage.removeItem("lunaris_token");
        localStorage.removeItem("lunaris_user");
        window.dispatchEvent(new CustomEvent("lunaris:unauthorized"));
      }
      throw new Error(errMsg);
    }
    return await res.json();
  } catch (error) {
    console.error(`API Error on [${options.method || "GET"} ${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  // Auth
  getCaptcha: () => request("/auth/captcha"),
  sendVerificationOtp: (data) => request("/auth/send-verification-otp", { method: "POST", body: JSON.stringify(data) }),
  login: (email, password, captcha_id = null, captcha_solution = null, invite_code = null) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, captcha_id, captcha_solution, invite_code })
    }),
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  googleAuth: (data) => request("/auth/google", { method: "POST", body: JSON.stringify(data) }),
  getGoogleConfig: () => request("/auth/google-config"),
  getProfile: () => request("/auth/me"),
  refreshToken: () => request("/auth/refresh", { method: "POST" }),

  // Organizations & Workspace
  createOrganization: (name) => request("/organizations", { method: "POST", body: JSON.stringify({ name }) }),
  updateOrganization: (org_id, name) => request(`/organizations/${org_id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  getMyOrganizations: () => request("/organizations/my"),
  inviteMember: (org_id, email, role) =>
    request(`/organizations/${org_id}/members`, { method: "POST", body: JSON.stringify({ email, role }) }),
  getOrgMembers: (org_id) => request(`/organizations/${org_id}/members`),
  getOrgInviteCode: (org_id) => request(`/organizations/${org_id}/invite-code`),
  joinOrganization: (invite_code) =>
    request("/organizations/join", { method: "POST", body: JSON.stringify({ invite_code }) }),
  getOrgUsage: (org_id) => request(`/organizations/${org_id}/usage`),
  getOrgCandidates: (org_id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/organizations/${org_id}/candidates${qs ? `?${qs}` : ""}`);
  },
  updateOrgCapacity: (org_id, max_candidates) =>
    request(`/organizations/${org_id}/capacity`, { method: "PUT", body: JSON.stringify({ max_candidates }) }),
  addOrgCandidate: (org_id, candidateData) =>
    request(`/organizations/${org_id}/candidates`, { method: "POST", body: JSON.stringify(candidateData) }),
  deleteOrgCandidate: (org_id, enrollment_id) =>
    request(`/organizations/${org_id}/candidates/${enrollment_id}`, { method: "DELETE" }),
  bulkDeleteOrgCandidates: (org_id, candidate_ids) =>
    request(`/organizations/${org_id}/candidates/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ candidate_ids })
    }),
  removeOrgMember: (org_id, member_id) =>
    request(`/organizations/${org_id}/members/${member_id}`, { method: "DELETE" }),

  // Universal Curriculum & Custom Subjects
  getOrgSubjects: (org_id) => request(`/organizations/${org_id}/subjects`),
  createOrgSubject: (org_id, data) => request(`/organizations/${org_id}/subjects`, { method: "POST", body: JSON.stringify(data) }),
  updateOrgSubject: (org_id, subject_id, data) => request(`/organizations/${org_id}/subjects/${subject_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrgSubject: (org_id, subject_id) => request(`/organizations/${org_id}/subjects/${subject_id}`, { method: "DELETE" }),
  clearAllOrgSubjects: (org_id) => request(`/organizations/${org_id}/subjects/clear-all`, { method: "POST" }),
  seedOrgSubjectPack: (org_id, pack_name) => request(`/organizations/${org_id}/subjects/seed-pack?pack_name=${pack_name}`, { method: "POST" }),

  // Question Bank
  createQuestion: (data) => request("/questions", { method: "POST", body: JSON.stringify(data) }),
  getQuestions: (org_id, subject = "") =>
    request(`/questions?organization_id=${org_id}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`),
  deleteQuestion: (question_id) => request(`/questions/${question_id}`, { method: "DELETE" }),
  clearQuestions: (org_id, subject = "") =>
    request(`/questions/bulk/clear-org?organization_id=${org_id}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`, { method: "DELETE" }),

  // AI Question Generation
  generateAiQuestions: (data) => request("/ai/generate-questions", { method: "POST", body: JSON.stringify(data) }),
  getAiDrafts: (org_id) => request(`/ai/drafts?organization_id=${org_id}`),
  approveAiDraft: (draft_id) => request(`/ai/drafts/${draft_id}/approve`, { method: "POST" }),
  rejectAiDraft: (draft_id) => request(`/ai/drafts/${draft_id}/reject`, { method: "POST" }),
  deleteAiDraft: (draft_id) => request(`/ai/drafts/${draft_id}`, { method: "DELETE" }),
  clearAiDrafts: (org_id) => request(`/ai/drafts/bulk/clear?organization_id=${org_id}`, { method: "DELETE" }),
  bulkApproveAiDrafts: (organization_id, draft_ids = []) =>
    request("/ai/drafts/bulk-approve", { method: "POST", body: JSON.stringify({ organization_id, draft_ids }) }),
  ingestQuestionFile: (formData) =>
    request("/ai/ingest-file", { method: "POST", body: formData }),

  // Question Bank Enhanced Filtering & Duplicates
  getQuestionsFiltered: (org_id, params = {}) => {
    const query = new URLSearchParams({ organization_id: org_id, ...params }).toString();
    return request(`/questions?${query}`);
  },
  checkQuestionDuplicates: (organization_id, text, threshold = 0.70) =>
    request("/questions/check-duplicates", { method: "POST", body: JSON.stringify({ organization_id, text, threshold }) }),

  // Question Paper Templates
  getTemplates: (org_id, params = {}) => {
    const query = new URLSearchParams({ organization_id: org_id, ...params }).toString();
    return request(`/templates?${query}`);
  },
  getTemplate: (template_id) => request(`/templates/${template_id}`),
  createTemplate: (data) => request("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (template_id, data) => request(`/templates/${template_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (template_id) => request(`/templates/${template_id}`, { method: "DELETE" }),
  duplicateTemplate: (template_id) => request(`/templates/${template_id}/duplicate`, { method: "POST" }),
  publishTemplate: (template_id) => request(`/templates/${template_id}/publish`, { method: "POST" }),
  getTemplateVersions: (template_id) => request(`/templates/${template_id}/versions`),
  rollbackTemplateVersion: (template_id, version_number) =>
    request(`/templates/${template_id}/rollback/${version_number}`, { method: "POST" }),
  validateTemplate: (template_id) => request(`/templates/${template_id}/validate`, { method: "POST" }),

  // Question Paper Studio
  generatePaper: (data) => request("/paper-studio/generate", { method: "POST", body: JSON.stringify(data) }),
  getGeneratedPapers: (org_id, status = "") =>
    request(`/paper-studio/papers?organization_id=${org_id}${status ? `&status=${status}` : ""}`),
  getGeneratedPaper: (paper_id) => request(`/paper-studio/papers/${paper_id}`),
  updateGeneratedPaper: (paper_id, data) =>
    request(`/paper-studio/papers/${paper_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGeneratedPaper: (paper_id) =>
    request(`/paper-studio/papers/${paper_id}`, { method: "DELETE" }),
  replacePaperQuestion: (paper_id, data) =>
    request(`/paper-studio/papers/${paper_id}/replace-question`, { method: "POST", body: JSON.stringify(data) }),
  generatePaperSets: (paper_id, data) =>
    request(`/paper-studio/papers/${paper_id}/generate-sets`, { method: "POST", body: JSON.stringify(data) }),
  validateGeneratedPaper: (paper_id) =>
    request(`/paper-studio/papers/${paper_id}/validate`, { method: "POST" }),
  publishPaperToExam: (paper_id) =>
    request(`/paper-studio/papers/${paper_id}/publish-exam`, { method: "POST" }),
  saveAiQuestionsToBank: (paper_id) =>
    request(`/paper-studio/papers/${paper_id}/save-ai-questions-to-bank`, { method: "POST" }),
  downloadPaperPdf: async (paper_id, doc_type = "student", set_name = "SET A", title = "Paper") => {
    const token = localStorage.getItem("lunaris_token");
    const res = await fetch(`/api/v1/paper-studio/papers/${paper_id}/export-pdf?doc_type=${doc_type}&set_name=${encodeURIComponent(set_name)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error(`Failed to download ${doc_type === "student" ? "Question Paper" : "Answer Key"} PDF`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_${set_name}_${doc_type === "student" ? "Question_Paper" : "Answer_Key"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Exams & Publishing
  createExam: (data) => request("/exams", { method: "POST", body: JSON.stringify(data) }),
  getExams: (org_id) => request(`/exams?organization_id=${org_id}`),
  getExam: (exam_id) => request(`/exams/${exam_id}`),
  updateExam: (exam_id, data) => request(`/exams/${exam_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (exam_id) => request(`/exams/${exam_id}`, { method: "DELETE" }),
  bulkDeleteExams: (exam_ids) => request("/exams/bulk-delete", { method: "POST", body: JSON.stringify({ exam_ids }) }),
  publishExam: (exam_id) => request(`/exams/${exam_id}/publish`, { method: "POST" }),
  downloadExamCredentialsPdf: async (exam_id, room_code = "Exam") => {
    const token = localStorage.getItem("lunaris_token");
    const res = await fetch(`/api/v1/exams/${exam_id}/credentials-pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      throw new Error("Failed to download credentials PDF");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Candidate_Credentials_${room_code}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  assignCandidates: (exam_id, emails) =>
    request(`/exams/${exam_id}/assignments`, { method: "POST", body: JSON.stringify({ candidate_emails: emails }) }),

  // Candidate Enrollment Management (No permanent account needed)
  bulkGenerateEnrollments: (exam_id, data) =>
    request(`/exams/${exam_id}/enrollments/bulk-generate`, { method: "POST", body: JSON.stringify(data) }),
  getExamEnrollments: (exam_id) => request(`/exams/${exam_id}/enrollments`),
  createEnrollment: (exam_id, data) =>
    request(`/exams/${exam_id}/enrollments`, { method: "POST", body: JSON.stringify(data) }),
  updateEnrollment: (exam_id, enrollment_id, data) =>
    request(`/exams/${exam_id}/enrollments/${enrollment_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEnrollment: (exam_id, enrollment_id) =>
    request(`/exams/${exam_id}/enrollments/${enrollment_id}`, { method: "DELETE" }),
  bulkDeleteEnrollments: (exam_id, enrollment_ids) =>
    request(`/exams/${exam_id}/enrollments/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ enrollment_ids })
    }),
  revokeEnrollment: (exam_id, enrollment_id) =>
    request(`/exams/${exam_id}/enrollments/${enrollment_id}/revoke`, { method: "POST" }),

  // Candidate Exam Portal (UID & PIN access)
  verifyCandidateAccess: (exam_slug, candidate_uid, access_pin = "") =>
    request("/candidate/verify-access", {
      method: "POST",
      body: JSON.stringify({ exam_slug, candidate_uid, access_pin })
    }),
  candidatePreflightConsent: (session_token, data) =>
    request("/candidate/preflight-consent", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify(data)
    }),
  startCandidateAttempt: (session_token) =>
    request("/candidate/start-attempt", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify({})
    }),
  getCandidatePaper: (session_token) =>
    request("/candidate/paper", {
      headers: { Authorization: `Bearer ${session_token}` }
    }),
  saveCandidateAnswer: (session_token, question_id, answer, revision = 1) =>
    request("/candidate/save-answer", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify({ question_id, answer, revision })
    }),
  sendCandidateProctorEvent: (session_token, eventData) =>
    request("/candidate/proctor-event", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify(eventData)
    }),
  sendCandidateStreamFrame: (session_token, frame_base64, attempt_id = null) =>
    request("/candidate/stream-frame", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify({ frame_base64, attempt_id })
    }),
  getCandidateProctorWarnings: (session_token) =>
    request("/candidate/proctor-warnings", {
      headers: { Authorization: `Bearer ${session_token}` }
    }),
  submitCandidateExam: (session_token) =>
    request("/candidate/submit", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` }
    }),

  // Quick Quiz Mode
  createQuickQuizRoom: (exam_id, per_question_time = 20) =>
    request(`/quick-quiz/create-room?exam_id=${exam_id}&per_question_time=${per_question_time}`, { method: "POST" }),
  joinQuickQuizRoom: (room_code, nickname, email = null) =>
    request(`/quick-quiz/rooms/${room_code}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname, email })
    }),
  submitQuickQuizAnswer: (room_code, session_id, question_id, selected_option_id, time_spent_seconds) =>
    request(`/quick-quiz/rooms/${room_code}/answer`, {
      method: "POST",
      body: JSON.stringify({ session_id, question_id, selected_option_id, time_spent_seconds })
    }),
  getQuickQuizLeaderboard: (room_code) => request(`/quick-quiz/rooms/${room_code}/leaderboard`),
  finishQuickQuiz: (room_code, session_id) =>
    request(`/quick-quiz/rooms/${room_code}/finish`, {
      method: "POST",
      body: JSON.stringify({ session_id })
    }),

  // Legacy Exam Attempt
  startAttempt: (invite_token) => request("/attempts", { method: "POST", body: JSON.stringify({ invite_token }) }),
  getPaper: (attempt_id) => request(`/attempts/${attempt_id}/paper`),
  saveAnswer: (attempt_id, question_id, answer, revision) =>
    request(`/attempts/${attempt_id}/answers/${question_id}`, {
      method: "PUT",
      body: JSON.stringify({ answer, revision })
    }),
  submitAttempt: (attempt_id) => request(`/attempts/${attempt_id}/submit`, { method: "POST" }),
  getResults: (attempt_id) => request(`/attempts/${attempt_id}/results`),

  // Proctor Console & Human Review
  getProctorSessions: (organization_id) => request(`/proctor/sessions?organization_id=${organization_id}`),
  clearProctorSessions: (organization_id) =>
    request(`/proctor/sessions?organization_id=${organization_id}`, { method: "DELETE" }),
  getIncidentTimeline: (attempt_id) => request(`/proctor/attempts/${attempt_id}/timeline`),
  recordReview: (event_id, decision, reason) =>
    request(`/proctor/events/${event_id}/review`, { method: "POST", body: JSON.stringify({ decision, reason }) }),
  sendProctorWarning: (attempt_id, message, warning_type = "general_warning") =>
    request(`/proctor/attempts/${attempt_id}/send-warning`, {
      method: "POST",
      body: JSON.stringify({ message, warning_type })
    }),

  // Reports & Analytics
  getExamAnalytics: (exam_id) => request(`/reports/exams/${exam_id}/analytics`),
  releaseExamResults: (exam_id, results_released) =>
    request(`/reports/exams/${exam_id}/release-results`, {
      method: 'POST',
      body: JSON.stringify({ results_released })
    }),

  // SaaS Monetization & Plans
  getPlans: () => request("/plans"),
  getOrgEntitlements: (org_id) => request(`/plans/entitlements/${org_id}`),
  subscribePlan: (org_id, plan_code) =>
    request("/plans/subscribe", { method: "POST", body: JSON.stringify({ organization_id: org_id, plan_code }) }),
  getSubscriptionStatus: (org_id) => request(`/plans/subscription-status/${org_id}`),
  testRenewalReminder: (org_id) => request(`/plans/test-renewal-reminder/${org_id}`, { method: "POST" }),
  sweepRenewals: () => request("/plans/sweep-renewals", { method: "POST" }),

  // Platform Admin (SuperAdmin)
  getPlatformStats: () => request("/platform/stats"),
  getPlatformOrgs: () => request("/platform/organizations"),
  createPlatformOrg: (data) => request("/platform/organizations", { method: "POST", body: JSON.stringify(data) }),
  getPlatformOrgDetail: (org_id) => request(`/platform/organizations/${org_id}`),
  updatePlatformOrg: (org_id, data) => request(`/platform/organizations/${org_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlatformOrg: (org_id) => request(`/platform/organizations/${org_id}`, { method: "DELETE" }),
  getPlatformOrgServices: (org_id) => request(`/platform/organizations/${org_id}/services`),
  updatePlatformOrgServices: (org_id, services, properties) =>
    request(`/platform/organizations/${org_id}/services`, { method: "PUT", body: JSON.stringify({ services, properties }) }),
  updatePlatformOrgSubscription: (org_id, data) =>
    request(`/platform/organizations/${org_id}/subscription`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrgExamSuperadmin: (org_id, exam_id) =>
    request(`/platform/organizations/${org_id}/exams/${exam_id}`, { method: "DELETE" }),
  purgeMockData: () => request("/platform/clean-mock-data", { method: "POST" }),
  clearPlatformDatabase: () => request("/platform/clear-database", { method: "POST" }),
  updateOrgStatus: (org_id, status) =>
    request(`/platform/organizations/${org_id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  changeOrgPlan: (org_id, plan_id) =>
    request(`/platform/organizations/${org_id}/plan`, { method: "POST", body: JSON.stringify({ plan_id }) }),
  getPlatformPlans: () => request("/platform/plans"),
  createPlatformPlan: (data) => request("/platform/plans", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (plan_id, data) => request(`/platform/plans/${plan_id}`, { method: "PUT", body: JSON.stringify(data) }),
  togglePlanProctoring: (plan_id) => request(`/platform/plans/${plan_id}/toggle-proctoring`, { method: "POST" }),
  syncOrgPlanAllotment: (org_id) => request(`/platform/organizations/${org_id}/sync-plan-allotment`, { method: "POST" }),
  deletePlatformPlan: (plan_id) => request(`/platform/plans/${plan_id}`, { method: "DELETE" }),
  removePlatformOrgSubscription: (org_id) =>
    request(`/platform/organizations/${org_id}/subscription`, { method: "DELETE" }),
  getPlatformOrgMembers: (org_id) =>
    request(`/platform/organizations/${org_id}/members`),
  removePlatformOrgMember: (org_id, user_id) =>
    request(`/platform/organizations/${org_id}/members/${user_id}`, { method: "DELETE" }),
  deletePlatformUser: (user_id) =>
    request(`/platform/users/${user_id}`, { method: "DELETE" }),
  getPlatformCustomers: () =>
    request("/platform/customers"),
  getPlatformAuditLogs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    if (params.search) q.append("search", params.search);
    if (params.action_filter && params.action_filter !== "all") q.append("action_filter", params.action_filter);
    const qs = q.toString();
    return request(`/platform/audit-logs${qs ? `?${qs}` : ""}`);
  },
  clearPlatformAuditLogs: () => request("/platform/audit-logs", { method: "DELETE" }),
  getPlatformAdmins: () => request("/platform/admins"),
  createPlatformAdmin: (data) => request("/platform/admins", { method: "POST", body: JSON.stringify(data) }),
  updatePlatformAdminRole: (userId, data) =>
    request(`/platform/admins/${userId}/role`, { method: "PUT", body: JSON.stringify(data) }),
  revokePlatformAdmin: (userId) =>
    request(`/platform/admins/${userId}`, { method: "DELETE" }),
  getPlatformDeepAnalytics: () => request("/platform/analytics"),
  getPlatformPaymentSettings: () => request("/platform/payment-settings"),
  updatePlatformPaymentSettings: (data) =>
    request("/platform/payment-settings", { method: "PUT", body: JSON.stringify(data) }),
  getPlatformPayments: (status_filter) =>
    request(`/platform/payments${status_filter ? `?status_filter=${status_filter}` : ""}`),
  verifyPlatformPayment: (payment_id, data) =>
    request(`/platform/payments/${payment_id}/verify`, { method: "POST", body: JSON.stringify(data) }),
  getUpiCheckoutInfo: (org_id, plan_id) =>
    request(`/plans/upi-checkout-info?organization_id=${org_id}&plan_id=${plan_id}`),
  submitUpiPayment: (data) =>
    request("/plans/submit-upi", { method: "POST", body: JSON.stringify(data) }),
  getOrgPayments: (org_id) =>
    request(`/plans/my-payments/${org_id}`),
  createRazorpayOrder: (data) =>
    request("/plans/razorpay/create-order", { method: "POST", body: JSON.stringify(data) }),
  verifyRazorpayPayment: (data) =>
    request("/plans/razorpay/verify-payment", { method: "POST", body: JSON.stringify(data) }),
  getOrgServices: (org_id) => request(`/organizations/${org_id}/services`),

  // MongoDB Dual-Engine Operations
  getMongoStatus: () => request("/platform/mongodb/status"),
  syncMongo: () => request("/platform/mongodb/sync", { method: "POST" }),
  getMongoCollection: (collection_name, limit = 50, skip = 0) =>
    request(`/platform/mongodb/collection/${collection_name}?limit=${limit}&skip=${skip}`),

  // Coding & Scripting Sandbox Engine
  getCodingLanguages: () => request("/coding/languages"),
  executeCode: (data) => request("/coding/execute", { method: "POST", body: JSON.stringify(data) }),
  evaluateCode: (data) => request("/coding/evaluate", { method: "POST", body: JSON.stringify(data) }),

  // Seed Institutional Demo Exam
  seedDemo: () => request("/seed/demo-exam", { method: "POST" }),

  // Google Classroom Integration
  getClassroomStatus: (org_id) => request(`/integrations/classroom/status?organization_id=${org_id}`),
  connectClassroom: (data) => request("/integrations/classroom/connect", { method: "POST", body: JSON.stringify(data) }),
  disconnectClassroom: () => request("/integrations/classroom/disconnect", { method: "POST" }),
  getClassroomCourses: (org_id) => request(`/integrations/classroom/courses?organization_id=${org_id}`),
  getClassroomStudents: (org_id, course_id) => request(`/integrations/classroom/courses/${course_id}/students?organization_id=${org_id}`),
  importClassroomStudents: (course_id, exam_id, students = null) =>
    request(`/integrations/classroom/courses/${course_id}/import-students`, { method: "POST", body: JSON.stringify({ exam_id, students }) }),
  publishToClassroom: (data) => request("/integrations/classroom/publish", { method: "POST", body: JSON.stringify(data) }),
  turnInToClassroom: (data) => request("/integrations/classroom/turn-in", { method: "POST", body: JSON.stringify(data) }),
  uploadClassroomContent: (data) => request("/integrations/classroom/upload-content", { method: "POST", body: JSON.stringify(data) }),

  // Public Website & Landing Page CMS Controlled by SuperAdmin
  getPublicSiteSettings: () => request("/platform/public-settings"),
  updatePublicSiteSettings: (data) =>
    request("/platform/public-settings", { method: "PUT", body: JSON.stringify(data) }),
  getPublicStats: () => request("/platform/public-stats"),

  // Verified Scorecards, Analytics & Calibration
  verifyScorecardPublic: (attempt_id) => request(`/reports/verify/${attempt_id}`),
  getAttemptAnalytics: (attempt_id) => request(`/reports/attempts/${attempt_id}/analytics`),
  getQuestionCalibration: (org_id) => request(`/questions/calibration?organization_id=${org_id}`),

  // Two-Way Proctor <-> Candidate Chat
  getCandidateChat: (session_token) =>
    request("/candidate/chat", { headers: { Authorization: `Bearer ${session_token}` } }),
  sendCandidateChat: (session_token, message) =>
    request("/candidate/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify({ message })
    }),
  getProctorChat: (attempt_id) => request(`/proctor/attempts/${attempt_id}/chat`),
  sendProctorChat: (attempt_id, message) =>
    request(`/proctor/attempts/${attempt_id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message })
    }),

  // Exam Email Invites & AI Subjective Rubric Grading
  sendExamInvites: (exam_id) => request(`/exams/${exam_id}/send-invites`, { method: "POST" }),
  gradeSubjectiveAnswer: (data) =>
    request("/ai/grade-subjective", { method: "POST", body: JSON.stringify(data) }),

  // White-Label Institution Branding
  getOrgBranding: (org_id) => request(`/organizations/${org_id}/branding`),
  updateOrgBranding: (org_id, data) =>
    request(`/organizations/${org_id}/branding`, { method: "PUT", body: JSON.stringify(data) }),

  // Discount Coupons
  validateCoupon: (code, amount_inr) =>
    request("/plans/validate-coupon", { method: "POST", body: JSON.stringify({ code, amount_inr }) }),
  getPlatformCoupons: () => request("/platform/coupons"),
  createPlatformCoupon: (data) =>
    request("/platform/coupons", { method: "POST", body: JSON.stringify(data) }),
  deletePlatformCoupon: (coupon_id) =>
    request(`/platform/coupons/${coupon_id}`, { method: "DELETE" })
};
