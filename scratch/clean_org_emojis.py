import re

with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add icons import
import_stmt = '''import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon, GraduationCapIcon,
  BookIcon, MenuIcon
} from "../shared/Icons";'''

text = re.sub(r'import React, \{ useState, useEffect \} from "react";\s*import \{ api \} from "\.\./shared/api";', import_stmt, text, count=1)

# 2. Navigation items
nav_old = '''            {[
              { key: "exams", label: "Examinations", icon: "📝", count: exams.length },
              { key: "questions", label: "Question Bank", icon: "📚", count: questions.length },
              {
                key: "ai_studio",
                label: "AI Question Studio",
                icon: "🤖",
                isDisabled: orgServices.ai_studio === false
              },
              {
                key: "live_proctor",
                label: "Live Proctoring",
                icon: "🛡️",
                isDisabled: orgServices.proctor_console === false
              },
              { key: "members", label: "Faculty & Members", icon: "👥", count: members.length },
              { key: "billing", label: "Plans & Billing", icon: "💳" }
            ].map((tab) => {'''

nav_new = '''            {[
              { key: "exams", label: "Examinations", icon: FileTextIcon, count: exams.length },
              { key: "questions", label: "Question Bank", icon: BookIcon, count: questions.length },
              {
                key: "ai_studio",
                label: "AI Question Studio",
                icon: BotIcon,
                isDisabled: orgServices.ai_studio === false
              },
              {
                key: "live_proctor",
                label: "Live Proctoring",
                icon: ShieldIcon,
                isDisabled: orgServices.proctor_console === false
              },
              { key: "members", label: "Faculty & Members", icon: UsersIcon, count: members.length },
              { key: "billing", label: "Plans & Billing", icon: CreditCardIcon }
            ].map((tab) => {'''

text = text.replace(nav_old, nav_new, 1)

text = text.replace(
    '<span style={{ fontSize: "16px" }}>{tab.icon}</span>',
    '<tab.icon size={16} />'
)
text = text.replace(
    '{tab.isDisabled && <span style={{ fontSize: "11px" }}>🔒</span>}',
    '{tab.isDisabled && <LockIcon size={12} color="var(--text-muted)" />}'
)

# 3. Clean alerts & toast messages
text = text.replace('toast.success(`✓ Academy', 'toast.success(`Academy')
text = text.replace('alert(`🎉 Academy', 'alert(`Academy')
text = text.replace('alert(`✓ ${res.message || "Uploaded directly to Google Classroom!"}`);', 'alert(res.message || "Uploaded directly to Google Classroom!");')
text = text.replace('alert("✓ Google Classroom connected', 'alert("Google Classroom connected')
text = text.replace('`🎉 Published to Google Classroom', '`Published to Google Classroom')
text = text.replace('`✓ ${res.message}', '`${res.message}')
text = text.replace('🟢 Google Classroom Synced:', 'Google Classroom Synced:')
text = text.replace('`🎉 Exam Published Successfully!', '`Exam Published Successfully!')
text = text.replace('⚠️ DANGER:', 'WARNING:')

# 4. Replace modal and drawer header icons
text = text.replace('🏛️', '')
text = text.replace('<span>🎓</span>', '<GraduationCapIcon size={16} />')
text = text.replace('<span>🛡️</span>', '<ShieldIcon size={14} />')
text = text.replace('✏️ Edit ', 'Edit ')
text = text.replace('⚡ Quick Quiz', 'Quick Quiz')
text = text.replace('✦ Custom Examination', 'Custom Examination')
text = text.replace('📋 Copy Room Code', 'Copy Room Code')
text = text.replace('🚀 Enter Room in Quick Quiz Arena', 'Enter Room in Quick Quiz Arena')
text = text.replace('✓ Nodemailer SMTP Delivered', 'Nodemailer SMTP Delivered')
text = text.replace('🔑 Recipient will receive code:', 'Recipient will receive code:')
text = text.replace('🗑️ Clear All', 'Clear All')
text = text.replace('⚡ Instant 1-Click Curriculum Packs', 'Instant 1-Click Curriculum Packs')
text = text.replace('💻 Tech & Computer Science', 'Tech & Computer Science')
text = text.replace('⚖️ Law & Judicial Services', 'Law & Judicial Services')
text = text.replace('🩺 Medicine & Health', 'Medicine & Health')
text = text.replace('📊 Commerce & Finance', 'Commerce & Finance')
text = text.replace('🔬 Universal STEM', 'Universal STEM')
text = text.replace('🔄 Refresh', 'Refresh')
text = text.replace('🚀 Upload Anything to Classroom', 'Upload Anything to Classroom')
text = text.replace('📝 Coursework & Credentials PDF', 'Coursework & Credentials PDF')
text = text.replace('👥 Student Roster Import', 'Student Roster Import')
text = text.replace('📝 CourseWork Assignment', 'CourseWork Assignment')
text = text.replace('📢 Stream Announcement', 'Stream Announcement')
text = text.replace('📁 Course Material', 'Course Material')
text = text.replace('✓ Selected file:', 'Selected file:')
text = text.replace('🚀 Upload to Google Classroom', 'Upload to Google Classroom')
text = text.replace('📥 Enroll', 'Enroll')
text = text.replace('✨ Instant Workspace Features:', 'Instant Workspace Features:')

# Mobile hamburger menu icon
text = text.replace('☰', '')

# Clean standalone characters
text = text.replace('<span>✓</span>', '<CheckIcon size={14} color="#16a34a" />')
text = text.replace('>✕</button>', '><XIcon size={16} /></button>')
text = text.replace('✓', '')

with open('frontend/src/organization/OrgDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: OrgDashboard.jsx cleaned of emojis!")

