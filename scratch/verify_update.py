import sys, os
sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.platform.router import get_public_site_settings_endpoint, update_public_site_settings_endpoint
from app.models import User

db = SessionLocal()
try:
    superadmin_user = db.query(User).filter(User.email == "superadmin@lunaris.com").first()
    if not superadmin_user:
        superadmin_user = User(email="superadmin@lunaris.com", is_superadmin=True, admin_role="superadmin")

    test_payload = {
        "announcement_active": True,
        "announcement_text": "Live NTA CBT Entrance Mock Tests Now Open!",
        "announcement_link": "/#pricing",
        "site_headline": "India's Most Trusted Computer-Based Examination Platform",
        "site_subtitle": "Conduct proctored online examinations, automated grading, and live leaderboards.",
        "contact_email": "hello@lunaris.com",
        "support_phone": "+91 99999 88888",
        "platform_status": "All Systems Normal"
    }

    updated = update_public_site_settings_endpoint(test_payload, superadmin_user, db)
    print("Updated result:", updated)

    # Verify retrieval
    retrieved = get_public_site_settings_endpoint(db)
    assert retrieved["announcement_active"] is True
    assert retrieved["announcement_text"] == "Live NTA CBT Entrance Mock Tests Now Open!"
    assert retrieved["site_headline"] == "India's Most Trusted Computer-Based Examination Platform"
    print("VERIFICATION OF UPDATE & RETRIEVAL: PASSED!")
finally:
    db.close()
