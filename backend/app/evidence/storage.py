import os
import uuid
import base64
from typing import Optional
from app.core.config import settings

os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)

class StorageService:
    @staticmethod
    def save_base64_snapshot(base64_str: str, prefix: str = "snapshot") -> Optional[str]:
        """Saves a base64 encoded snapshot to private storage directory and returns storage key."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            data = base64.b64decode(base64_str)
            filename = f"{prefix}_{uuid.uuid4().hex[:16]}.jpg"
            file_path = os.path.join(settings.LOCAL_STORAGE_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(data)
            return filename
        except Exception as e:
            print(f"Error saving snapshot evidence: {e}")
            return None

    @staticmethod
    def get_snapshot_bytes(storage_key: str) -> Optional[bytes]:
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, os.path.basename(storage_key))
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()
        return None
