import os, re

def replace_in_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (not found)")
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    modified = False
    for target, rep in replacements:
        if target in text:
            text = text.replace(target, rep)
            modified = True
        else:
            print(f"Warning in {filepath}: target '{target[:40]}...' not found")

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Successfully updated {filepath}")
    else:
        print(f"No changes made to {filepath}")

# 1. frontend/src/public/PublicWebsite.jsx
replace_in_file('frontend/src/public/PublicWebsite.jsx', [
    ('Conduct NTA-style computer-based tests, buzzer quick quizzes, and auto-graded assessments with real-time video invigilation.',
     'Conduct secure computer-based assessments, buzzer quick quizzes, and auto-graded evaluations with real-time video invigilation.'),
    ('Author JEE-standard tests, sync rosters from Google Classroom, and proctor candidates with on-device video AI.',
     'Author institutional assessments, sync rosters from Google Classroom, and proctor candidates with on-device video AI.'),
    ('Generate JEE-standard Single MCQ, Multiple MCQ, and Numerical questions across Physics, Chemistry, and Mathematics in seconds.',
     'Generate curriculum-aligned Single MCQ, Multiple MCQ, and Numerical questions across STEM, Technical, and Academic disciplines in seconds.'),
    ('placeholder="Apex IIT JEE Academy"',
     'placeholder="Apex Academic & Assessment Academy"')
])

# 2. frontend/src/platform/PlatformAdminPortal.jsx
replace_in_file('frontend/src/platform/PlatformAdminPortal.jsx', [
    ('desc: "Gemini / Groq LLM pipeline for automated JEE, MCQ, and numerical question synthesis.",',
     'desc: "Gemini / Groq LLM pipeline for automated curriculum item, MCQ, and numerical question synthesis.",'),
    ('Conduct NTA-style computer-based tests, buzzer quick quizzes, and auto-graded assessments with real-time video invigilation.',
     'Conduct secure computer-based assessments, buzzer quick quizzes, and auto-graded evaluations with real-time video invigilation.'),
    ('placeholder="e.g.  Lunaris v2.4 released with AI Question Generation & NTA Exam Simulation!"',
     'placeholder="e.g. Lunaris v2.4 released with AI Question Studio & Specialized CBT Assessment Engine!"'),
    ('{/* VIEW 3: EXAM STATISTICS & NTA CBT',
     '{/* VIEW 3: EXAM STATISTICS & CBT ASSESSMENTS'),
    ('Deep breakdown of NTA Computer-Based Tests, Quick Quiz arenas, and question banks authored across institutions.',
     'Deep breakdown of Computer-Based Assessments, Quick Quiz arenas, and question banks authored across institutions.'),
    ('NTA CBT Items & Audit',
     'CBT Items & Assessment Audit')
])

# 3. frontend/src/organization/OrgDashboard.jsx
replace_in_file('frontend/src/organization/OrgDashboard.jsx', [
    ('Multi-tenant assessment workspace with automated anti-cheat, NTA computer-based testing, and real-time proctor monitoring.',
     'Multi-tenant assessment workspace with automated anti-cheat, secure computer-based testing, and real-time proctor monitoring.'),
    (': "NTA Proctored CBT"}',
     ': "Proctored CBT"}'),
    ('placeholder="e.g. JEE Mock Exam Paper 1 / Physics Mechanics Notes"',
     'placeholder="e.g. Midterm Assessment Paper 1 / Computer Science Notes"')
])

# 4. frontend/src/organization/AiQuestionStudio.jsx
replace_in_file('frontend/src/organization/AiQuestionStudio.jsx', [
    ('Synthesize JEE-aligned single MCQs and numerical value questions (NVQs) with human review prior to publishing.',
     'Synthesize curriculum-aligned multiple choice questions and numerical value questions (NVQs) with human review prior to publishing.'),
    ('Use the synthesis form above to generate questions on any JEE topic.',
     'Use the synthesis form above to generate assessment questions on any academic or technical topic.')
])

