with open('frontend/src/shared/api.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """  deleteOrgCandidate: (org_id, enrollment_id) =>
    request(`/organizations/${org_id}/candidates/${enrollment_id}`, { method: "DELETE" }),"""

replacement = """  deleteOrgCandidate: (org_id, enrollment_id) =>
    request(`/organizations/${org_id}/candidates/${enrollment_id}`, { method: "DELETE" }),
  bulkDeleteOrgCandidates: (org_id, candidate_ids) =>
    request(`/organizations/${org_id}/candidates/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ candidate_ids })
    }),"""

assert target in text, "target not found in api.js"
text = text.replace(target, replacement, 1)

with open('frontend/src/shared/api.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added bulkDeleteOrgCandidates to api.js")

