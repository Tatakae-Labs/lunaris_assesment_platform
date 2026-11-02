import re

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import at the top
import_stmt = '''import React, { useState, useEffect } from "react";
import { api } from "../shared/api";
import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon
} from "../shared/Icons";'''

text = re.sub(r'import React, \{ useState, useEffect \} from "react";\s*import \{ api \} from "\.\./shared/api";', import_stmt, text, count=1)

# Service definitions
text = text.replace('icon: "🤖"', 'icon: "bot"')
text = text.replace('icon: "📹"', 'icon: "video"')
text = text.replace('icon: "🛡️"', 'icon: "shield"')
text = text.replace('icon: "⚡"', 'icon: "zap"')
text = text.replace('icon: "👥"', 'icon: "users"')
text = text.replace('icon: "📄"', 'icon: "file"')
text = text.replace('icon: "📊"', 'icon: "chart"')
text = text.replace('icon: "🎯"', 'icon: "target"')

# Navigation menu items
nav_old = '''          {[
            { id: "organizations", label: "Organizations & Services", icon: "🏢" },
            { id: "analytics", label: "Executive Analytics", icon: "📊" },
            { id: "exam_stats", label: "Exam Statistics & CBT", icon: "🎯" },
            { id: "plans", label: "Plans & Feature Quotas", icon: "💳" },
            { id: "payments", label: "UPI & Payment Gateway", icon: "⚡" },
            { id: "audit_logs", label: "System Audit Trail", icon: "📜" },
            { id: "admin_team", label: "Admin Team & RBAC", icon: "👥" },
            { id: "public_site", label: "Public Website CMS", icon: "🌐" },
          ].map(item => {'''

nav_new = '''          {[
            { id: "organizations", label: "Organizations & Services", icon: BuildingIcon },
            { id: "analytics", label: "Executive Analytics", icon: BarChartIcon },
            { id: "exam_stats", label: "Exam Statistics & CBT", icon: TargetIcon },
            { id: "plans", label: "Plans & Feature Quotas", icon: CreditCardIcon },
            { id: "payments", label: "UPI & Payment Gateway", icon: ZapIcon },
            { id: "audit_logs", label: "System Audit Trail", icon: FileTextIcon },
            { id: "admin_team", label: "Admin Team & RBAC", icon: UsersIcon },
            { id: "public_site", label: "Public Website CMS", icon: GlobeIcon },
          ].map(item => {'''

text = text.replace(nav_old, nav_new, 1)

# Render item.icon in navigation
text = text.replace(
    '<span style={{ fontSize: "16px" }}>{item.icon}</span>',
    '<item.icon size={16} />'
)

# Replace confirmation prompt emojis
text = text.replace('⚠️ DESTRUCTIVE ACTION:', 'WARNING - DESTRUCTIVE ACTION:')
text = text.replace('⚠️ Revoke and remove subscription', 'WARNING: Revoke and remove subscription')
text = text.replace('⚠️ ATTENTION:', 'ATTENTION:')
text = text.replace('alert("✓ " + res.message);', 'alert(res.message);')

# Header & top bar buttons
text = text.replace('<span>🚪</span> Sign Out / Logout', '<LogOutIcon size={14} /> Sign Out')
text = text.replace('<span>🚪</span> Logout', '<LogOutIcon size={14} /> Logout')
text = text.replace('<span>🔄</span> Refresh View', '<RefreshIcon size={13} /> Refresh')
text = text.replace('👑 Main Super Admin (Sole Owner)', 'Main Super Admin (Sole Owner)')
text = text.replace('🛡️ ', '')
text = text.replace('👑 ', '')
text = text.replace('📜 ', '')
text = text.replace('🎧 ', '')
text = text.replace('<span>✓ {actionNotice}</span>', '<span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><CheckIcon size={14} color="#16a34a" /> {actionNotice}</span>')
text = text.replace('<span>🌐</span> SuperAdmin to Public Site Live Synchronization', '<GlobeIcon size={16} color="#1d4ed8" /> SuperAdmin to Public Site Live Synchronization')
text = text.replace('📢 Announcement Banner', 'Announcement Banner')
text = text.replace('✨ Hero Headline & Platform Description', 'Hero Headline & Platform Description')
text = text.replace('📞 Public Support & System Status', 'Public Support & System Status')
text = text.replace('<span>💳</span> Dynamic Plans & Pricing', '<CreditCardIcon size={16} color="#2563eb" /> Dynamic Plans & Pricing')
text = text.replace('<span>👥</span> Actual Paying Customers', 'Actual Paying Customers')
text = text.replace('<span>📋</span> UPI Verification Queue', 'UPI Verification Queue')
text = text.replace('⚙️ Gateway & UPI Settings', 'Gateway & UPI Settings')
text = text.replace('🔔 Sweep & Dispatch Renewal Reminders', 'Sweep & Dispatch Renewal Reminders')
text = text.replace('⚡ 1. Direct NPCI UPI Payment Gateway', 'Direct NPCI UPI Payment Gateway')
text = text.replace('📋 Copy UPI Link', 'Copy UPI Link')
text = text.replace('⚡ Test Open Link', 'Test Open Link')
text = text.replace('🗑️ Clear Logs', 'Clear Logs')
text = text.replace('💥 Wipe DB Data', 'Wipe DB Data')
text = text.replace('🗑️ Revoke Subscription', 'Revoke Subscription')
text = text.replace('👥 Institution Members & User Accounts', 'Institution Members & User Accounts')
text = text.replace('👥 Institution Members &amp; User Accounts', 'Institution Members & User Accounts')
text = text.replace('🗑️ Delete User', 'Delete User')
text = text.replace('🗑️ Delete', 'Delete')
text = text.replace('🔄 Sync Plan', 'Sync Plan')
text = text.replace('👥 Members', 'Members')
text = text.replace('✏️ Edit Plan & Quotas', 'Edit Plan & Quotas')
text = text.replace('✓ Verify & Activate Plan', 'Verify & Activate Plan')
text = text.replace('✓ Verified & Active', 'Verified & Active')
text = text.replace('✕ Rejected', 'Rejected')
text = text.replace('⏳ Pending Review', 'Pending Review')
text = text.replace('✓ Completion:', 'Completion:')
text = text.replace('>✕</button>', '><XIcon size={18} /></button>')

# Clean any remaining standalone emojis in text
text = text.replace('🏢', '')
text = text.replace('📊', '')
text = text.replace('🎯', '')
text = text.replace('💳', '')
text = text.replace('⚡', '')
text = text.replace('📜', '')
text = text.replace('👥', '')
text = text.replace('🌐', '')
text = text.replace('📢', '')
text = text.replace('🚀', '')
text = text.replace('⚙️', '')
text = text.replace('🤖', '')
text = text.replace('📹', '')
text = text.replace('🛡️', '')
text = text.replace('📄', '')
text = text.replace('👑', '')
text = text.replace('📋', '')
text = text.replace('🔔', '')
text = text.replace('🗑️', '')
text = text.replace('✏️', '')
text = text.replace('✨', '')
text = text.replace('📞', '')
text = text.replace('💥', '')
text = text.replace('🎧', '')
text = text.replace('⏳', '')

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: PlatformAdminPortal.jsx cleaned of emojis!")

