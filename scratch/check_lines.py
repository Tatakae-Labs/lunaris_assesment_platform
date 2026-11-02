import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Line 210-220:")
for i in range(210, 222):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nLine 240-255:")
for i in range(240, 255):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nLine 740-750:")
for i in range(740, 750):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nLine 855-865:")
for i in range(855, 865):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nLine 2680-2688:")
for i in range(2680, 2688):
    print(f"{i+1}: {lines[i].rstrip()}")

