import os, json
import sys
sys.path.insert(0, os.path.abspath('backend'))
from app.core.database import SessionLocal
from app.models import SystemSetting

def update_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for t, r in replacements:
        text = text.replace(t, r)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Updated {path}")

# 1. CandidateEntryPortal.jsx
update_file('frontend/src/candidate/CandidateEntryPortal.jsx', [
    ('{isStandardQuiz ? "\U0001f4dd Standard Practice Quiz" : "\U0001f6e1\ufe0f NTA Proctored CBT"}',
     '{isStandardQuiz ? "Standard Practice Quiz" : "Proctored Computer-Based Assessment"}'),
    ('NTA Proctored CBT', 'Proctored Computer-Based Assessment')
])

# 2. PreflightModal.jsx
update_file('frontend/src/candidate/PreflightModal.jsx', [
    ('<strong>NTA JEE Exam Rules:</strong>', '<strong>Assessment Integrity Rules:</strong>')
])

# 3. AiQuestionStudio.jsx
update_file('frontend/src/organization/AiQuestionStudio.jsx', [
    ('Synthesize JEE-aligned single MCQs and numerical value questions (NVQs) with human review prior to publication.',
     'Synthesize curriculum-aligned multiple choice and numerical value questions (NVQs) with human review prior to publication.')
])

# 4. OrgDashboard.jsx
update_file('frontend/src/organization/OrgDashboard.jsx', [
    ('Multi-tenant assessment workspace with automated anti-cheat, NTA computer-based testing, and real-time proctoring.',
     'Multi-tenant specialized assessment workspace with automated anti-cheat, secure computer-based testing, and real-time proctoring.')
])

# 5. PlatformAdminPortal.jsx
update_file('frontend/src/platform/PlatformAdminPortal.jsx', [
    ('<span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>NTA PROCTORED CBT</span>',
     '<span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>PROCTORED CBT ASSESSMENTS</span>')
])

# 6. PublicWebsite.jsx
update_file('frontend/src/public/PublicWebsite.jsx', [
    ('{siteSettings.site_subtitle || "Author JEE-standard tests, sync rosters from Google Classroom, and proctor candidates with zero student accounts required."}',
     '{siteSettings.site_subtitle || "Author institutional assessments, sync rosters from Google Classroom, and proctor candidates with zero student accounts required."}'),
    ('Generate JEE-standard Single MCQ, Multiple MCQ, and Numerical questions across Physics, Chemistry,\n                and Mathematics in seconds.',
     'Generate curriculum-aligned Single MCQ, Multiple MCQ, and Numerical questions across STEM, Technical,\n                and Academic disciplines in seconds.')
])

# 7. StageshowBentoGrid.jsx
update_file('frontend/src/stageshow/StageshowBentoGrid.jsx', [
    ('deliver NTA-standard computer based assessments', 'deliver institutional-grade computer-based assessments')
])

# 8. InteractiveModeDemos.jsx
update_file('frontend/src/stageshow/InteractiveModeDemos.jsx', [
    ('{/* NTA Palette */}', '{/* Item Status Palette */}'),
    ('palette: "NTA 5-Color Standard"', 'palette: "Item Status Palette"')
])

# 9. StageshowHeroDemo.jsx
update_file('frontend/src/stageshow/StageshowHeroDemo.jsx', [
    ('Course: Lunaris Education (JEE 2026)', 'Course: Lunaris Education (CS 2026)'),
    ('value="JEE-MAIN-2026"', 'value="CS-MIDTERM-2026"'),
    ('Validate & Launch NTA CBT →', 'Validate & Launch CBT Assessment →'),
    ('JEE Main 2026 Mock Paper (Full Syllabus)', 'Midterm Assessment 2026 (Comprehensive Evaluation)'),
    ('{/* Top Banner (Exact JeeExamPortal.jsx Header!) */}', '{/* Top Banner (Standard Assessment Header) */}'),
    ('{/* Official NTA Action Controls Footer (Exact buttons!) */}', '{/* Standard CBT Action Controls Footer */}'),
    ('{/* Right Side: Proctor Bubble + NTA 5-Color Palette */}', '{/* Right Side: Proctor Bubble + Item Status Palette */}'),
    ('{/* NTA Palette */}', '{/* Item Status Palette */}'),
    ('JEE Main 2026 Mock Paper • Candidate:', 'Midterm Assessment 2026 • Candidate:'),
    ('setStep(3); // Enter Live NTA CBT', 'setStep(3); // Enter Live CBT'),
    ('// Inside Live NTA CBT!', '// Inside Live CBT Assessment!')
])

# 10. Update backend/app/main.py seed demo text
update_file('backend/app/main.py', [
    ('Exam.title == "JEE Main 2026 Grand Mock Test (Paper 1)"', 'Exam.title == "Comprehensive Midterm Assessment (Paper 1)"'),
    ('title="JEE Main 2026 Grand Mock Test (Paper 1)"', 'title="Comprehensive Midterm Assessment (Paper 1)"'),
    ('description="Official NTA standard format: Physics, Chemistry & Mathematics. 180 Minutes."',
     'description="Specialized institutional assessment format: Physics, Chemistry & Mathematics. 180 Minutes."'),
    ('invite_token == "jee-mock-demo-token-2026"', 'invite_token == "demo-assessment-token-2026"')
])

# 11. Update database SystemSetting for public_site_settings
db = SessionLocal()
try:
    row = db.query(SystemSetting).filter(SystemSetting.key == "public_site_settings").first()
    if row and row.value_json:
        data = json.loads(row.value_json)
        data["site_headline"] = "All-in-one specialized assessment engine with on-device anti-cheat"
        data["site_subtitle"] = "Conduct secure computer-based examinations, quick quizzes, and auto-graded evaluations with real-time video invigilation."
        if "NTA" in data.get("announcement_text", "") or "JEE" in data.get("announcement_text", ""):
            data["announcement_text"] = "Lunaris Assessment Engine: Proctored CBT Assessments & Classroom Sync Active!"
        row.value_json = json.dumps(data)
        db.commit()
        print("Updated database public_site_settings!")
finally:
    db.close()

print("\nSUCCESS: All files and database updated cleanly!")

