export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api/v1`
    : "http://localhost:8000/api/v1");

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("lunaris_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || "Request failed");
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
  login: (email, password, captcha_id = null, captcha_solution = null) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, captcha_id, captcha_solution })
    }),
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getProfile: () => request("/auth/me"),

  // Organizations & Workspace
  createOrganization: (name) => request("/organizations", { method: "POST", body: JSON.stringify({ name }) }),
  getMyOrganizations: () => request("/organizations/my"),
  inviteMember: (org_id, email, role) =>
    request(`/organizations/${org_id}/members`, { method: "POST", body: JSON.stringify({ email, role }) }),
  getOrgMembers: (org_id) => request(`/organizations/${org_id}/members`),
  getOrgInviteCode: (org_id) => request(`/organizations/${org_id}/invite-code`),
  joinOrganization: (invite_code) =>
    request("/organizations/join", { method: "POST", body: JSON.stringify({ invite_code }) }),
  getOrgUsage: (org_id) => request(`/organizations/${org_id}/usage`),
  removeOrgMember: (org_id, member_id) =>
    request(`/organizations/${org_id}/members/${member_id}`, { method: "DELETE" }),

  // Universal Curriculum & Custom Subjects
  getOrgSubjects: (org_id) => request(`/organizations/${org_id}/subjects`),
  createOrgSubject: (org_id, data) => request(`/organizations/${org_id}/subjects`, { method: "POST", body: JSON.stringify(data) }),
  updateOrgSubject: (org_id, subject_id, data) => request(`/organizations/${org_id}/subjects/${subject_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrgSubject: (org_id, subject_id) => request(`/organizations/${org_id}/subjects/${subject_id}`, { method: "DELETE" }),
  seedOrgSubjectPack: (org_id, pack_name) => request(`/organizations/${org_id}/subjects/seed-pack?pack_name=${pack_name}`, { method: "POST" }),

  // Question Bank
  createQuestion: (data) => request("/questions", { method: "POST", body: JSON.stringify(data) }),
  getQuestions: (org_id, subject = "") =>
    request(`/questions?organization_id=${org_id}${subject ? `&subject=${subject}` : ""}`),

  // AI Question Generation
  generateAiQuestions: (data) => request("/ai/generate-questions", { method: "POST", body: JSON.stringify(data) }),
  getAiDrafts: (org_id) => request(`/ai/drafts?organization_id=${org_id}`),
  approveAiDraft: (draft_id) => request(`/ai/drafts/${draft_id}/approve`, { method: "POST" }),
  rejectAiDraft: (draft_id) => request(`/ai/drafts/${draft_id}/reject`, { method: "POST" }),

  // Exams & Publishing
  createExam: (data) => request("/exams", { method: "POST", body: JSON.stringify(data) }),
  getExams: (org_id) => request(`/exams?organization_id=${org_id}`),
  getExam: (exam_id) => request(`/exams/${exam_id}`),
  updateExam: (exam_id, data) => request(`/exams/${exam_id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (exam_id) => request(`/exams/${exam_id}`, { method: "DELETE" }),
  publishExam: (exam_id) => request(`/exams/${exam_id}/publish`, { method: "POST" }),
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
  sendCandidateStreamFrame: (session_token, frame_base64) =>
    request("/candidate/stream-frame", {
      method: "POST",
      headers: { Authorization: `Bearer ${session_token}` },
      body: JSON.stringify({ frame_base64 })
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

  // Seed JEE Demo
  seedDemo: () => request("/seed/jee-demo", { method: "POST" })
};
