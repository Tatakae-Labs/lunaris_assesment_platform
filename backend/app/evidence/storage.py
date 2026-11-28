import os
import uuid
import base64
from typing import Optional
from app.core.config import settings

try:
    os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)
except OSError:
    pass

class StorageService:
    @staticmethod
    def save_base64_snapshot(base64_str: str, prefix: str = "snapshot") -> Optional[str]:
        """Saves a base64 encoded snapshot to private storage directory and returns storage key."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            data = base64.b64decode(base64_str)
            filename = f"{prefix}_{uuid.uuid4().hex[:16]}.jpg"
            try:
                os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)
                file_path = os.path.join(settings.LOCAL_STORAGE_DIR, filename)
                with open(file_path, "wb") as f:
                    f.write(data)
            except OSError:
                pass
            # Also persist in MongoDB evidence_blobs so serverless containers share snapshots
            try:
                from app.core.mongodb import get_collection
                blobs = get_collection("evidence_blobs")
                if blobs is not None:
                    blobs.replace_one({"_id": filename}, {"_id": filename, "b64": base64_str}, upsert=True)
            except Exception:
                pass
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
        try:
            from app.core.mongodb import get_collection
            blobs = get_collection("evidence_blobs")
            if blobs is not None:
                doc = blobs.find_one({"_id": os.path.basename(storage_key)})
                if doc and doc.get("b64"):
                    return base64.b64decode(doc["b64"])
        except Exception:
            pass
        return None
