import os

# 1. Update backend/app/exams/router.py
with open('backend/app/exams/router.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'exam_link = f"https://backendsolpay.rugveddev.tech/candidate/entry?room={exam.room_code}&exam_id={exam.id}"',
    'frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")\n                exam_link = f"{frontend_url}/candidate-login?room={exam.room_code}"'
)
text = text.replace(
    'pdf_url = f"https://backendsolpay.rugveddev.tech/api/v1/exams/{exam.id}/credentials-pdf"',
    'api_url_base = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")\n                pdf_url = f"{api_url_base}/api/v1/exams/{exam.id}/credentials-pdf"'
)

with open('backend/app/exams/router.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated backend/app/exams/router.py")

# 2. Update backend/app/exams/credentials_pdf.py
with open('backend/app/exams/credentials_pdf.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'portal_url: str = "https://backendsolpay.rugveddev.tech/candidate/entry"',
    'portal_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") + "/candidate-login"'
)

with open('backend/app/exams/credentials_pdf.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated backend/app/exams/credentials_pdf.py")

# 3. Update backend/app/core/email.py
with open('backend/app/core/email.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'https://backendsolpay.rugveddev.tech/dashboard?tab=billing',
    'http://localhost:5173/dashboard?tab=billing'
)

with open('backend/app/core/email.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated backend/app/core/email.py")

# 4. Update frontend/src/organization/OrgDashboard.jsx
with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'https://backendsolpay.rugveddev.tech/candidate/entry',
    '${window.location.origin}/candidate-login'
)

# Add classroomUploadFileMime state if missing
if 'const [classroomUploadFileMime, setClassroomUploadFileMime]' not in text:
    state_target = 'const [classroomUploadFileName, setClassroomUploadFileName] = useState("");'
    state_replacement = '''const [classroomUploadFileName, setClassroomUploadFileName] = useState("");
  const [classroomUploadFileMime, setClassroomUploadFileMime] = useState("application/pdf");'''
    text = text.replace(state_target, state_replacement, 1)

# In handleClassroomFileSelect:
file_select_target = '''    setClassroomUploadFileName(file.name);
    if (!classroomUploadTitle.trim()) {'''
file_select_replacement = '''    setClassroomUploadFileName(file.name);
    setClassroomUploadFileMime(file.type || "application/octet-stream");
    if (!classroomUploadTitle.trim()) {'''
text = text.replace(file_select_target, file_select_replacement, 1)

# In handleUploadDirectToClassroom:
upload_submit_target = '''        file_content_base64: classroomUploadFileBase64 || undefined,
        file_name: classroomUploadFileName || undefined,
        file_mime_type: "application/pdf"'''
upload_submit_replacement = '''        file_content_base64: classroomUploadFileBase64 || undefined,
        file_name: classroomUploadFileName || undefined,
        file_mime_type: classroomUploadFileMime || "application/pdf"'''
text = text.replace(upload_submit_target, upload_submit_replacement, 1)

with open('frontend/src/organization/OrgDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated frontend/src/organization/OrgDashboard.jsx")

