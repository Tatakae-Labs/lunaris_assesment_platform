with open('frontend/src/shared/api.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update headers in request to support FormData
old_req = """export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("lunaris_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };"""

new_req = """export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("lunaris_token");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };"""

c = c.replace(old_req, new_req)

# 2. Add Candidate Capacity and File Ingestion methods
target = '  getOrgUsage: (org_id) => request(`/organizations/${org_id}/usage`),'
replacement = """  getOrgUsage: (org_id) => request(`/organizations/${org_id}/usage`),
  getOrgCandidates: (org_id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/organizations/${org_id}/candidates${qs ? `?${qs}` : ""}`);
  },
  updateOrgCapacity: (org_id, max_candidates) =>
    request(`/organizations/${org_id}/capacity`, { method: "PUT", body: JSON.stringify({ max_candidates }) }),
  addOrgCandidate: (org_id, candidateData) =>
    request(`/organizations/${org_id}/candidates`, { method: "POST", body: JSON.stringify(candidateData) }),
  deleteOrgCandidate: (org_id, enrollment_id) =>
    request(`/organizations/${org_id}/candidates/${enrollment_id}`, { method: "DELETE" }),"""

c = c.replace(target, replacement)

# 3. Add bulkApproveAiDrafts and ingestQuestionFile
ai_target = '  clearAiDrafts: (org_id) => request(`/ai/drafts/bulk/clear?organization_id=${org_id}`, { method: "DELETE" }),'
ai_replacement = """  clearAiDrafts: (org_id) => request(`/ai/drafts/bulk/clear?organization_id=${org_id}`, { method: "DELETE" }),
  bulkApproveAiDrafts: (organization_id, draft_ids = []) =>
    request("/ai/drafts/bulk-approve", { method: "POST", body: JSON.stringify({ organization_id, draft_ids }) }),
  ingestQuestionFile: (formData) =>
    request("/ai/ingest-file", { method: "POST", body: formData }),"""

c = c.replace(ai_target, ai_replacement)

with open('frontend/src/shared/api.js', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated frontend/src/shared/api.js')