# 5. frontend/src/organization/ExamCreationWizard.jsx
replace_in_file('frontend/src/organization/ExamCreationWizard.jsx', [
    ('placeholder="e.g. JEE Main 2026 Grand Mock Test (Paper 1)"',
     'placeholder="e.g. Comprehensive Midterm Assessment 2026 (Paper 1)"'),
    ('placeholder="Comprehensive entrance test covering standard NTA syllabus..."',
     'placeholder="Comprehensive evaluation covering standard institutional syllabus and learning objectives..."'),
    ('<option value="Engineering Entrance">Engineering Entrance (JEE / BITSAT)</option>',
     '<option value="Higher Education">University & College Coursework</option>'),
    ('<option value="Medical Entrance">Medical Entrance (NEET)</option>',
     '<option value="Professional Certification">Professional & Technical Certification</option>')
])

# 6. frontend/src/candidate/CandidateEntryPortal.jsx
replace_in_file('frontend/src/candidate/CandidateEntryPortal.jsx', [
    ('{isStandardQuiz ? "Standard Practice Quiz" : "NTA Proctored CBT"}',
     '{isStandardQuiz ? "Standard Practice Quiz" : "Proctored Computer-Based Assessment"}')
])

# 7. frontend/src/candidate/JeeExamPortal.jsx
replace_in_file('frontend/src/candidate/JeeExamPortal.jsx', [
    ('JEE Main Scorecard & Analysis',
     'Assessment Scorecard & Analysis'),
    ('{/* Top Banner (JEE CBT Standard Header) */}',
     '{/* Top Banner (Standard CBT Assessment Header) */}'),
    ('{attempt?.title || "JEE Main Mock Examination"}',
     '{attempt?.title || "Computer-Based Examination"}'),
    ('{/* JEE CBT Action Controls Footer */}',
     '{/* CBT Action Controls Footer */}')
])

# 8. frontend/src/candidate/PreflightModal.jsx
replace_in_file('frontend/src/candidate/PreflightModal.jsx', [
    ('{examTitle || "JEE Main Computer-Based Mock Exam"}',
     '{examTitle || "Computer-Based Assessment"}'),
    ('<strong>NTA JEE Exam Rules:</strong> Leaving fullscreen, switching browser tabs, or multiple faces detected will trigger proctor integrity alerts.',
     '<strong>Assessment Integrity Rules:</strong> Leaving fullscreen, switching browser tabs, or multiple faces detected will trigger proctor integrity alerts.')
])

# 9. frontend/src/stageshow/InteractiveModeDemos.jsx
replace_in_file('frontend/src/stageshow/InteractiveModeDemos.jsx', [
    ('* 1. NTA JEE Main CBT Runner (#0a0f1d dark theme, subject tabs, 5-color palette, proctor box)',
     '* 1. Specialized CBT Runner (section tabs, responsive item palette, proctor box)'),
    ('{ id: "cbt", label: "Real NTA CBT Simulator" },',
     '{ id: "cbt", label: "Specialized CBT Assessment Runner" },'),
    ('{/* TAB 1: EXACT NTA CBT ENGINE SIMULATOR (#0a0f1d DARK THEME) */}',
     '{/* TAB 1: SPECIALIZED CBT ASSESSMENT RUNNER */}'),
    ('JEE Main 2026 Test Engine • Live Simulation',
     'Specialized CBT Engine • Live Assessment Session'),
    ('{/* Exact NTA CBT Action Controls Footer */}',
     '{/* CBT Assessment Action Controls Footer */}'),
    ('{/* Right Side: Proctor Bubble + NTA 5-Color Palette */}',
     '{/* Right Side: Proctor Bubble + Item Status Palette */}'),
    ('palette: "NTA 5-Color Standard",',
     'palette: "Item Status Palette",')
])

