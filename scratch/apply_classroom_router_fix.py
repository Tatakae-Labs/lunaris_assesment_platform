with open('backend/app/integrations/classroom_router.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update list_classroom_courses
target1 = '''    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        raise HTTPException(
            status_code=he.code,
            detail=f"Google Classroom: {err_msg}. Please re-connect Google Classroom."
        )'''

replacement1 = '''    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        if he.code == 401:
            current_user.google_access_token = None
            db.commit()
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        raise HTTPException(
            status_code=he.code,
            detail=f"Google Classroom: {err_msg}. Please re-connect Google Classroom."
        )'''

if target1 not in code:
    raise ValueError("target1 not found in classroom_router.py!")

code = code.replace(target1, replacement1, 1)

# 2. Update upload_classroom_content
target2 = '''    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        raise HTTPException(status_code=he.code, detail=f"Google Classroom API: {err_msg}")'''

replacement2 = '''    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        if he.code == 401:
            current_user.google_access_token = None
            db.commit()
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        if he.code == 403 and "insufficient" in str(err_msg).lower():
            err_msg = "Request had insufficient authentication scopes. Please click 'Re-authorize Google' in the Classroom Hub to grant Announcement and Course Material permissions."
        raise HTTPException(status_code=he.code, detail=f"Google Classroom API: {err_msg}")'''

if target2 not in code:
    raise ValueError("target2 not found in classroom_router.py!")

code = code.replace(target2, replacement2, 1)

with open('backend/app/integrations/classroom_router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: Updated backend/app/integrations/classroom_router.py!")

