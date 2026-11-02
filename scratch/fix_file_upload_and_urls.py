import re

# 1. Update classroom_router.py
with open('backend/app/integrations/classroom_router.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace hardcoded backendsolpay url in classroom_router.py
text = text.replace(
    'exam_link = f"https://backendsolpay.rugveddev.tech/candidate/entry?room={exam.room_code}&exam_id={exam.id}"',
    'frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")\n    exam_link = f"{frontend_url}/candidate-login?room={exam.room_code}"'
)
text = text.replace(
    'pdf_url = f"https://backendsolpay.rugveddev.tech/api/v1/exams/{exam.id}/credentials-pdf"',
    'api_url_base = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")\n    pdf_url = f"{api_url_base}/api/v1/exams/{exam.id}/credentials-pdf"'
)

# Ensure os is imported
if 'import os\n' not in text and 'import os' not in text:
    text = 'import os\n' + text

# Improve upload_any_file_to_google_drive
old_upload_any = '''def upload_any_file_to_google_drive(
    access_token: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str = "application/pdf"
) -> Optional[str]:
    """
    Uploads any arbitrary document, syllabus, test paper, or image to Google Drive.
    Sets public reader permission so Classroom students can view it.
    """
    try:
        boundary = "===============LunarisClassroomFileBoundary=="
        meta_json = json.dumps({
            "name": filename,
            "mimeType": mime_type or "application/octet-stream"
        }).encode("utf-8")

        body = (
            f"--{boundary}\\r\\n"
            f"Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n"
        ).encode("utf-8") + meta_json + (
            f"\\r\\n--{boundary}\\r\\n"
            f"Content-Type: {mime_type or 'application/octet-stream'}\\r\\n\\r\\n"
        ).encode("utf-8") + file_bytes + (
            f"\\r\\n--{boundary}--\\r\\n"
        ).encode("utf-8")

        drive_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
        req = urllib.request.Request(
            drive_url,
            data=body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": f"multipart/related; boundary={boundary}",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                data = json.loads(resp.read().decode("utf-8"))
                file_id = data.get("id")
                if file_id:
                    try:
                        perm_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
                        perm_data = json.dumps({"role": "reader", "type": "anyone"}).encode("utf-8")
                        perm_req = urllib.request.Request(
                            perm_url,
                            data=perm_data,
                            headers={
                                "Authorization": f"Bearer {access_token}",
                                "Content-Type": "application/json"
                            }
                        )
                        with urllib.request.urlopen(perm_req, timeout=5):
                            pass
                    except Exception:
                        pass
                return file_id
    except Exception as e:
        print(f"Could not upload file to Google Drive: {e}")
        return None'''

new_upload_any = '''def upload_any_file_to_google_drive(
    access_token: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str = "application/pdf"
) -> tuple[Optional[str], Optional[str]]:
    """
    Uploads any arbitrary document, syllabus, test paper, or image to Google Drive.
    Sets reader permission so Classroom students can view it.
    Returns: (file_id, error_message)
    """
    try:
        rand_suffix = "".join(random.choices(string.ascii_letters + string.digits, k=16))
        boundary = f"----LunarisDriveBoundary{rand_suffix}"
        clean_mime = mime_type or "application/octet-stream"
        
        meta_json = json.dumps({
            "name": filename,
            "mimeType": clean_mime
        }).encode("utf-8")

        body = (
            f"--{boundary}\\r\\n"
            f"Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n"
        ).encode("utf-8") + meta_json + (
            f"\\r\\n--{boundary}\\r\\n"
            f"Content-Type: {clean_mime}\\r\\n\\r\\n"
        ).encode("utf-8") + file_bytes + (
            f"\\r\\n--{boundary}--\\r\\n"
        ).encode("utf-8")

        drive_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
        req = urllib.request.Request(
            drive_url,
            data=body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": f'multipart/related; boundary="{boundary}"',
                "Content-Length": str(len(body)),
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status in (200, 201):
                data = json.loads(resp.read().decode("utf-8"))
                file_id = data.get("id")
                if file_id:
                    try:
                        perm_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions?supportsAllDrives=true"
                        perm_data = json.dumps({"role": "reader", "type": "anyone"}).encode("utf-8")
                        perm_req = urllib.request.Request(
                            perm_url,
                            data=perm_data,
                            headers={
                                "Authorization": f"Bearer {access_token}",
                                "Content-Type": "application/json"
                            }
                        )
                        with urllib.request.urlopen(perm_req, timeout=6):
                            pass
                    except Exception as perm_err:
                        print(f"Drive permissions note (non-critical): {perm_err}")
                return file_id, None
            return None, f"Drive HTTP {resp.status}"
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        print(f"Google Drive HTTP Error {he.code}: {err_msg}")
        return None, f"Google Drive API {he.code}: {err_msg}"
    except Exception as e:
        print(f"Could not upload file to Google Drive: {e}")
        return None, str(e)'''

if old_upload_any in text:
    text = text.replace(old_upload_any, new_upload_any, 1)
    print("upload_any_file_to_google_drive updated!")
else:
    print("old_upload_any not found in classroom_router.py")

# Update upload_classroom_content file handling
old_upload_content_file = '''    # 1. If base64 file uploaded (e.g. syllabus, notes, paper)
    if req.file_content_base64 and req.file_name:
        try:
            file_data = req.file_content_base64
            if "," in file_data:
                file_data = file_data.split(",", 1)[1]
            raw_bytes = base64.b64decode(file_data)
            drive_file_id = upload_any_file_to_google_drive(
                access_token=current_user.google_access_token,
                file_bytes=raw_bytes,
                filename=req.file_name,
                mime_type=req.file_mime_type or "application/pdf"
            )
            if drive_file_id:
                materials.append({
                    "driveFile": {
                        "driveFile": {
                            "id": drive_file_id,
                            "title": req.file_name
                        },
                        "shareMode": "VIEW"
                    }
                })
        except Exception as e:
            print(f"Direct file upload error: {e}")'''

new_upload_content_file = '''    # 1. If base64 file uploaded (e.g. syllabus, notes, paper)
    if req.file_content_base64 and req.file_name:
        file_data = req.file_content_base64
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]
        try:
            raw_bytes = base64.b64decode(file_data)
        except Exception as b64_err:
            raise HTTPException(status_code=400, detail=f"Invalid base64 file data: {b64_err}")

        drive_file_id, drive_err = upload_any_file_to_google_drive(
            access_token=current_user.google_access_token,
            file_bytes=raw_bytes,
            filename=req.file_name,
            mime_type=req.file_mime_type or "application/pdf"
        )
        if not drive_file_id:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to upload '{req.file_name}' to Google Drive: {drive_err}. Please ensure Google Drive permissions are authorized."
            )

        materials.append({
            "driveFile": {
                "driveFile": {
                    "id": drive_file_id
                },
                "shareMode": "VIEW"
            }
        })'''

if old_upload_content_file in text:
    text = text.replace(old_upload_content_file, new_upload_content_file, 1)
    print("upload_content_file updated!")
else:
    print("old_upload_content_file not found in classroom_router.py")

with open('backend/app/integrations/classroom_router.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: classroom_router.py updated!")

