import re

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'\{activeView === ["\']([a-zA-Z0-9_]+)["\'] &&', text):
    line_no = text[:m.start()].count('\n') + 1
    print(f"View {m.group(1)} at line {line_no}")

for m in re.finditer(r'\{[a-zA-Z0-9_]+ && \(', text):
    line_no = text[:m.start()].count('\n') + 1
    print(f"Conditional at line {line_no}: {m.group(0)}")

