import os, re

files = []
for base in ['frontend/src', 'backend/app']:
    for root, dirs, fnames in os.walk(base):
        for f in fnames:
            if f.endswith(('.jsx', '.js', '.py')):
                files.append(os.path.join(root, f))

pattern = re.compile(r'\b(jee|nta|neet)\b', re.IGNORECASE)

matches_by_file = {}
for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            m = pattern.findall(line)
            if m:
                if path not in matches_by_file:
                    matches_by_file[path] = []
                matches_by_file[path].append((i+1, set(m), line.strip()))

for p, items in matches_by_file.items():
    print(f"\n{p} ({len(items)} matches):")
    for lno, terms, text in items[:6]:
        print(f"  L{lno}: {ascii(text[:100])}")
    if len(items) > 6:
        print(f"  ... and {len(items)-6} more")
