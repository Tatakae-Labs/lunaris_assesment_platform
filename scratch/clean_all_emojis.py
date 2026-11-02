import os, re

files_to_clean = [
    'frontend/src/App.jsx',
    'frontend/src/stageshow/StageshowHeroDemo.jsx',
    'frontend/src/stageshow/StageshowBentoGrid.jsx',
    'frontend/src/stageshow/InteractiveModeDemos.jsx',
    'frontend/src/stageshow/StageWindow.jsx',
    'frontend/src/candidate/PreflightModal.jsx',
    'frontend/src/organization/AiQuestionStudio.jsx',
    'frontend/src/organization/CreateQuestionModal.jsx',
    'frontend/src/organization/EnrollmentManagerModal.jsx',
    'frontend/src/organization/ExamAnalyticsModal.jsx',
    'frontend/src/organization/ExamCreationWizard.jsx',
    'frontend/src/proctor-console/LiveProctorDashboard.jsx'
]

emoji_pattern = re.compile(
    r'[\U00010000-\U0010ffff]|'
    r'[\u2600-\u27bf]|'
    r'[\u2300-\u23ff]|'
    r'[\u2b50-\u2b55]|'
    r'[\u203c-\u2049]'
)

for fpath in files_to_clean:
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Specific replacements
    content = content.replace('⚡ Quick Quiz Live Arena', 'Quick Quiz Live Arena')
    content = content.replace('🚀 Ready for Candidate Login →', 'Ready for Candidate Login →')
    content = content.replace('⏸ Pause Demo', 'Pause Demo')
    content = content.replace('▶ Resume Autoplay', 'Resume Autoplay')
    content = content.replace('📥 Stuff & Enroll 4 Students into Exam', 'Enroll 4 Students into Exam')
    content = content.replace('💡 <strong>Login Credentials:</strong>', '<strong>Login Credentials:</strong>')
    content = content.replace('🛡️ AI Proctoring Audit: Passed', 'AI Proctoring Audit: Passed')
    content = content.replace('✦ STAGESHOW ARCHITECTURE GRID', 'STAGESHOW ARCHITECTURE GRID')
    content = content.replace('⏱ 02:45:12 REMAINING', '02:45:12 REMAINING')
    content = content.replace('🏛️ Real NTA CBT Simulator', 'Real NTA CBT Simulator')
    content = content.replace('✨ AI Question Studio', 'AI Question Studio')
    content = content.replace('🛡️ Live Proctor CCTV Console', 'Live Proctor CCTV Console')
    content = content.replace('✨ Generate Question', 'Generate Question')
    content = content.replace('📐 Solution Formula:', 'Solution Formula:')
    content = content.replace('✓ Strict JSON Schema Verified', 'Strict JSON Schema Verified')
    content = content.replace('✓ Results Released', 'Results Released')
    content = content.replace('🔒 Release Results', 'Release Results')
    content = content.replace('✓ Clean', 'Clean')
    content = content.replace('⚠️', 'Warning:')
    content = content.replace('🎉', '')
    content = content.replace('🤖', '')
    content = content.replace('📹', '')
    content = content.replace('🛡️', '')
    content = content.replace('🛡', '')
    content = content.replace('⚡', '')
    content = content.replace('📄', '')
    content = content.replace('📋', '')
    content = content.replace('🗑️', '')
    content = content.replace('🗑', '')
    content = content.replace('✨', '')
    content = content.replace('🏆', '')
    content = content.replace('🏛️', '')
    content = content.replace('🏛', '')
    content = content.replace('💡', '')
    content = content.replace('🚀', '')
    content = content.replace('📥', '')
    content = content.replace('💻', '')
    content = content.replace('🟢', '')
    content = content.replace('🟡', '')
    content = content.replace('🔴', '')
    content = content.replace('🔑', '')
    content = content.replace('🏫', '')
    content = content.replace('👤', '')
    content = content.replace('👥', '')
    content = content.replace('🔒', '')
    content = content.replace('✓', '')
    content = content.replace('✕', '')
    content = content.replace('✖', '')
    content = content.replace('📖', '')
    content = content.replace('🔗', '')
    content = content.replace('🆔', '')
    content = content.replace('📱', '')
    content = content.replace('👀', '')
    content = content.replace('🖥️', '')
    content = content.replace('🖥', '')
    content = content.replace('🚨', '')
    content = content.replace('⚖️', '')
    content = content.replace('⚖', '')
    content = content.replace('🎯', '')
    content = content.replace('👁️', '')
    content = content.replace('👁', '')

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Cleaned {fpath}")

print("All targeted files cleaned!")

