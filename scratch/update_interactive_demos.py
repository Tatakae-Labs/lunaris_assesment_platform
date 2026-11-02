with open('frontend/src/stageshow/InteractiveModeDemos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Top Tabs Pill container
c = c.replace(
    '        <div\n          style={{\n            display: "inline-flex",\n            background: "#f1f5f9",',
    '        <div\n          className="interactive-tabs-container"\n          style={{\n            display: "inline-flex",\n            background: "#f1f5f9",'
)

# 2. CBT Header
c = c.replace(
    '          {/* Top Banner (Identical to JeeExamPortal.jsx) */}\n          <div\n            style={{',
    '          {/* Top Banner (Identical to JeeExamPortal.jsx) */}\n          <div\n            className="interactive-cbt-header"\n            style={{'
)

# 3. CBT Split & Palette
c = c.replace(
    '          {/* Main Body: Question Viewer (Left) & Palette + Proctor Bubble (Right) */}\n          <div style={{ display: "flex", minHeight: "360px" }}>',
    '          {/* Main Body: Question Viewer (Left) & Palette + Proctor Bubble (Right) */}\n          <div className="interactive-cbt-split" style={{ display: "flex", minHeight: "360px" }}>'
)
c = c.replace(
    '            {/* Right Status Palette & Video Bubble */}\n            <div style={{ width: "280px", borderLeft: "1px solid #1e293b", background: "#0b1329", display: "flex", flexDirection: "column" }}>',
    '            {/* Right Status Palette & Video Bubble */}\n            <div className="interactive-cbt-palette" style={{ width: "280px", borderLeft: "1px solid #1e293b", background: "#0b1329", display: "flex", flexDirection: "column" }}>'
)

# 4. AI Studio Header & Controls
c = c.replace(
    '          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>\n            <div>\n              <span style={{ fontSize: "11px", fontWeight: "800", color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: "4px" }}>\n                AI QUESTION STUDIO',
    '          <div className="interactive-ai-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>\n            <div>\n              <span style={{ fontSize: "11px", fontWeight: "800", color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: "4px" }}>\n                AI QUESTION STUDIO'
)
c = c.replace(
    '            <div style={{ display: "flex", gap: "8px" }}>\n              <select\n                value={aiTopic}',
    '            <div className="interactive-ai-controls" style={{ display: "flex", gap: "8px" }}>\n              <select\n                value={aiTopic}'
)

# 5. Proctor Header & Controls & Split
c = c.replace(
    '          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>\n            <div>\n              <span style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", background: "#fee2e2", padding: "3px 8px", borderRadius: "4px" }}>\n                LIVE INTEGRITY CONSOLE',
    '          <div className="interactive-ai-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>\n            <div>\n              <span style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", background: "#fee2e2", padding: "3px 8px", borderRadius: "4px" }}>\n                LIVE INTEGRITY CONSOLE'
)
c = c.replace(
    '            <div style={{ display: "flex", gap: "8px" }}>\n              <button\n                type="button"\n                onClick={() => simulateProctorIncident("head_turn")',
    '            <div className="interactive-ai-controls" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>\n              <button\n                type="button"\n                onClick={() => simulateProctorIncident("head_turn")'
)
c = c.replace(
    '          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>',
    '          <div className="interactive-proctor-split" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>'
)

with open('frontend/src/stageshow/InteractiveModeDemos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated InteractiveModeDemos.jsx successfully')

