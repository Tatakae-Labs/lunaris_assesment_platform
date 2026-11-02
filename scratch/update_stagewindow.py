with open('frontend/src/stageshow/StageWindow.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    '{satellite && (\n        <div\n          style={{',
    '{satellite && (\n        <div\n          className="stageshow-satellite"\n          style={{'
)

with open('frontend/src/stageshow/StageWindow.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated StageWindow.jsx')

