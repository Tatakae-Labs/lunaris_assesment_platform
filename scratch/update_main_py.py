with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = [l for l in lines if '@app.post("/api/v1/seed/jee-demo")' not in l]

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Cleaned up @app.post('/api/v1/seed/jee-demo')")
