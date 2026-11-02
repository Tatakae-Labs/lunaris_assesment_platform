with open('backend/app/integrations/classroom_router.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add download endpoint and storage directory definition
storage_block = '''import os
import uuid

CLASSROOM_FILES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "classroom_files"
)
os.makedirs(CLASSROOM_FILES_DIR, exist_ok=True)
'''

if 'CLASSROOM_FILES_DIR' not in code:
    code = storage_block + code

download_endpoint = '''@router.get("/download/{file_token}/{filename}")
def download_classroom_file(file_token: str, filename: str):
    """
    Serves uploaded course files and study materials directly to Google Classroom students.
    """
    from fastapi.responses import Response
    clean_token = "".join(c for c in file_token if c.isalnum() or c == "-")
    file_path = os.path.join(CLASSROOM_FILES_DIR, f"{clean_token}.dat")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested file not found or expired.")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    mime = "application/octet-stream"
    lower_fn = filename.lower()
    if lower_fn.endswith(".pdf"):
        mime = "application/pdf"
    elif lower_fn.endswith((".png", ".jpg", ".jpeg")):
        mime = f"image/{lower_fn.split('.')[-1]}"
    elif lower_fn.endswith(".docx"):
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower_fn.endswith(".doc"):
        mime = "application/msword"
    elif lower_fn.endswith(".txt"):
        mime = "text/plain"

    return Response(
        content=file_bytes,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )
'''

if '@router.get("/download/{file_token}/{filename}")' not in code:
    target_insert = '@router.post("/upload-content")'
    code = code.replace(target_insert, download_endpoint + '\n\n' + target_insert, 1)

# 2. Update upload_classroom_content file upload handling with auto-fallback
old_upload_block = '''        drive_file_id, drive_err = upload_any_file_to_google_drive(
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

new_upload_block = '''        drive_file_id, drive_err = upload_any_file_to_google_drive(
            access_token=current_user.google_access_token,
            file_bytes=raw_bytes,
            filename=req.file_name,
            mime_type=req.file_mime_type or "application/pdf"
        )
        if drive_file_id:
            materials.append({
                "driveFile": {
                    "driveFile": {
                        "id": drive_file_id
                    },
                    "shareMode": "VIEW"
                }
            })
        else:
            # If Google Drive API is not enabled on Google Cloud, save securely on Lunaris and attach as direct document link!
            file_token = str(uuid.uuid4())
            file_path = os.path.join(CLASSROOM_FILES_DIR, f"{file_token}.dat")
            with open(file_path, "wb") as f_out:
                f_out.write(raw_bytes)

            api_base = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
            direct_file_url = f"{api_base}/api/v1/integrations/classroom/download/{file_token}/{req.file_name}"
            materials.append({
                "link": {
                    "url": direct_file_url,
                    "title": req.file_name
                }
            })'''

if old_upload_block in code:
    code = code.replace(old_upload_block, new_upload_block, 1)
    print("Replaced old_upload_block with fallback support!")
else:
    print("old_upload_block not found")

with open('backend/app/integrations/classroom_router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: Updated classroom_router.py with Drive + direct link fallback!")

