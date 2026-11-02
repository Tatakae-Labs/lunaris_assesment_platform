with open('frontend/src/public/PublicWebsite.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Main container
c = c.replace(
    'return (\n    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>',
    'return (\n    <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)", overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>'
)

# 2. Announcement banner: flexWrap wrap
c = c.replace(
    '          display: "flex",\n          alignItems: "center",\n          justifyContent: "center",\n          gap: "10px",\n          zIndex: 60,',
    '          display: "flex",\n          alignItems: "center",\n          justifyContent: "center",\n          flexWrap: "wrap",\n          gap: "10px",\n          zIndex: 60,'
)

# 3. Sections: add overflow hidden
c = c.replace(
    '          {/* Stageshow Bento Grid: Balanced 5-Tile Architecture */}\n          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>',
    '          {/* Stageshow Bento Grid: Balanced 5-Tile Architecture */}\n          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", overflow: "hidden" }}>'
)
c = c.replace(
    '          {/* Hands-on Interactive Mode Demonstrator */}\n          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "#ffffff" }}>',
    '          {/* Hands-on Interactive Mode Demonstrator */}\n          <section style={{ borderTop: "1px solid var(--border-subtle)", background: "#ffffff", overflow: "hidden" }}>'
)

with open('frontend/src/public/PublicWebsite.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated PublicWebsite.jsx')

