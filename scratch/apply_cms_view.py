import sys

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state after const [savingPayments, setSavingPayments] = useState(false);
state_target = '  const [savingPayments, setSavingPayments] = useState(false);'
state_insert = '''  const [savingPayments, setSavingPayments] = useState(false);
  const [publicSiteSettings, setPublicSiteSettings] = useState({
    announcement_active: false,
    announcement_text: "",
    announcement_link: "",
    site_headline: "All-in-one assessment engine with on-device anti-cheat",
    site_subtitle: "Conduct NTA-style computer-based tests, buzzer quick quizzes, and auto-graded assessments with real-time video invigilation.",
    contact_email: "support@lunaris.com",
    support_phone: "+91 98765 43210",
    platform_status: "Operational"
  });
  const [savingPublicSite, setSavingPublicSite] = useState(false);'''

if state_target not in content:
    print("ERROR: state_target not found!")
    sys.exit(1)

content = content.replace(state_target, state_insert, 1)

# 2. Add loadViewData condition for public_site
load_target = '''      } else if (activeView === "admin_team") {
        await loadAdminTeam();
      }'''
load_insert = '''      } else if (activeView === "admin_team") {
        await loadAdminTeam();
      } else if (activeView === "public_site") {
        const s = await api.getPublicSiteSettings().catch(() => null);
        if (s) setPublicSiteSettings(s);
        const p = await api.getPlatformPlans().catch(() => []);
        setPlans(p);
      }'''

if load_target not in content:
    print("ERROR: load_target not found!")
    sys.exit(1)

content = content.replace(load_target, load_insert, 1)

# 3. Add handleSavePublicSiteSettings function
func_target = '  // Load audit logs with pagination & filtering'
func_insert = '''  async function handleSavePublicSiteSettings(e) {
    if (e) e.preventDefault();
    setSavingPublicSite(true);
    setActionNotice("");
    try {
      const res = await api.updatePublicSiteSettings(publicSiteSettings);
      if (res) setPublicSiteSettings(res);
      setActionNotice("Public website settings saved and published successfully.");
      setTimeout(() => setActionNotice(""), 4000);
    } catch (err) {
      alert("Failed to save public site settings: " + (err.message || "Unknown error"));
    } finally {
      setSavingPublicSite(false);
    }
  }

  // Load audit logs with pagination & filtering'''

if func_target not in content:
    print("ERROR: func_target not found!")
    sys.exit(1)

content = content.replace(func_target, func_insert, 1)

# 4. Add nav item
nav_target = '{ id: "admin_team", label: "Admin Team & RBAC", icon: "👥" },'
nav_insert = '''{ id: "admin_team", label: "Admin Team & RBAC", icon: "👥" },
            { id: "public_site", label: "Public Website CMS", icon: "🌐" },'''

if nav_target not in content:
    print("ERROR: nav_target not found!")
    sys.exit(1)

content = content.replace(nav_target, nav_insert, 1)

# 5. Add header title
title_target = '{activeView === "admin_team" && "Administration Team & Role-Based Access Control (RBAC)"}'
title_insert = '''{activeView === "admin_team" && "Administration Team & Role-Based Access Control (RBAC)"}
              {activeView === "public_site" && "Public Website CMS, Announcement Banner & Live Settings"}'''

if title_target not in content:
    print("ERROR: title_target not found!")
    sys.exit(1)

content = content.replace(title_target, title_insert, 1)

# 6. Add public_site view after activeView === "admin_team" block
admin_view_end_target = '''                </tbody>
              </table>
            </div>
          </div>
        )}'''

