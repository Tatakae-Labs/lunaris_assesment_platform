with open('frontend/src/organization/ExamCreationWizard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_scopes = 'scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/drive.file",'
new_scopes = '''scope: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.coursework.students",
        "https://www.googleapis.com/auth/classroom.coursework.me",
        "https://www.googleapis.com/auth/classroom.announcements",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" "),'''

if old_scopes in text:
    text = text.replace(old_scopes, new_scopes, 1)
    with open('frontend/src/organization/ExamCreationWizard.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: Updated ExamCreationWizard.jsx scopes!")
else:
    print("Scopes already updated or not found in ExamCreationWizard.jsx")

