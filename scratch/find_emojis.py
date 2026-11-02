import os, re

emoji_pattern = re.compile(
    r'[\U00010000-\U0010ffff]|'
    r'[\u2600-\u27bf]|'
    r'[\u2300-\u23ff]|'
    r'[\u2b50-\u2b55]|'
    r'[\u203c-\u2049]'
)

results = {}

for root, _, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                lines = file.readlines()
                for i, line in enumerate(lines):
                    emojis = emoji_pattern.findall(line)
                    if emojis:
                        if path not in results:
                            results[path] = []
                        results[path].append((i+1, ''.join(set(emojis)), line.strip()[:80]))

for p, matches in results.items():
    print(f"\n{p} ({len(matches)} occurrences):")
    for lno, em, text in matches[:10]:
        print(f"  L{lno} [{ascii(em)}]: {ascii(text)}")
    if len(matches) > 10:
        print(f"  ... and {len(matches)-10} more")

