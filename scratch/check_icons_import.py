import os, re

pattern = re.compile(r'<([A-Z][A-Za-z0-9]*Icon)\b')

for root, _, files in os.walk('frontend/src'):
    for f in files:
        if f.endswith('.jsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            icons_used = set(pattern.findall(content))
            if icons_used:
                has_import = "shared/Icons" in content or "shared\\Icons" in content or f == "Icons.jsx"
                print(f"{path}:")
                print(f"  Icons used: {len(icons_used)} -> {icons_used}")
                print(f"  Has Icons import: {has_import}")
                if not has_import:
                    print("  *** MISSING IMPORT! ***")

