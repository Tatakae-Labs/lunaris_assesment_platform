with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('        "https://backendsolpay.rugveddev.tech",\n        "http://backendsolpay.rugveddev.tech",\n', '')
text = text.replace('rugveddev.tech|', '')

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Cleaned main.py CORS!")