public_site_view = '''                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* VIEW: PUBLIC WEBSITE CMS & SETTINGS                        */}
        {/* ────────────────────────────────────────────────────────── */}
        {activeView === "public_site" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Informational Banner */}
            <div style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px"
            }}>
              <div>
                <div style={{ fontWeight: "700", color: "#1e40af", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🌐</span> SuperAdmin to Public Site Live Synchronization
                </div>
                <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "4px" }}>
                  Changes configured here update the public landing page in real time. Plans and pricing edited in the <strong>Plans & Feature Quotas</strong> tab also reflect immediately on the public pricing table and registration portal.
                </div>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "700",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(37,99,235,0.2)"
                }}
              >
                View Live Site ↗
              </a>
            </div>

            {/* CMS Form Card */}
            <form onSubmit={handleSavePublicSiteSettings} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* 1. Announcement Banner */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                      📢 Announcement Banner
                    </h3>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "3px 0 0 0" }}>
                      Displays a dismissible notification bar pinned to the top of the entire public website.
                    </p>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(publicSiteSettings.announcement_active)}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_active: e.target.checked }))}
                      style={{ width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: publicSiteSettings.announcement_active ? "#16a34a" : "#64748b" }}>
                      {publicSiteSettings.announcement_active ? "Banner Active" : "Banner Hidden"}
                    </span>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Announcement Text
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.announcement_text || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_text: e.target.value }))}
                      placeholder="e.g. 🚀 Lunaris v2.4 released with AI Question Generation & NTA Exam Simulation!"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Action Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.announcement_link || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, announcement_link: e.target.value }))}
                      placeholder="e.g. /#pricing or https://..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                {/* Banner Live Preview */}
                {publicSiteSettings.announcement_active && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>
                      Live Preview (How visitors will see it)
                    </div>
                    <div style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}>
                      <span>{publicSiteSettings.announcement_text || "Announcement text will appear here"}</span>
                      {publicSiteSettings.announcement_link && (
                        <span style={{ textDecoration: "underline", opacity: 0.9 }}>Learn more →</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Landing Page Copy */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0" }}>
                  ✨ Hero Headline & Platform Description
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
                  Controls the primary headline and value proposition displayed in the hero section on the homepage.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Main Headline
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.site_headline || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, site_headline: e.target.value }))}
                      placeholder="All-in-one assessment engine with on-device anti-cheat"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Subtitle & Value Proposition
                    </label>
                    <textarea
                      rows={3}
                      value={publicSiteSettings.site_subtitle || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, site_subtitle: e.target.value }))}
                      placeholder="Conduct NTA-style computer-based tests, buzzer quick quizzes, and auto-graded assessments with real-time video invigilation."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        lineHeight: "1.5",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Support & Contact Details */}
              <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0" }}>
                  📞 Public Support & System Status
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0" }}>
                  Contact coordinates and operational status displayed in the public footer and support links.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={publicSiteSettings.contact_email || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="support@lunaris.com"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Support Hotline / Phone
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.support_phone || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, support_phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Platform Status Label
                    </label>
                    <input
                      type="text"
                      value={publicSiteSettings.platform_status || ""}
                      onChange={e => setPublicSiteSettings(prev => ({ ...prev, platform_status: e.target.value }))}
                      placeholder="Operational"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        color: "#0f172a",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Plans & Pricing Sync Summary */}
              <div style={{
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px"
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>💳</span> Dynamic Plans & Pricing ({plans.length} active plans configured)
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    Plans edited in the SuperAdmin portal automatically propagate to public pricing cards, feature comparisons, and registration selectors without code rebuilds.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView("plans")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#334155",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Edit Plans & Pricing →
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button
                  type="submit"
                  disabled={savingPublicSite}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "8px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: savingPublicSite ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.25)"
                  }}
                >
                  {savingPublicSite ? "Publishing Changes..." : "Save & Publish to Public Site"}
                </button>
              </div>
            </form>
          </div>
        )}'''

if admin_view_end_target not in content:
    print("ERROR: admin_view_end_target not found!")
    sys.exit(1)

content = content.replace(admin_view_end_target, public_site_view, 1)

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Updated PlatformAdminPortal.jsx with Public Website CMS view!")

