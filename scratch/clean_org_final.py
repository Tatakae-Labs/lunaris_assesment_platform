with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# L641 invite email template
text = text.replace('🔑 Activation Key:', 'Activation Key:')
text = text.replace('🌐 Portal URL:', 'Portal URL:')
# L982
text = text.replace('🏛️', '')
text = text.replace('🏛', '')
# L1741, L2023, L3291
text = text.replace('\u2715', '')
# L2729, L2730
text = text.replace('🛡️ AI Proctored Examination', 'AI Proctored Examination')
text = text.replace('📝 Standard Assessment', 'Standard Assessment')
# L2759
text = text.replace('<div style={{ fontSize: "42px", marginBottom: "8px" }}>⚡</div>', '<div style={{ marginBottom: "8px" }}><ZapIcon size={36} color="var(--accent-blue)" /></div>')
# L3275
text = text.replace('🎓', '')
# L3920
text = text.replace('<span style={{ fontSize: "20px" }}>✏️</span>', '<EditIcon size={18} />')
text = text.replace('<span style={{ fontSize: "20px" }}>✏</span>', '<EditIcon size={18} />')
text = text.replace('✏️', '')
text = text.replace('✏', '')
text = text.replace('⚡', '')
text = text.replace('🛡️', '')
text = text.replace('🛡', '')
text = text.replace('📝', '')
text = text.replace('🔑', '')
text = text.replace('🌐', '')
text = text.replace('🎓', '')

with open('frontend/src/organization/OrgDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Cleaned remaining in OrgDashboard.jsx!")

