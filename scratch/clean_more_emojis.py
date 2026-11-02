import os, re

files_to_clean = [
    'frontend/src/organization/PlansBillingView.jsx',
    'frontend/src/proctor-console/LiveProctorDashboard.jsx',
    'frontend/src/organization/EnrollmentManagerModal.jsx',
    'frontend/src/organization/ExamCreationWizard.jsx',
    'frontend/src/candidate/CandidateEntryPortal.jsx',
    'frontend/src/stageshow/StageshowBentoGrid.jsx'
]

for fpath in files_to_clean:
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('💳 Commercial Plans & Resource Entitlements', 'Commercial Plans & Resource Entitlements')
    content = content.replace('📧 Test Renewal Reminder Email', 'Test Renewal Reminder Email')
    content = content.replace('🔔 <strong>Automated Alerts:</strong>', '<strong>Automated Alerts:</strong>')
    content = content.replace('🔍 Zoom', 'Zoom')
    content = content.replace('📢 Issue Live Warning to Candidate Screen', 'Issue Live Warning to Candidate Screen')
    content = content.replace('✉️ Copy Message', 'Copy Message')
    content = content.replace('✏️ Edit', 'Edit')
    content = content.replace('🔄 Refresh Courses', 'Refresh Courses')
    content = content.replace('🔄 Loading real students from Google Classroom...', 'Loading real students from Google Classroom...')
    content = content.replace('⚠️ Integrity Advisory', 'Integrity Advisory')
    content = content.replace('📱 Prohibited Device Detected', 'Prohibited Device Detected')
    content = content.replace('👥 Multiple Individuals Detected', 'Multiple Individuals Detected')
    content = content.replace('👀 Gaze & Movement Alert', 'Gaze & Movement Alert')
    content = content.replace('🖥️ Fullscreen Integrity Violation', 'Fullscreen Integrity Violation')
    content = content.replace('🎫', '')
    content = content.replace('✦', '')
    content = content.replace('✓', '')
    content = content.replace('⚠️', '')
    content = content.replace('💳', '')
    content = content.replace('📧', '')
    content = content.replace('🔔', '')
    content = content.replace('🔍', '')
    content = content.replace('📢', '')
    content = content.replace('✉️', '')
    content = content.replace('✉', '')
    content = content.replace('✏️', '')
    content = content.replace('✏', '')
    content = content.replace('🔄', '')
    content = content.replace('📱', '')
    content = content.replace('👥', '')
    content = content.replace('👀', '')
    content = content.replace('🖥️', '')
    content = content.replace('🖥', '')
    content = content.replace('🗓️', '')
    content = content.replace('🗓', '')
    content = content.replace('⏱️', '')
    content = content.replace('⏱', '')

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Cleaned {fpath}")

print("Done cleaning extra files!")

