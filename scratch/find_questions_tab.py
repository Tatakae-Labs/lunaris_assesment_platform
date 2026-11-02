with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '{activeTab === "questions" &&' in l:
        if i > 1400:
            for j in range(i, min(i+40, len(lines))):
                print(f'{j+1}: {lines[j].rstrip()}')
            break
