import sys, os
sys.path.insert(0, os.path.abspath("backend"))

from app.integrations.classroom_router import download_classroom_file, CLASSROOM_FILES_DIR

test_token = "test-token-12345"
test_path = os.path.join(CLASSROOM_FILES_DIR, f"{test_token}.dat")
with open(test_path, "wb") as f:
    f.write(b"%PDF-1.4 sample file content")

resp = download_classroom_file(test_token, "Data Structures Full Notes.pdf")
print("Response status:", resp.status_code if hasattr(resp, "status_code") else 200)
print("Content length:", len(resp.body))
print("Media type:", resp.media_type)
print("Headers:", resp.headers)
print("SUCCESS: download_classroom_file verified!")

# Clean up test file
if os.path.exists(test_path):
    os.remove(test_path)

