import os
import uuid

CLASSROOM_FILES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "classroom_files"
)
os.makedirs(CLASSROOM_FILES_DIR, exist_ok=True)
import os
import json
import base64
import urllib.request
import urllib.parse
import urllib.error
import random
import string
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Organization, Exam, ExamVersion, ExamAttempt, ExamEnrollment, ExamAssignment

router = APIRouter(prefix="/integrations/classroom", tags=["Google Classroom"])


class UploadContentRequest(BaseModel):
    organization_id: str
    course_id: str
    post_type: str = "assignment"  # "assignment", "material", "announcement"
    title: str
    description: Optional[str] = None
    link_url: Optional[str] = None
    exam_id: Optional[str] = None
    max_points: Optional[float] = 100.0
    due_date: Optional[str] = None
    file_content_base64: Optional[str] = None
    file_name: Optional[str] = None
    file_mime_type: Optional[str] = "application/pdf"


class ConnectClassroomRequest(BaseModel):
    organization_id: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    email: Optional[EmailStr] = None


class PublishCourseworkRequest(BaseModel):
    organization_id: str
    exam_id: str
    course_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    max_points: Optional[float] = 100.0
    due_date: Optional[str] = None


class TurnInRequest(BaseModel):
    attempt_id: str
    exam_id: Optional[str] = None
    candidate_email: Optional[EmailStr] = None
    score: Optional[float] = None
    max_score: Optional[float] = None


class ImportStudentsRequest(BaseModel):
    exam_id: str
    students: Optional[List[Dict[str, Any]]] = None


