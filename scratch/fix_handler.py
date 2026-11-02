with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = 'if (res) setPublicSiteSettings(res);'
replacement = 'if (res) setPublicSiteSettings(res.settings || res);'

if target in text:
    text = text.replace(target, replacement, 1)
    with open('frontend/src/platform/PlatformAdminPortal.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: Updated res.settings fallback!")
else:
    print("Target not found")

