import sys, os
sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.models import User
from app.integrations.classroom_router import upload_any_file_to_google_drive

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "contact.kadurugved@gmail.com").first()
    if not user or not user.google_access_token:
        print("No user or no google_access_token!")
    else:
        print("Testing upload_any_file_to_google_drive with user token...")
        test_bytes = b"%PDF-1.4 test pdf content for google classroom upload"
        try:
            file_id = upload_any_file_to_google_drive(
                access_token=user.google_access_token,
                file_bytes=test_bytes,
                filename="test_upload.pdf",
                mime_type="application/pdf"
            )
            print("Result file_id:", file_id)
        except Exception as e:
            import traceback
            traceback.print_exc()
finally:
    db.close()

