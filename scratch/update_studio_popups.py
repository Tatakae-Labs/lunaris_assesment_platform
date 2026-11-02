with open('frontend/src/organization/AiQuestionStudio.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states for bulk approve confirm and clear confirm
old_state = '  const [bulkApproving, setBulkApproving] = useState(false);'
new_state = '''  const [bulkApproving, setBulkApproving] = useState(false);
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);'''

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("Added studio confirmation states")

# 2. Update handleBulkApprove & handleClearAllDrafts
old_bulk = '''  async function handleBulkApprove() {
    if (filteredDrafts.length === 0) return;
    if (!window.confirm(`Approve all ${filteredDrafts.length} filtered drafts into the active Question Bank?`)) {
      return;
    }
    setBulkApproving(true);
    try {
      const ids = filteredDrafts.map((d) => d.id);
      const res = await api.bulkApproveAiDrafts(organizationId, ids);
      toast.success(res.message || `Approved ${ids.length} questions into Question Bank!`);
      await loadDrafts();
      if (onQuestionApproved) onQuestionApproved();
    } catch (err) {
      toast.error("Bulk approval failed: " + err.message);
    } finally {
      setBulkApproving(false);
    }
  }'''

new_bulk = '''  async function confirmBulkApproveAction() {
    if (filteredDrafts.length === 0) return;
    setBulkApproving(true);
    try {
      const ids = filteredDrafts.map((d) => d.id);
      const res = await api.bulkApproveAiDrafts(organizationId, ids);
      toast.success(res.message || `Approved ${ids.length} questions into Question Bank!`);
      setShowBulkApproveConfirm(false);
      await loadDrafts();
      if (onQuestionApproved) onQuestionApproved();
    } catch (err) {
      toast.error("Bulk approval failed: " + err.message);
    } finally {
      setBulkApproving(false);
    }
  }

  function handleBulkApprove() {
    if (filteredDrafts.length === 0) return;
    setShowBulkApproveConfirm(true);
  }'''

if old_bulk in content:
    content = content.replace(old_bulk, new_bulk, 1)
    print("Replaced handleBulkApprove")

old_clear = '''  async function handleClearAllDrafts() {
    if (!window.confirm("Permanently clear all AI-generated drafts? Approved questions in your active Question Bank will remain safe.")) {
      return;
    }
    try {
      await api.clearAiDrafts(organizationId);
      setDrafts([]);
      toast.success("All pending drafts cleared");
    } catch (err) {
      toast.error("Failed to clear drafts: " + err.message);
    }
  }'''

new_clear = '''  async function confirmClearAllDraftsAction() {
    setClearingDrafts(true);
    try {
      await api.clearAiDrafts(organizationId);
      setDrafts([]);
      setShowClearConfirm(false);
      toast.success("All pending drafts cleared");
    } catch (err) {
      toast.error("Failed to clear drafts: " + err.message);
    } finally {
      setClearingDrafts(false);
    }
  }

  function handleClearAllDrafts() {
    setShowClearConfirm(true);
  }'''

if old_clear in content:
    content = content.replace(old_clear, new_clear, 1)
    print("Replaced handleClearAllDrafts")

# 3. Insert Popups at the end before </div>\n  );
popups_jsx = '''
      {/* Bulk Approve Confirmation Popup */}
      {showBulkApproveConfirm && (
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
          onClick={() => !bulkApproving && setShowBulkApproveConfirm(false)}
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
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <CheckIcon size={22} color="var(--accent-blue)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Approve All Filtered Drafts?
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  This will approve and add <strong>{filteredDrafts.length}</strong> questions directly into your active Question Bank.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={bulkApproving}
                onClick={() => setShowBulkApproveConfirm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: bulkApproving ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkApproving}
                onClick={confirmBulkApproveAction}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent-blue)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: bulkApproving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {bulkApproving ? "Approving..." : `Approve ${filteredDrafts.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Drafts Confirmation Popup */}
      {showClearConfirm && (
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
          onClick={() => !clearingDrafts && setShowClearConfirm(false)}
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Clear All AI Question Drafts?
                </h3>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.55 }}>
                  Are you sure you want to permanently clear all {drafts.length} AI-generated drafts?
                </p>
                <div style={{ marginTop: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "#64748b" }}>
                  Questions already approved into your active Question Bank will remain safe and unaffected.
                </div>
              </div>
            </div>

            <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={clearingDrafts}
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: clearingDrafts ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingDrafts}
                onClick={confirmClearAllDraftsAction}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: clearingDrafts ? "not-allowed" : "pointer"
                }}
              >
                {clearingDrafts ? "Clearing..." : "Clear Drafts"}
              </button>
            </div>
          </div>
        </div>
      )}
'''

last_div_idx = content.rfind('</div>')
content = content[:last_div_idx] + popups_jsx + content[last_div_idx:]

with open('frontend/src/organization/AiQuestionStudio.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished updating AiQuestionStudio.jsx")

