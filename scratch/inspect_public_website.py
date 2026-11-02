import re

for filename in [
    'frontend/src/stageshow/StageshowHeroDemo.jsx',
    'frontend/src/stageshow/StageshowBentoGrid.jsx',
    'frontend/src/stageshow/InteractiveModeDemos.jsx',
    'frontend/src/public/PublicWebsite.jsx'
]:
    with open(filename, 'r', encoding='utf-8') as f:
        t = f.read()
    fw = re.findall(r'(?:minWidth|width|maxWidth)\s*:\s*["\']([0-9]{3,4}px)["\']', t)
    grids = re.findall(r'gridTemplateColumns\s*:\s*["\']([^"\']+)["\']', t)
    medias = re.findall(r'@media[^{]+', t)
    print(f'=== {filename} ===')
    print('  Fixed widths:', set(fw))
    print('  Grid templates:', set(grids))
    print('  Media queries count:', len(medias))
