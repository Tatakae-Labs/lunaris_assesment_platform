icons_import = '''import {
  BuildingIcon, BarChartIcon, TargetIcon, CreditCardIcon, ZapIcon, FileTextIcon,
  UsersIcon, GlobeIcon, ShieldIcon, BotIcon, VideoIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, SettingsIcon, RocketIcon, EditIcon,
  TrashIcon, RefreshIcon, LogOutIcon, LockIcon, UnlockIcon, AlertTriangleIcon,
  UploadIcon, DownloadIcon, SearchIcon, LinkIcon, CopyIcon, BellIcon,
  MegaphoneIcon, MailIcon, PhoneIcon, PlusIcon, CrownIcon, SparklesIcon,
  FolderIcon, CodeIcon, ClockIcon, TrophyIcon, UserIcon, GraduationCapIcon,
  BookIcon, MenuIcon
} from "../shared/Icons";'''

for filepath in ['frontend/src/organization/OrgDashboard.jsx', 'frontend/src/public/PublicWebsite.jsx']:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    target = 'import { api } from "../shared/api";'
    if target in content and '../shared/Icons' not in content:
        content = content.replace(target, target + '\n' + icons_import, 1)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Added Icons import to {filepath}")
    else:
        print(f"Target not found or already has Icons import in {filepath}")

