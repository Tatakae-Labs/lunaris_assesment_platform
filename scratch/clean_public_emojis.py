import re

with open('frontend/src/public/PublicWebsite.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import
import_stmt = '''import React, { useState, useEffect, useRef } from "react";
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

text = re.sub(r'import React, \{ useState, useEffect, useRef \} from "react";\s*import \{ api \} from "\.\./shared/api";', import_stmt, text, count=1)

text = text.replace('<span>📢</span>', '<MegaphoneIcon size={14} color="#ffffff" />')
text = text.replace('🛡️ Go to Admin Portal →', 'Go to Admin Portal →')
text = text.replace('🏢 Go to Dashboard →', 'Go to Dashboard →')
text = text.replace('{mobileMenuOpen ? "✕" : "☰"}', '{mobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}')
text = text.replace('<span>⚡</span> LIVE INTERACTIVE WORKBENCH', '<ZapIcon size={13} color="#2563eb" /> LIVE INTERACTIVE WORKBENCH')
text = text.replace('🏢 Workspace Login', 'Workspace Login')
text = text.replace('🛡️ SuperAdmin Login', 'SuperAdmin Login')
text = text.replace('🏢 Create New Workspace', 'Create New Workspace')
text = text.replace('🔑 Join Existing Organization', 'Join Existing Organization')
text = text.replace('<div style={{ fontSize: "40px", marginBottom: "8px" }}>📩</div>', '<div style={{ marginBottom: "8px" }}><MailIcon size={36} color="#2563eb" /></div>')
text = text.replace('🔒 <strong>Owner Authorization Required:</strong>', '<strong>Owner Authorization Required:</strong>')
text = text.replace('<strong>⚠️ Payment Approval Policy:</strong>', '<strong>Payment Approval Policy:</strong>')

# Pricing list checkmarks
text = text.replace('<li>✓ ', '<li style={{ display: "flex", alignItems: "center", gap: "8px" }}><CheckIcon size={14} color="#16a34a" /> ')
text = text.replace('? "✓ Full Proctoring Engine', '? "Full Proctoring Engine')
text = text.replace('? "✓ PDF Document Import"', '? "PDF Document Import"')
text = text.replace(': "✗ PDF document import"', ': "PDF document import"')
text = text.replace(': "✗ Proctoring disabled"', ': "Proctoring disabled"')

# Clean all remaining emojis
text = text.replace('📢', '')
text = text.replace('🏢', '')
text = text.replace('🛡️', '')
text = text.replace('⚡', '')
text = text.replace('🔑', '')
text = text.replace('📩', '')
text = text.replace('🔒', '')
text = text.replace('⚠️', '')
text = text.replace('✓', '')
text = text.replace('✗', '')
text = text.replace('✕', '')
text = text.replace('☰', '')

with open('frontend/src/public/PublicWebsite.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: PublicWebsite.jsx cleaned!")