# 10. frontend/src/stageshow/StageshowBentoGrid.jsx
replace_in_file('frontend/src/stageshow/StageshowBentoGrid.jsx', [
    ('Everything you need to deliver NTA-standard computer based assessments, automatic grading, and AI integrity supervision at scale.',
     'Everything you need to deliver institutional-grade computer-based assessments, automatic grading, and AI integrity supervision at scale.'),
    ('OFFICIAL NTA CBT INTERFACE',
     'SPECIALIZED CBT INTERFACE'),
    ('Pixel-Perfect Indian JEE Main Test Runner',
     'Specialized Computer-Based Assessment Runner'),
    ('{ id: "proctored_cbt", title: "NTA Proctored CBT", badge: "Strict JEE Exam", icon: "" },',
     '{ id: "proctored_cbt", title: "Proctored Assessment", badge: "Institutional CBT", icon: "" },')
])

# 11. frontend/src/stageshow/StageshowHeroDemo.jsx
replace_in_file('frontend/src/stageshow/StageshowHeroDemo.jsx', [
    ('* 3. Exact NTA JEE Main CBT Interface (#0a0f1d dark theme, subject tabs,',
     '* 3. Specialized CBT Assessment Interface (section tabs,'),
    ('{ id: 3, label: "4. Official NTA JEE CBT" },',
     '{ id: 3, label: "4. Specialized CBT Engine" },'),
    ('url={step >= 3 ? "lunaris.app/exam/jee-main-2026?uid=LUN-981240" : "lunaris.app/dashboard/exams"}',
     'url={step >= 3 ? "lunaris.app/exam/midterm-assessment?uid=LUN-981240" : "lunaris.app/dashboard/exams"}'),
    ('JEE Main 2026 Test Engine',
     'Specialized Assessment Engine'),
    ('NTA CBT Simulator • JEE Main 2026',
     'Specialized CBT Engine • Midterm Assessment 2026'),
    ('Section 1: Physics (JEE Main 2026)',
     'Section 1: Core Fundamentals'),
    ('Section 2: Chemistry (JEE Main 2026)',
     'Section 2: Applied Analysis')
])

# 12. frontend/src/stageshow/StageWindow.jsx
replace_in_file('frontend/src/stageshow/StageWindow.jsx', [
    ('url = "lunaris.app/exams/jee-main-2026",',
     'url = "lunaris.app/exams/specialized-assessment",')
])

# 13. backend/app/main.py
replace_in_file('backend/app/main.py', [
    ('title="Lunaris JEE Assessment API",',
     'title="Lunaris Specialized Assessment Platform API",'),
    ('description="Multi-Tenant JEE-Style Proctored Examination Platform API",',
     'description="Multi-Tenant Specialized Computer-Based Assessment & Proctored Examination Platform API",'),
    ('org = Organization(name="Allen Kota JEE Division", slug="allen-kota-mock")',
     'org = Organization(name="Polaris Institute of Technology", slug="polaris-tech-mock")'),
    ('full_name="Prof. Sharma (JEE Dean)"',
     'full_name="Prof. Sharma (Dean of Academics)"')
])

# 14. backend/app/platform/router.py
replace_in_file('backend/app/platform/router.py', [
    ('Conduct NTA-style computer-based tests, buzzer quick quizzes, and auto-graded assessments with real-time video invigilation.',
     'Conduct secure computer-based examinations, quick quizzes, and auto-graded evaluations with real-time video invigilation.')
])

# 15. backend/app/grading/engine.py
replace_in_file('backend/app/grading/engine.py', [
    ('Deterministic scoring engine for JEE Main & Advanced style examinations.',
     'Deterministic scoring engine for standard academic, technical, and institutional examinations.'),
    ('marking_rules: Global or section fallback rules (default JEE Main: +4, -1, 0)',
     'marking_rules: Global or section fallback rules (default standard marking: +4, -1, 0)')
])

# 16. backend/app/exams/router.py
replace_in_file('backend/app/exams/router.py', [
    ('duration_minutes: int = 180  # Default JEE 3 hours',
     'duration_minutes: int = 180  # Default standard 3 hours')
])

print("\nALL REPLACEMENTS PROCESSED!")

