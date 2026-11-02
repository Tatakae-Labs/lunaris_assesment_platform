with open('frontend/src/stageshow/StageshowHeroDemo.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Screen body
c = c.replace(
    '<div style={{ height: "480px", background: step >= 3 ? "#0a0f1d" : "#f8fafc", position: "relative", overflow: "hidden", display: "flex" }}>',
    '<div className="stageshow-hero-screen-body" style={{ height: "480px", background: step >= 3 ? "#0a0f1d" : "#f8fafc", position: "relative", overflow: "hidden", display: "flex" }}>'
)

# 2. Step 0 & 1 Modal card
c = c.replace(
    '              <div\n                style={{\n                  maxWidth: "680px",\n                  width: "100%",',
    '              <div\n                className="stageshow-modal-card"\n                style={{\n                  maxWidth: "680px",\n                  width: "100%",'
)

# 3. Step 3 CBT Header
c = c.replace(
    '              {/* Top Banner (Standard Assessment Header) */}\n              <header style={{\n                height: "50px",',
    '              {/* Top Banner (Standard Assessment Header) */}\n              <header className="stageshow-cbt-header" style={{\n                height: "50px",'
)

# 4. Step 3 Split Body
c = c.replace(
    '              {/* Main Body Split: Question View & Palette + Proctor Bubble */}\n              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>\n                {/* Left: Question Viewer */}\n                <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflowY: "auto" }}>',
    '              {/* Main Body Split: Question View & Palette + Proctor Bubble */}\n              <div className="stageshow-cbt-split" style={{ display: "flex", flex: 1, overflow: "hidden" }}>\n                {/* Left: Question Viewer */}\n                <div className="stageshow-cbt-left" style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflowY: "auto" }}>'
)

# 5. Step 3 Right Palette
c = c.replace(
    '                {/* Right Side: Proctor Bubble + Item Status Palette */}\n                <div style={{ width: "260px", display: "flex", flexDirection: "column", height: "100%", borderLeft: "1e293b"',
    '                {/* Right Side: Proctor Bubble + Item Status Palette */}\n                <div className="stageshow-cbt-right" style={{ width: "260px", display: "flex", flexDirection: "column", height: "100%", borderLeft: "1e293b"'
)
# (Fallback if borderLeft had #1e293b)
c = c.replace(
    '{/* Right Side: Proctor Bubble + Item Status Palette */}\n                <div style={{ width: "260px", display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid #1e293b" }}>',
    '{/* Right Side: Proctor Bubble + Item Status Palette */}\n                <div className="stageshow-cbt-right" style={{ width: "260px", display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid #1e293b" }}>'
)

# 6. Step 3 Footer controls
c = c.replace(
    '                  {/* Standard CBT Action Controls Footer */}\n                  <div style={{\n                    display: "flex",\n                    justifyContent: "space-between",',
    '                  {/* Standard CBT Action Controls Footer */}\n                  <div className="stageshow-cbt-footer" style={{\n                    display: "flex",\n                    justifyContent: "space-between",'
)

# 7. Step 4 Scorecard grid
c = c.replace(
    '                {/* Score breakdown metrics (UI Skills: Tabular Nums) */}\n                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>',
    '                {/* Score breakdown metrics (UI Skills: Tabular Nums) */}\n                <div className="stageshow-scorecard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>'
)

# 8. Step Scrubber Pills
c = c.replace(
    '            <button\n              key={s.id}\n              type="button"\n              onClick={() => {',
    '            <button\n              key={s.id}\n              type="button"\n              className="stageshow-step-pill"\n              onClick={() => {'
)

with open('frontend/src/stageshow/StageshowHeroDemo.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated StageshowHeroDemo.jsx successfully')

