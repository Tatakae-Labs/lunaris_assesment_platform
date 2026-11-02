with open('frontend/src/public/PublicWebsite.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    l_strip = l.strip()
    if any(k in l_strip for k in ['activeTab === "features"', 'activeTab === "pricing"', 'activeTab === "login"', 'activeTab === "register"']):
        print(f'Tab block at L{i+1}: {l_strip}')
    if 'footer' in l_strip.lower() and ('<' in l_strip or 'className' in l_strip):
        print(f'Footer at L{i+1}: {l_strip}')
    if 'public_stats' in l_strip or 'publicStats' in l_strip:
        if '<' in l_strip:
            print(f'Stats section at L{i+1}: {l_strip}')