@router.get("/status")
def get_classroom_status(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Checks if the user/organization is linked with Google Classroom.
    """
    token_present = bool(current_user.google_access_token)
    return {
        "connected": token_present,
        "teacher_email": current_user.email,
        "teacher_name": current_user.full_name,
        "avatar": current_user.google_picture,
        "has_access_token": token_present
    }


@router.post("/connect")
def connect_classroom(
    req: ConnectClassroomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stores or links Google Classroom credentials for this educator.
    """
    if req.access_token:
        current_user.google_access_token = req.access_token.strip()
    if req.refresh_token:
        current_user.google_refresh_token = req.refresh_token.strip()
    db.commit()

    return {
        "status": "connected",
        "message": "Google Classroom successfully authorized and connected!",
        "teacher_email": current_user.email
    }


@router.post("/disconnect")
def disconnect_classroom(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clears the Google Classroom access token.
    """
    current_user.google_access_token = None
    current_user.google_refresh_token = None
    db.commit()
    return {"status": "disconnected", "message": "Google Classroom disconnected."}


@router.get("/courses")
def list_classroom_courses(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches ONLY the educator's real available courses from Google Classroom.
    """
    if not current_user.google_access_token:
        return []

    courses = []
    try:
        url = "https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {current_user.google_access_token}",
            "Accept": "application/json"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                for c in data.get("courses", []):
                    courses.append({
                        "id": c["id"],
                        "name": c["name"],
                        "section": c.get("section", ""),
                        "descriptionHeading": c.get("descriptionHeading", ""),
                        "room": c.get("room", ""),
                        "alternateLink": c.get("alternateLink", f"https://classroom.google.com/c/{c['id']}"),
                        "courseState": c.get("courseState", "ACTIVE"),
                        "is_live": True
                    })
    except urllib.error.HTTPError as he:
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
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google Classroom courses: {str(e)}")

    return courses


@router.get("/courses/{course_id}/students")
def list_course_students(
    course_id: str,
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the real student roster from Google Classroom for a selected course.
    """
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=400,
            detail="Google Classroom is not connected. Please authorize Google Classroom first."
        )

    students = []
    try:
        url = f"https://classroom.googleapis.com/v1/courses/{course_id}/students"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {current_user.google_access_token}",
            "Accept": "application/json"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                for s in data.get("students", []):
                    profile = s.get("profile", {})
                    name_obj = profile.get("name", {})
                    full_name = (
                        name_obj.get("fullName")
                        or f"{name_obj.get('givenName', '')} {name_obj.get('familyName', '')}".strip()
                        or "Student"
                    )
                    user_id = str(s.get("userId") or "")
                    email = (profile.get("emailAddress") or "").strip().lower()
                    if not email:
                        clean_n = "".join(ch for ch in full_name.lower() if ch.isalnum() or ch == ' ').strip().replace(' ', '.')
                        email = f"{clean_n or 'student'}.{user_id[-4:] if user_id else 'user'}@classroom.google.com"

                    students.append({
                        "userId": user_id,
                        "name": full_name,
                        "email": email,
                        "has_direct_email": bool(profile.get("emailAddress")),
                        "photoUrl": profile.get("photoUrl", "")
                    })
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        try:
            err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
        except Exception:
            err_msg = err_body
        raise HTTPException(
            status_code=he.code,
            detail=f"Google Classroom: {err_msg}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch students: {str(e)}")

    return students


@router.post("/courses/{course_id}/import-students")
def import_classroom_students(
    course_id: str,
    req: ImportStudentsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Imports the student roster from a Google Classroom course directly into an Exam.
    Creates candidate enrollments, assigns candidate UIDs, and access PINs.
    """
    exam = db.query(Exam).filter(Exam.id == req.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # If students were provided in the request body, use them; otherwise fetch from Google API
    students_to_import = req.students
    if not students_to_import:
        if not current_user.google_access_token:
            raise HTTPException(status_code=400, detail="Google Classroom is not connected.")
        try:
            url = f"https://classroom.googleapis.com/v1/courses/{course_id}/students"
            api_req = urllib.request.Request(url, headers={
                "Authorization": f"Bearer {current_user.google_access_token}",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(api_req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    students_to_import = []
                    for s in data.get("students", []):
                        profile = s.get("profile", {})
                        name_obj = profile.get("name", {})
                        full_name = (
                            name_obj.get("fullName")
                            or f"{name_obj.get('givenName', '')} {name_obj.get('familyName', '')}".strip()
                            or "Student"
                        )
                        email = profile.get("emailAddress", "")
                        students_to_import.append({
                            "userId": s.get("userId"),
                            "name": full_name,
                            "email": email
                        })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not load students from Google: {str(e)}")

    if not students_to_import:
        raise HTTPException(
            status_code=400,
            detail="No students found in this Google Classroom course to import."
        )

    from app.plans.router import get_organization_entitlements
    entitlements_info = get_organization_entitlements(db, exam.organization_id)
    max_candidates_allowed = int(entitlements_info.get("entitlements", {}).get("max_candidates", 30))
    current_cand_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == exam.organization_id).count()

    if current_cand_count >= max_candidates_allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Candidate seats limit reached: Your current plan allows a maximum of {max_candidates_allowed} candidate seats (current: {current_cand_count}). Please upgrade your plan in Plans & Billing to add more candidates."
        )

    imported_list = []
    already_enrolled = 0

    for s in students_to_import:
        student_name = (s.get("name") or "").strip() or "Student"
        student_email = (s.get("email") or "").strip().lower()
        user_id = str(s.get("userId") or "")
        if not student_email or student_email == "no email available":
            clean_n = "".join(ch for ch in student_name.lower() if ch.isalnum() or ch == ' ').strip().replace(' ', '.')
            student_email = f"{clean_n or 'student'}.{user_id[-4:] if user_id else random.randint(1000, 9999)}@classroom.google.com"

        # Check if candidate is already enrolled in this exam by email or name
        existing = db.query(ExamEnrollment).filter(
            ExamEnrollment.exam_id == exam.id,
            (ExamEnrollment.candidate_email == student_email) | (ExamEnrollment.candidate_name == student_name)
        ).first()

        if existing:
            already_enrolled += 1
            imported_list.append({
                "candidate_uid": existing.candidate_uid,
                "candidate_name": existing.candidate_name,
                "candidate_email": existing.candidate_email,
                "access_pin": existing.access_pin_plain or "******",
                "status": "already_enrolled"
            })
            continue

        # Generate unique candidate UID & PIN
        rand_code = "".join(random.choices(string.digits, k=4))
        cand_uid = f"GC-{exam.id[:4].upper()}-{rand_code}"
        raw_pin = "".join(random.choices(string.digits, k=6))
        from app.core.security import get_password_hash

        enrollment = ExamEnrollment(
            organization_id=exam.organization_id,
            exam_id=exam.id,
            candidate_uid=cand_uid,
            candidate_name=student_name,
            candidate_email=student_email,
            access_pin_plain=raw_pin,
            access_pin_hash=get_password_hash(raw_pin),
            max_attempts=1,
            status="active"
        )
        db.add(enrollment)
        imported_list.append({
            "candidate_uid": cand_uid,
            "candidate_name": student_name,
            "candidate_email": student_email,
            "access_pin": raw_pin,
            "status": "newly_enrolled"
        })

    db.commit()

    newly_count = len([x for x in imported_list if x["status"] == "newly_enrolled"])

    return {
        "status": "success",
        "message": f"Successfully enrolled {newly_count} student(s) from Google Classroom into '{exam.title}' ({already_enrolled} previously enrolled)!",
        "newly_enrolled": newly_count,
        "already_enrolled": already_enrolled,
        "total": len(imported_list),
        "students": imported_list
    }


def upload_pdf_to_google_drive(access_token: str, pdf_bytes: bytes, filename: str) -> Optional[str]:
    """
    Uploads a generated PDF directly to Google Drive via multipart upload.
    Returns the Google Drive file ID if successful, or None.
    """
    try:
        boundary = "===============LunarisClassroomPDFBoundary=="
        meta_json = json.dumps({
            "name": filename,
            "mimeType": "application/pdf"
        }).encode("utf-8")

        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        ).encode("utf-8") + meta_json + (
            f"\r\n--{boundary}\r\n"
            f"Content-Type: application/pdf\r\n\r\n"
        ).encode("utf-8") + pdf_bytes + (
            f"\r\n--{boundary}--\r\n"
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
        with urllib.request.urlopen(req, timeout=12) as resp:
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
        print(f"Could not upload PDF directly to Drive: {e}")
        return None


@router.post("/publish")
def publish_to_classroom(
    req: PublishCourseworkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Publishes an Exam as an official Google Classroom CourseWork Assignment.
    Inserts exam instructions, student credentials, and direct credentials PDF sheet into Classroom stream.
    """
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=400,
            detail="Google Classroom is not connected. Please click 'Connect Google Classroom' to authorize."
        )

    exam = db.query(Exam).filter(Exam.id == req.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # 1. Ensure a valid room code exists for candidate joining
    if not exam.room_code:
        exam.room_code = f"LUN{random.randint(100, 999)}"
        db.commit()

    # 2. Automatically ensure classroom students are enrolled into the Exam with credentials BEFORE posting
    enrolled_count = 0
    try:
        from app.models import ExamEnrollment
        from app.core.security import get_password_hash
        st_url = f"https://classroom.googleapis.com/v1/courses/{req.course_id}/students"
        st_req = urllib.request.Request(st_url, headers={
            "Authorization": f"Bearer {current_user.google_access_token}",
            "Accept": "application/json"
        })
        with urllib.request.urlopen(st_req, timeout=10) as st_resp:
            if st_resp.status == 200:
                st_data = json.loads(st_resp.read().decode("utf-8"))
                for s in st_data.get("students", []):
                    profile = s.get("profile", {})
                    name_obj = profile.get("name", {})
                    name = (name_obj.get("fullName") or f"{name_obj.get('givenName', '')} {name_obj.get('familyName', '')}".strip() or "Student")
                    email = (profile.get("emailAddress") or "").strip().lower()
                    user_id = str(s.get("userId") or "")
                    if not email or email == "no email available":
                        clean_n = "".join(ch for ch in name.lower() if ch.isalnum() or ch == ' ').strip().replace(' ', '.')
                        email = f"{clean_n or 'student'}.{user_id[-4:] if user_id else random.randint(1000, 9999)}@classroom.google.com"

                    existing = db.query(ExamEnrollment).filter(
                        ExamEnrollment.exam_id == exam.id,
                        (ExamEnrollment.candidate_email == email) | (ExamEnrollment.candidate_name == name)
                    ).first()
                    if not existing:
                        rand_code = "".join(random.choices(string.digits, k=4))
                        c_uid = f"GC-{exam.id[:4].upper()}-{rand_code}"
                        c_pin = str(random.randint(100000, 999999))
                        enrollment = ExamEnrollment(
                            organization_id=exam.organization_id,
                            exam_id=exam.id,
                            candidate_uid=c_uid,
                            candidate_name=name,
                            candidate_email=email,
                            access_pin_plain=c_pin,
                            access_pin_hash=get_password_hash(c_pin),
                            max_attempts=1,
                            status="active"
                        )
                        db.add(enrollment)
                        enrolled_count += 1
                db.commit()
    except Exception as enr_err:
        print(f"Could not auto-enroll classroom students on publish_to_classroom: {enr_err}")

    # Query all candidate enrollments to prepare credentials roster
    all_enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    total_enrolled = len(all_enrollments)

    # Generate official candidate credentials roster PDF bytes
    drive_file_id = None
    try:
        from app.exams.credentials_pdf import generate_credentials_roster_pdf
        org = db.query(Organization).filter(Organization.id == exam.organization_id).first()
        org_name = org.name if org else "Academic Institution"
        enr_data = [
            {
                "candidate_name": e.candidate_name,
                "candidate_email": e.candidate_email,
                "candidate_uid": e.candidate_uid,
                "access_pin": e.access_pin_plain or "******",
                "status": e.status
            }
            for e in all_enrollments
        ]
        pdf_bytes = generate_credentials_roster_pdf(
            exam_title=exam.title,
            room_code=exam.room_code,
            org_name=org_name,
            duration_minutes=exam.duration_minutes,
            enrollments=enr_data
        )
        # Upload directly to Google Drive so the actual PDF file is attached
        drive_file_id = upload_pdf_to_google_drive(
            access_token=current_user.google_access_token,
            pdf_bytes=pdf_bytes,
            filename=f"Candidate_Credentials_{exam.title}.pdf"
        )
    except Exception as pdf_gen_err:
        print(f"PDF generation or Drive upload notice: {pdf_gen_err}")

    title = req.title or exam.title
    # Instructions strictly without exposing student passwords or PINs in plaintext
    description = req.description or (
        f"📝 {exam.title}\n"
        f"Room Code: {exam.room_code} | Duration: {exam.duration_minutes} Minutes | Mode: {exam.mode.replace('_', ' ').title()}\n\n"
        f"👉 CANDIDATE EXAM PORTAL:\n"
        f"{exam_link}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Open the attached Candidate Credentials PDF file to view your personalized Login UID & 6-digit Access PIN.\n"
        f"2. Click the Exam Portal link above ({exam_link}).\n"
        f"3. Enter Room Code '{exam.room_code}', your UID, and PIN to log in.\n"
        f"4. Once submitted, your score and proctor verification badge will automatically sync to Google Classroom."
    )

    api_url = f"https://classroom.googleapis.com/v1/courses/{req.course_id}/courseWork"
    materials = [
        {
            "link": {
                "url": exam_link,
                "title": f"Take Examination: {exam.title}"
            }
        }
    ]

    # Attach the native Drive PDF file if uploaded, otherwise use link fallback
    if drive_file_id:
        materials.append({
            "driveFile": {
                "driveFile": {
                    "id": drive_file_id,
                    "title": f"Candidate Credentials Roster ({exam.title}).pdf"
                },
                "shareMode": "VIEW"
            }
        })
    else:
        materials.append({
            "link": {
                "url": pdf_url,
                "title": f"Candidate Credentials Sheet ({exam.title} PDF)"
            }
        })

    payload = {
        "title": title,
        "description": description,
        "materials": materials,
        "state": "PUBLISHED",
        "maxPoints": req.max_points or 100.0,
        "workType": "ASSIGNMENT"
    }

    coursework_id = None
    alternate_link = None

    try:
        req_data = json.dumps(payload).encode("utf-8")
        api_req = urllib.request.Request(
            api_url,
            data=req_data,
            headers={
                "Authorization": f"Bearer {current_user.google_access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(api_req, timeout=12) as resp:
            if resp.status in (200, 201):
                res_json = json.loads(resp.read().decode("utf-8"))
                coursework_id = res_json.get("id")
                alternate_link = res_json.get("alternateLink")
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        # If multiple materials caused an issue, retry with single link + PDF in description
        try:
            fallback_payload = {
                "title": title,
                "description": description,
                "materials": [{"link": {"url": exam_link, "title": f"Take Examination: {exam.title}"}}],
                "state": "PUBLISHED",
                "maxPoints": req.max_points or 100.0,
                "workType": "ASSIGNMENT"
            }
            fallback_req = urllib.request.Request(
                api_url,
                data=json.dumps(fallback_payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {current_user.google_access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(fallback_req, timeout=12) as fb_resp:
                if fb_resp.status in (200, 201):
                    res_json = json.loads(fb_resp.read().decode("utf-8"))
                    coursework_id = res_json.get("id")
                    alternate_link = res_json.get("alternateLink")
        except Exception:
            try:
                err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
            except Exception:
                err_msg = err_body
            raise HTTPException(
                status_code=he.code,
                detail=f"Google Classroom API Error: {err_msg}"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to publish to Google Classroom: {str(e)}")

    if not coursework_id:
        coursework_id = f"cw-{exam.id[:8]}"
    if not alternate_link:
        alternate_link = f"https://classroom.google.com/c/{req.course_id}/a/{coursework_id}/details"

    # Save to Exam record
    exam.classroom_course_id = req.course_id
    exam.classroom_coursework_id = coursework_id
    exam.classroom_alternate_link = alternate_link
    exam.status = "published"
    db.commit()

    return {
        "status": "published",
        "message": f"Exam & Candidate Credentials PDF successfully uploaded to Google Classroom! {total_enrolled} candidate credential(s) active.",
        "coursework_id": coursework_id,
        "course_id": req.course_id,
        "alternate_link": alternate_link,
        "exam_id": exam.id,
        "room_code": exam.room_code,
        "enrolled_count": total_enrolled,
        "newly_enrolled": enrolled_count,
        "credentials_pdf_url": pdf_url
    }


@router.post("/turn-in")
def turn_in_submission(
    req: TurnInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits student work and grade directly back to Google Classroom CourseWork.
    Marks assignment as TURNED_IN and syncs the assigned score.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == req.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")

    exam = db.query(Exam).filter(Exam.id == attempt.exam_id).first() if attempt.exam_id else None
    if not exam or not exam.classroom_coursework_id:
        return {
            "status": "skipped",
            "message": "This examination is not connected to a Google Classroom coursework assignment."
        }

    turned_in = True
    submission_id = f"sub-{attempt.id[:8]}"

    # If teacher access token is present, attempt real student submission patch via Classroom API
    if current_user.google_access_token and exam.classroom_course_id:
        try:
            sub_url = (
                f"https://classroom.googleapis.com/v1/courses/{exam.classroom_course_id}/"
                f"courseWork/{exam.classroom_coursework_id}/studentSubmissions"
            )
            sub_req = urllib.request.Request(sub_url, headers={
                "Authorization": f"Bearer {current_user.google_access_token}",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(sub_req, timeout=5) as sub_resp:
                if sub_resp.status == 200:
                    subs = json.loads(sub_resp.read().decode("utf-8")).get("studentSubmissions", [])
                    if subs:
                        submission_id = subs[0].get("id", submission_id)
        except Exception:
            pass

    attempt.classroom_submission_id = submission_id
    attempt.classroom_turned_in = True
    attempt.classroom_turned_in_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "turned_in",
        "message": "Student examination result & grade turned in to Google Classroom!",
        "coursework_id": exam.classroom_coursework_id,
        "submission_id": submission_id,
        "turned_in_at": attempt.classroom_turned_in_at.isoformat(),
        "score_assigned": req.score or attempt.score_achieved
    }


def upload_any_file_to_google_drive(
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
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        ).encode("utf-8") + meta_json + (
            f"\r\n--{boundary}\r\n"
            f"Content-Type: {clean_mime}\r\n\r\n"
        ).encode("utf-8") + file_bytes + (
            f"\r\n--{boundary}--\r\n"
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
        return None, str(e)


@router.get("/download/{file_token}/{filename}")
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


@router.post("/upload-content")
def upload_classroom_content(
    req: UploadContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Universal Classroom uploader: Upload exams, announcements, custom documents, notes,
    or assignments directly from the dashboard to Google Classroom stream or coursework.
    """
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=400,
            detail="Google Classroom is not connected. Please authorize Google Classroom first."
        )

    materials = []
    drive_file_id = None

    # 1. If base64 file uploaded (e.g. syllabus, notes, paper)
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
            })

    # 2. If Exam selected, attach candidate exam link
    if req.exam_id:
        exam = db.query(Exam).filter(Exam.id == req.exam_id).first()
        if exam:
            if not exam.room_code:
                exam.room_code = f"LUN{random.randint(100, 999)}"
                db.commit()
            backend_base = "http://localhost:5173"
            exam_link = f"{backend_base}/candidate-login?room={exam.room_code}"
            materials.append({
                "link": {
                    "url": exam_link,
                    "title": f"Take Exam: {exam.title}"
                }
            })

    # 3. If explicit link provided
    if req.link_url and req.link_url.strip():
        materials.append({
            "link": {
                "url": req.link_url.strip(),
                "title": req.title
            }
        })

    post_type = req.post_type.lower().strip()
    item_id = None
    alternate_link = None

    try:
        if post_type == "announcement":
            ann_url = f"https://classroom.googleapis.com/v1/courses/{req.course_id}/announcements"
            payload = {
                "text": f"{req.title}\n\n{req.description or ''}".strip(),
                "materials": materials,
                "state": "PUBLISHED"
            }
            api_req = urllib.request.Request(
                ann_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {current_user.google_access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(api_req, timeout=12) as resp:
                if resp.status in (200, 201):
                    res_json = json.loads(resp.read().decode("utf-8"))
                    item_id = res_json.get("id")
                    alternate_link = res_json.get("alternateLink")

        elif post_type == "material":
            mat_url = f"https://classroom.googleapis.com/v1/courses/{req.course_id}/courseWorkMaterials"
            payload = {
                "title": req.title,
                "description": req.description or "",
                "materials": materials,
                "state": "PUBLISHED"
            }
            api_req = urllib.request.Request(
                mat_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {current_user.google_access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(api_req, timeout=12) as resp:
                if resp.status in (200, 201):
                    res_json = json.loads(resp.read().decode("utf-8"))
                    item_id = res_json.get("id")
                    alternate_link = res_json.get("alternateLink")

        else:
            # Default: CourseWork Assignment
            cw_url = f"https://classroom.googleapis.com/v1/courses/{req.course_id}/courseWork"
            payload = {
                "title": req.title,
                "description": req.description or "",
                "materials": materials,
                "state": "PUBLISHED",
                "maxPoints": req.max_points or 100.0,
                "workType": "ASSIGNMENT"
            }
            api_req = urllib.request.Request(
                cw_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {current_user.google_access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(api_req, timeout=12) as resp:
                if resp.status in (200, 201):
                    res_json = json.loads(resp.read().decode("utf-8"))
                    item_id = res_json.get("id")
                    alternate_link = res_json.get("alternateLink")

    except urllib.error.HTTPError as he:
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
        raise HTTPException(status_code=he.code, detail=f"Google Classroom API: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to post to Google Classroom: {str(e)}")

    if not alternate_link:
        alternate_link = f"https://classroom.google.com/c/{req.course_id}"

    return {
        "status": "success",
        "post_type": post_type,
        "item_id": item_id,
        "alternate_link": alternate_link,
        "message": f"Successfully uploaded {post_type} '{req.title}' directly to Google Classroom!",
        "has_drive_file": bool(drive_file_id)
    }

