import re

with open('frontend/src/organization/CandidateCapacityModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add popup state
old_state = '  // Manual Candidate Quick-Enroll State'
new_state = '''  // Revoke Candidate Confirmation Popup State
  const [candidateToRevoke, setCandidateToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Manual Candidate Quick-Enroll State'''

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("Added popup state")

# 2. Replace handleDeleteCandidate
if 'async function handleDeleteCandidate' in content:
    idx1 = content.find('async function handleDeleteCandidate')
    idx2 = content.find('async function handleQuickEnroll', idx1)
    new_block = '''  function handlePromptRevoke(candidate) {
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

'''
    content = content[:idx1] + new_block + content[idx2:]
    print("Replaced handleDeleteCandidate function")

# 3. Replace trash button onClick
old_btn = 'onClick={() => handleDeleteCandidate(c.id, c.candidate_uid)}'
new_btn = 'onClick={() => handlePromptRevoke(c)}'
if old_btn in content:
    content = content.replace(old_btn, new_btn)
    print("Replaced trash button onClick")

# 4. Insert popup JSX
popup_jsx = '''
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
'''

last_div_idx = content.rfind('</div>')
content = content[:last_div_idx] + popup_jsx + content[last_div_idx:]
print("Inserted popup JSX")

with open('frontend/src/organization/CandidateCapacityModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished writing file")

