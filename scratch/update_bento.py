with open('frontend/src/stageshow/StageshowBentoGrid.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Add class to grid container
c = c.replace(
    '<div\n        style={{\n          display: "grid",\n          gridTemplateColumns: "repeat(12, 1fr)",',
    '<div\n        className="stageshow-bento-grid"\n        style={{\n          display: "grid",\n          gridTemplateColumns: "repeat(12, 1fr)",'
)

# Tile 1
c = c.replace(
    '{/* TILE 1: THE ONE WINDOW (CBT Solver, cropped and running off bottom-right edge) */}\n        {/* Spans 8 cols, 2 rows */}\n        <div\n          className="dash-card"',
    '{/* TILE 1: THE ONE WINDOW (CBT Solver, cropped and running off bottom-right edge) */}\n        {/* Spans 8 cols, 2 rows */}\n        <div\n          className="dash-card stageshow-bento-tile"'
)

# Tile 2
c = c.replace(
    '{/* TILE 2: THE ROLLING STAT (High contrast dark tile) */}\n        {/* Spans 4 cols */}\n        <div\n          style={{',
    '{/* TILE 2: THE ROLLING STAT (High contrast dark tile) */}\n        {/* Spans 4 cols */}\n        <div\n          className="stageshow-bento-tile"\n          style={{'
)

# Tile 3
c = c.replace(
    '{/* TILE 3: THE PHYSICAL OBJECT (Candidate Access Pass card with seal & barcode) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card"',
    '{/* TILE 3: THE PHYSICAL OBJECT (Candidate Access Pass card with seal & barcode) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card stageshow-bento-tile"'
)

# Tile 4
c = c.replace(
    '{/* TILE 4: THE DIAGRAM (MediaPipe On-Device Vision Radar) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card"',
    '{/* TILE 4: THE DIAGRAM (MediaPipe On-Device Vision Radar) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card stageshow-bento-tile"'
)

# Tile 5
c = c.replace(
    '{/* TILE 5: THE INTERACTIVE CONTROL (3-Mode Assessment Engine Switcher) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card"',
    '{/* TILE 5: THE INTERACTIVE CONTROL (3-Mode Assessment Engine Switcher) */}\n        {/* Spans 4 cols */}\n        <div\n          className="dash-card stageshow-bento-tile"'
)

with open('frontend/src/stageshow/StageshowBentoGrid.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated StageshowBentoGrid.jsx successfully')

