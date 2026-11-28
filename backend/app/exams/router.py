import os
import json
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, OrganizationMember, Exam, ExamVersion, Question, ExamAssignment

router = APIRouter(prefix="/exams", tags=["Exams"])

class CreateExamRequest(BaseModel):
    organization_id: str
    title: str
    description: Optional[str] = None
    mode: Optional[str] = "proctored_cbt"  # proctored_cbt, quick_quiz, standard_quiz
    duration_minutes: int = 180  # Default standard 3 hours
    per_question_time_seconds: Optional[int] = 30
    speed_scoring: Optional[bool] = False
    timing_model: Optional[str] = "total_duration"  # total_duration, pic_only, dual
    question_times: Optional[Dict[str, int]] = None
    question_ids: List[str]
    settings: Optional[Dict[str, Any]] = None

class UpdateExamRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class CreateEnrollmentRequest(BaseModel):
    candidate_name: str
    candidate_email: Optional[EmailStr] = None
    candidate_uid: Optional[str] = None
    access_pin: Optional[str] = None
    max_attempts: Optional[int] = 1

class UpdateEnrollmentRequest(BaseModel):
    candidate_name: Optional[str] = None
    candidate_email: Optional[EmailStr] = None
    access_pin: Optional[str] = None
    max_attempts: Optional[int] = None
    status: Optional[str] = None

class PublishExamRequest(BaseModel):
    pass

class AssignCandidatesRequest(BaseModel):
    candidate_emails: List[EmailStr]
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None

def check_org_permission(db: Session, user_id: str, org_id: str):
    from app.models import Organization
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_superadmin:
        return org
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.role.in_(["owner", "admin", "exam_author"])
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Insufficient exam management permissions")
    return org

@router.post("")
def create_exam(
    req: CreateExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_permission(db, current_user.id, req.organization_id)

    from app.plans.entitlements import check_entitlement
    allowed, reason, details = check_entitlement(db, org.id, "max_exams", requested=1)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=f"{reason} Please upgrade your plan in Plans & Billing to create more exams."
        )

    settings = req.settings or {
        "shuffle_options": True,
        "negative_marking": False,
        "allow_calculator": False,
        "sections": ["General"]
    }

    # Per-question time (PIC) and speed scoring
    per_q_seconds = req.per_question_time_seconds
    if per_q_seconds is None and req.settings:
        per_q_seconds = req.settings.get("per_question_time_seconds", 30)

    speed_sc = req.speed_scoring
    if speed_sc is None and req.settings:
        speed_sc = req.settings.get("speed_scoring", False)

    room_code = None
    if req.mode == "quick_quiz" or (req.settings and req.settings.get("generate_room_code")):
        import string
        room_code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))

    if req.timing_model:
        settings["timing_model"] = req.timing_model
    if req.question_times:
        settings["question_times"] = req.question_times

    exam = Exam(
        organization_id=org.id,
        title=req.title,
        description=req.description,
        mode=req.mode or "proctored_cbt",
        room_code=room_code,
        per_question_time_seconds=per_q_seconds or 30,
        speed_scoring=bool(speed_sc),
        duration_minutes=req.duration_minutes,
        created_by=current_user.id,
        settings_json=json.dumps(settings)
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    return {
        "id": exam.id,
        "title": exam.title,
        "mode": exam.mode,
        "room_code": exam.room_code,
        "per_question_time_seconds": exam.per_question_time_seconds,
        "speed_scoring": exam.speed_scoring,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status
    }

@router.get("")
def list_exams(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_permission(db, current_user.id, organization_id)
    from app.core.mongo_sync import reconcile_org_collection_deletions
    reconcile_org_collection_deletions(db, Exam, org.id)
    exams = db.query(Exam).filter(Exam.organization_id == org.id).order_by(Exam.created_at.desc()).all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "mode": e.mode,
            "room_code": e.room_code,
            "duration_minutes": e.duration_minutes,
            "status": e.status,
            "created_at": e.created_at.isoformat()
        }
        for e in exams
    ]

@router.get("/{exam_id}")
def get_exam_details(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full exam details including rules, settings, and versions."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    from app.models import ExamEnrollment, ExamVersion
    enrollment_count = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).count()
    version_count = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).count()

    return {
        "id": exam.id,
        "organization_id": exam.organization_id,
        "title": exam.title,
        "description": exam.description or "",
        "mode": exam.mode,
        "room_code": exam.room_code,
        "per_question_time_seconds": exam.per_question_time_seconds,
        "speed_scoring": exam.speed_scoring,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status,
        "settings": json.loads(exam.settings_json) if exam.settings_json else {},
        "enrollment_count": enrollment_count,
        "version_count": version_count,
        "created_at": exam.created_at.isoformat()
    }

@router.put("/{exam_id}")
def update_exam(
    exam_id: str,
    req: UpdateExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update exam details (title, description, duration, mode, status, settings)."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    if req.title is not None and req.title.strip():
        exam.title = req.title.strip()
    if req.description is not None:
        exam.description = req.description.strip()
    if req.mode is not None:
        exam.mode = req.mode
    if req.duration_minutes is not None:
        exam.duration_minutes = max(1, req.duration_minutes)
    if req.status is not None:
        exam.status = req.status
    if req.settings is not None:
        current_settings = json.loads(exam.settings_json) if exam.settings_json else {}
        current_settings.update(req.settings)
        exam.settings_json = json.dumps(current_settings)

    db.commit()
    db.refresh(exam)
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "mode": exam.mode,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status,
        "settings": json.loads(exam.settings_json) if exam.settings_json else {}
    }

@router.delete("/{exam_id}")
def delete_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete an exam and cleanly cascade all its enrollments, attempts, and versions."""
    from app.models import ExamEnrollment, ExamVersion, ExamAttempt, AttemptAnswer, ProctorEvent, EvidenceAsset, ProctorSession, CandidateSession, ExamAssignment
    from app.core.mongo_sync import delete_documents_from_mongodb

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    cs_ids, ans_ids, ps_ids, ea_ids, assign_ids = [], [], [], [], []
    # 1. Delete all enrollments, candidate sessions, and exam attempts
    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    for enr in enrollments:
        cs_ids.extend([r[0] for r in db.query(CandidateSession.id).filter(CandidateSession.enrollment_id == enr.id).all()])
        db.query(CandidateSession).filter(CandidateSession.enrollment_id == enr.id).delete(synchronize_session=False)
        attempts = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id == enr.id).all()
        for att in attempts:
            ans_ids.extend([r[0] for r in db.query(AttemptAnswer.id).filter(AttemptAnswer.attempt_id == att.id).all()])
            ps_ids.extend([r[0] for r in db.query(ProctorSession.id).filter(ProctorSession.attempt_id == att.id).all()])
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
            db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
            events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
            for ev in events:
                ea_ids.extend([r[0] for r in db.query(EvidenceAsset.id).filter(EvidenceAsset.event_id == ev.id).all()])
                db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
                db.delete(ev)
            db.delete(att)
        db.delete(enr)

    # 2. Delete all versions and assignments
    versions = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).all()
    for ver in versions:
        assign_ids.extend([r[0] for r in db.query(ExamAssignment.id).filter(ExamAssignment.exam_version_id == ver.id).all()])
        db.query(ExamAssignment).filter(ExamAssignment.exam_version_id == ver.id).delete(synchronize_session=False)
        attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_version_id == ver.id).all()
        for att in attempts:
            ans_ids.extend([r[0] for r in db.query(AttemptAnswer.id).filter(AttemptAnswer.attempt_id == att.id).all()])
            ps_ids.extend([r[0] for r in db.query(ProctorSession.id).filter(ProctorSession.attempt_id == att.id).all()])
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
            db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
            events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
            for ev in events:
                ea_ids.extend([r[0] for r in db.query(EvidenceAsset.id).filter(EvidenceAsset.event_id == ev.id).all()])
                db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
                db.delete(ev)
            db.delete(att)
        db.delete(ver)

    # 3. Delete the exam record
    db.delete(exam)
    db.commit()
    delete_documents_from_mongodb("candidate_sessions", cs_ids)
    delete_documents_from_mongodb("attempt_answers", ans_ids)
    delete_documents_from_mongodb("proctor_sessions", ps_ids)
    delete_documents_from_mongodb("evidence_assets", ea_ids)
    delete_documents_from_mongodb("exam_assignments", assign_ids)
    return {"message": "Exam and all associated data permanently deleted", "id": exam_id}

def auto_sync_classroom_for_exam(db: Session, exam: Exam, user: User) -> tuple:
    """
    Checks if the educator has Google Classroom connected.
    If so, fetches students from the active course, enrolls them into the exam with UID & PIN,
    and publishes the coursework to Google Classroom stream.
    Returns: (newly_enrolled_count, classroom_synced, course_name)
    """
    if not user.google_access_token:
        return (0, False, None)

    import urllib.request
    import json
    import random
    from app.models import ExamEnrollment
    from app.core.security import get_password_hash

    course_id = exam.classroom_course_id
    # Only sync with Classroom if this exam is explicitly designated for a Classroom course
    if not course_id:
        return (0, False, None)

    # If already published to this classroom coursework, do not post duplicate!
    if exam.classroom_coursework_id:
        return (0, True, getattr(exam, 'classroom_course_name', 'Classroom Course'))

    course_name = None

    try:
        # Fetch students
        st_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/students"
        st_req = urllib.request.Request(st_url, headers={
            "Authorization": f"Bearer {user.google_access_token}",
            "Accept": "application/json"
        })
        newly_enrolled = 0
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

                    # Check existing
                    existing = db.query(ExamEnrollment).filter(
                        ExamEnrollment.exam_id == exam.id,
                        (ExamEnrollment.candidate_email == email) | (ExamEnrollment.candidate_name == name)
                    ).first()
                    if not existing:
                        c_uid = f"LUN-{random.randint(100000, 999999)}"
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
                        newly_enrolled += 1

        db.commit()

        # Also publish assignment with credentials PDF to Classroom if not published
        if not exam.classroom_coursework_id:
            try:
                if not exam.room_code:
                    exam.room_code = f"LUN{random.randint(100, 999)}"
                    db.commit()

                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
                exam_link = f"{frontend_url}/candidate-login?room={exam.room_code}"
                api_url_base = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
                pdf_url = f"{api_url_base}/api/v1/exams/{exam.id}/credentials-pdf"

                # Instructions without exposing private student passwords or PINs in plaintext
                cw_description = (
                    f"📝 {exam.title}\n"
                    f"Room Code: {exam.room_code} | Duration: {exam.duration_minutes} Minutes | Mode: {exam.mode.replace('_', ' ').title()}\n\n"
                    f"👉 CANDIDATE EXAM PORTAL:\n"
                    f"{exam_link}\n\n"
                    f"INSTRUCTIONS:\n"
                    f"1. Open the attached Candidate Credentials PDF file to view your personalized Login UID & 6-digit Access PIN.\n"
                    f"2. Click the Exam Portal link above ({exam_link}).\n"
                    f"3. Enter Room Code '{exam.room_code}', your UID, and PIN to begin.\n"
                    f"4. Once submitted, your score and proctor verification badge will automatically sync to Google Classroom."
                )

                # Attempt to upload PDF directly into Google Drive for native attachment
                drive_file_id = None
                try:
                    from app.integrations.classroom_router import upload_pdf_to_google_drive
                    from app.exams.credentials_pdf import generate_credentials_roster_pdf
                    from app.models import Organization

                    org = db.query(Organization).filter(Organization.id == exam.organization_id).first()
                    org_name = org.name if org else "Academic Institution"
                    all_enrs = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
                    enr_data = [
                        {
                            "candidate_name": e.candidate_name,
                            "candidate_email": e.candidate_email,
                            "candidate_uid": e.candidate_uid,
                            "access_pin": e.access_pin_plain or "******",
                            "status": e.status
                        }
                        for e in all_enrs
                    ]
                    pdf_bytes = generate_credentials_roster_pdf(
                        exam_title=exam.title,
                        room_code=exam.room_code,
                        org_name=org_name,
                        duration_minutes=exam.duration_minutes,
                        enrollments=enr_data
                    )
                    drive_file_id = upload_pdf_to_google_drive(
                        access_token=user.google_access_token,
                        pdf_bytes=pdf_bytes,
                        filename=f"Candidate_Credentials_{exam.title}.pdf"
                    )
                except Exception as up_err:
                    print(f"Drive upload notice: {up_err}")

                materials = [{"link": {"url": exam_link, "title": f"Take Examination: {exam.title}"}}]
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
                    materials.append({"link": {"url": pdf_url, "title": f"Candidate Credentials Sheet ({exam.title} PDF)"}})

                cw_payload = {
                    "title": exam.title,
                    "description": cw_description,
                    "materials": materials,
                    "state": "PUBLISHED",
                    "maxPoints": 100.0,
                    "workType": "ASSIGNMENT"
                }
                cw_url = f"https://classroom.googleapis.com/v1/courses/{course_id}/courseWork"
                cw_req = urllib.request.Request(
                    cw_url,
                    data=json.dumps(cw_payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {user.google_access_token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                )
                with urllib.request.urlopen(cw_req, timeout=10) as cw_resp:
                    if cw_resp.status in (200, 201):
                        cw_res = json.loads(cw_resp.read().decode("utf-8"))
                        exam.classroom_coursework_id = cw_res.get("id")
                        exam.classroom_alternate_link = cw_res.get("alternateLink")
                        db.commit()
            except Exception as cw_err:
                print(f"Could not post assignment to classroom stream: {cw_err}")

        return (newly_enrolled, True, course_name)
    except Exception as e:
        print(f"Auto-sync classroom error on publish: {e}")
        return (0, False, None)


@router.post("/{exam_id}/publish")
def publish_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import ExamEnrollment
    from app.core.security import get_password_hash
    import random

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    # Fetch all questions configured for this organization (or linked to exam)
    questions = db.query(Question).filter(Question.organization_id == exam.organization_id).all()
    if not questions:
        raise HTTPException(status_code=400, detail="Cannot publish an exam with no questions available")

    # Snapshot questions with points
    snapshot_questions = []
    exam_settings = json.loads(exam.settings_json) if exam.settings_json else {}
    q_times = exam_settings.get("question_times", {})
    for q in questions:
        content = json.loads(q.content_json)
        q_time = q_times.get(q.id) or exam.per_question_time_seconds or 30
        snapshot_questions.append({
            "id": q.id,
            "subject": q.subject,
            "type": q.question_type,
            "points_positive": 4.0,
            "points_negative": -1.0,
            "per_question_time_seconds": q_time,
            "content": content
        })

    version_count = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).count()
    new_version_num = version_count + 1

    version = ExamVersion(
        exam_id=exam.id,
        version_number=new_version_num,
        title=exam.title,
        mode=exam.mode,
        room_code=exam.room_code,
        per_question_time_seconds=exam.per_question_time_seconds or 30,
        speed_scoring=exam.speed_scoring or False,
        duration_minutes=exam.duration_minutes,
        settings_json=exam.settings_json or "{}",
        snapshot_json=json.dumps(snapshot_questions)
    )
    exam.status = "published"
    db.add(version)
    db.commit()
    db.refresh(version)

    # Auto-enroll students from Google Classroom
    newly_enrolled, classroom_synced, course_name = auto_sync_classroom_for_exam(db, exam, current_user)

    # Ensure candidate enrollments exist
    existing_enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    if not existing_enrollments:
        starter_candidates = [
            ("Candidate #1 (Demo Roster)", "candidate1@institution.edu"),
            ("Candidate #2 (Demo Roster)", "candidate2@institution.edu"),
            ("Candidate #3 (Demo Roster)", "candidate3@institution.edu"),
            ("Candidate #4 (Demo Roster)", "candidate4@institution.edu"),
            ("Candidate #5 (Demo Roster)", "candidate5@institution.edu")
        ]
        for name, email in starter_candidates:
            c_uid = f"LUN-{random.randint(100000, 999999)}"
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
        db.commit()
        existing_enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()

    enrollments_summary = [
        {
            "candidate_name": e.candidate_name,
            "candidate_email": e.candidate_email,
            "candidate_uid": e.candidate_uid,
            "access_pin": e.access_pin_plain or "******",
            "status": e.status
        }
        for e in existing_enrollments
    ]

    return {
        "version_id": version.id,
        "version_number": version.version_number,
        "question_count": len(snapshot_questions),
        "status": "published",
        "exam_id": exam.id,
        "room_code": exam.room_code or f"ROOM-{exam.id[:6].upper()}",
        "enrolled_count": len(existing_enrollments),
        "classroom_synced": classroom_synced,
        "classroom_course_name": course_name,
        "credentials_pdf_url": f"/api/v1/exams/{exam.id}/credentials-pdf",
        "enrollments": enrollments_summary
    }


@router.get("/{exam_id}/credentials-pdf")
def download_credentials_pdf(
    exam_id: str,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Downloads the official candidate credentials and login roster sheet in printable PDF format.
    """
    from fastapi.responses import Response
    from app.models import Organization, ExamEnrollment
    from app.exams.credentials_pdf import generate_credentials_roster_pdf

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    org = db.query(Organization).filter(Organization.id == exam.organization_id).first()
    org_name = org.name if org else "Academic Institution"

    enrollments = (
        db.query(ExamEnrollment)
        .filter(ExamEnrollment.exam_id == exam.id)
        .order_by(ExamEnrollment.candidate_name.asc())
        .all()
    )

    enr_data = [
        {
            "candidate_name": e.candidate_name,
            "candidate_email": e.candidate_email,
            "candidate_uid": e.candidate_uid,
            "access_pin": e.access_pin_plain or "******",
            "status": e.status
        }
        for e in enrollments
    ]

    pdf_bytes = generate_credentials_roster_pdf(
        exam_title=exam.title,
        room_code=exam.room_code or f"ROOM-{exam.id[:6].upper()}",
        org_name=org_name,
        duration_minutes=exam.duration_minutes,
        enrollments=enr_data
    )

    filename = f"Credentials_{exam.room_code or exam.id[:6]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

class BulkGenerateEnrollmentsRequest(BaseModel):
    count: Optional[int] = 10
    candidates: Optional[List[Dict[str, str]]] = None  # [{ name, email, uid, pin }]
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_attempts: int = 1

@router.post("/{exam_id}/enrollments/bulk-generate")
def bulk_generate_enrollments(
    exam_id: str,
    req: BulkGenerateEnrollmentsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import ExamEnrollment
    import random

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    # Check organization plan entitlement limit
    from app.plans.router import get_organization_entitlements
    entitlements_info = get_organization_entitlements(db, exam.organization_id)
    max_candidates_allowed = int(entitlements_info.get("entitlements", {}).get("max_candidates", 30))

    existing_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == exam.organization_id).count()

    created_enrollments = []
    now = datetime.now(timezone.utc)
    v_from = req.valid_from or now
    v_until = req.valid_until or (now + timedelta(days=30))

    if req.candidates and len(req.candidates) > 0:
        if existing_count + len(req.candidates) > max_candidates_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Subscription entitlement limit reached: Maximum {max_candidates_allowed} candidates allowed under your current plan. Please upgrade to Creator Pro or Institution tier."
            )
        for cand in req.candidates:
            c_name = cand.get("name") or "Enrolled Candidate"
            c_email = cand.get("email")
            c_uid = cand.get("uid") or f"LUN-{random.randint(100000, 999999)}"
            c_pin = cand.get("pin") or str(random.randint(1000, 9999))
            from app.core.security import get_password_hash
            pin_hash = get_password_hash(c_pin)

            enrollment = ExamEnrollment(
                organization_id=exam.organization_id,
                exam_id=exam.id,
                candidate_uid=c_uid.upper(),
                access_pin_hash=pin_hash,
                access_pin_plain=c_pin,
                candidate_name=c_name,
                candidate_email=c_email,
                max_attempts=req.max_attempts,
                valid_from=v_from,
                valid_until=v_until,
                status="active"
            )
            db.add(enrollment)
            created_enrollments.append({
                "uid": enrollment.candidate_uid,
                "candidate_uid": enrollment.candidate_uid,
                "pin": c_pin,
                "access_pin": c_pin,
                "name": enrollment.candidate_name,
                "candidate_name": enrollment.candidate_name,
                "email": enrollment.candidate_email
            })
    else:
        req_count = min(max(1, req.count or 10), 500)
        if existing_count + req_count > max_candidates_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Subscription entitlement limit reached: Maximum {max_candidates_allowed} candidates allowed under your current plan. Please upgrade to Creator Pro or Institution tier."
            )
        from app.core.security import get_password_hash
        for i in range(req_count):
            c_uid = f"LUN-{random.randint(100000, 999999)}"
            c_pin = str(random.randint(1000, 9999))
            pin_hash = get_password_hash(c_pin)
            enrollment = ExamEnrollment(
                organization_id=exam.organization_id,
                exam_id=exam.id,
                candidate_uid=c_uid,
                access_pin_hash=pin_hash,
                access_pin_plain=c_pin,
                candidate_name=f"Candidate #{existing_count + i + 1}",
                max_attempts=req.max_attempts,
                valid_from=v_from,
                valid_until=v_until,
                status="active"
            )
            db.add(enrollment)
            created_enrollments.append({
                "uid": enrollment.candidate_uid,
                "candidate_uid": enrollment.candidate_uid,
                "pin": c_pin,
                "access_pin": enrollment.access_pin_plain,
                "name": enrollment.candidate_name,
                "candidate_name": enrollment.candidate_name,
                "email": ""
            })

    db.commit()
    return {
        "message": f"Successfully enrolled {len(created_enrollments)} candidates!",
        "count": len(created_enrollments),
        "exam_title": exam.title,
        "enrollments": created_enrollments
    }

@router.get("/{exam_id}/enrollments")
def list_exam_enrollments(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import ExamEnrollment

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    enrollments = (
        db.query(ExamEnrollment)
        .filter(ExamEnrollment.exam_id == exam.id)
        .order_by(ExamEnrollment.created_at.desc())
        .all()
    )

    return [
        {
            "id": e.id,
            "candidate_uid": e.candidate_uid,
            "access_pin": e.access_pin_plain,
            "candidate_name": e.candidate_name,
            "candidate_email": e.candidate_email,
            "attempts_used": e.attempts_used,
            "max_attempts": e.max_attempts,
            "status": e.status,
            "valid_from": e.valid_from.isoformat() if e.valid_from else None,
            "valid_until": e.valid_until.isoformat() if e.valid_until else None,
            "created_at": e.created_at.isoformat()
        }
        for e in enrollments
    ]

@router.post("/{exam_id}/enrollments")
def create_student_enrollment(
    exam_id: str,
    req: CreateEnrollmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually enroll a single candidate with custom or auto-generated UID & PIN."""
    from app.models import ExamEnrollment
    from app.core.security import get_password_hash
    import random

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    from app.plans.router import get_organization_entitlements
    entitlements_info = get_organization_entitlements(db, exam.organization_id)
    max_candidates_allowed = int(entitlements_info.get("entitlements", {}).get("max_candidates", 30))
    existing_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == exam.organization_id).count()
    if existing_count >= max_candidates_allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Candidate seats limit reached: Your current plan allows a maximum of {max_candidates_allowed} candidate seats (current: {existing_count}). Please upgrade your plan in Plans & Billing to add more candidates."
        )

    c_uid = (req.candidate_uid or f"LUN-{random.randint(100000, 999999)}").strip().upper()
    existing_uid = db.query(ExamEnrollment).filter(
        ExamEnrollment.exam_id == exam.id,
        ExamEnrollment.candidate_uid == c_uid
    ).first()
    if existing_uid:
        raise HTTPException(status_code=400, detail=f"Candidate with UID '{c_uid}' already exists in this exam")

    c_pin = req.access_pin.strip() if (req.access_pin and req.access_pin.strip()) else str(random.randint(1000, 9999))
    pin_hash = get_password_hash(c_pin)

    enrollment = ExamEnrollment(
        organization_id=exam.organization_id,
        exam_id=exam.id,
        candidate_uid=c_uid,
        access_pin_hash=pin_hash,
        access_pin_plain=c_pin,
        candidate_name=req.candidate_name.strip(),
        candidate_email=str(req.candidate_email).strip().lower() if req.candidate_email else None,
        max_attempts=max(1, req.max_attempts or 1),
        status="active"
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    return {
        "id": enrollment.id,
        "candidate_uid": enrollment.candidate_uid,
        "access_pin": enrollment.access_pin_plain,
        "candidate_name": enrollment.candidate_name,
        "candidate_email": enrollment.candidate_email,
        "attempts_used": enrollment.attempts_used,
        "max_attempts": enrollment.max_attempts,
        "status": enrollment.status,
        "created_at": enrollment.created_at.isoformat()
    }

@router.put("/{exam_id}/enrollments/{enrollment_id}")
def update_student_enrollment(
    exam_id: str,
    enrollment_id: str,
    req: UpdateEnrollmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update candidate details (name, email, access PIN, attempts, status)."""
    from app.models import ExamEnrollment
    from app.core.security import get_password_hash

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.id == enrollment_id,
        ExamEnrollment.exam_id == exam.id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if req.candidate_name is not None and req.candidate_name.strip():
        enrollment.candidate_name = req.candidate_name.strip()
    if req.candidate_email is not None:
        enrollment.candidate_email = str(req.candidate_email).strip().lower() if req.candidate_email else None
    if req.access_pin is not None and req.access_pin.strip():
        enrollment.access_pin_plain = req.access_pin.strip()
        enrollment.access_pin_hash = get_password_hash(req.access_pin.strip())
    if req.max_attempts is not None:
        enrollment.max_attempts = max(1, req.max_attempts)
    if req.status is not None:
        enrollment.status = req.status

    db.commit()
    db.refresh(enrollment)
    return {
        "id": enrollment.id,
        "candidate_uid": enrollment.candidate_uid,
        "access_pin": enrollment.access_pin_plain,
        "candidate_name": enrollment.candidate_name,
        "candidate_email": enrollment.candidate_email,
        "attempts_used": enrollment.attempts_used,
        "max_attempts": enrollment.max_attempts,
        "status": enrollment.status
    }

@router.delete("/{exam_id}/enrollments/{enrollment_id}")
def delete_student_enrollment(
    exam_id: str,
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete a candidate enrollment and associated attempt data."""
    from app.models import ExamEnrollment, CandidateSession, ExamAttempt, AttemptAnswer, ProctorSession, ProctorEvent, EvidenceAsset

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.id == enrollment_id,
        ExamEnrollment.exam_id == exam.id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Cascade delete candidate sessions and attempts
    db.query(CandidateSession).filter(CandidateSession.enrollment_id == enrollment.id).delete(synchronize_session=False)
    attempts = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id == enrollment.id).all()
    for att in attempts:
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
        for ev in events:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
            db.delete(ev)
        db.delete(att)

    cand_uid = enrollment.candidate_uid
    db.delete(enrollment)
    db.commit()
    return {"message": "Candidate enrollment permanently deleted", "id": enrollment_id, "candidate_uid": cand_uid}

@router.post("/{exam_id}/enrollments/{enrollment_id}/revoke")
def revoke_enrollment(
    exam_id: str,
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import ExamEnrollment

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.id == enrollment_id,
        ExamEnrollment.exam_id == exam.id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    enrollment.status = "revoked"
    db.commit()
    return {"status": "revoked", "candidate_uid": enrollment.candidate_uid}

@router.post("/{exam_id}/assignments")
def assign_candidates(
    exam_id: str,
    req: AssignCandidatesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    version = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).order_by(ExamVersion.version_number.desc()).first()
    if not version:
        raise HTTPException(status_code=400, detail="Exam must be published before candidates can be assigned")

    now = datetime.now(timezone.utc)
    opens_at = req.opens_at or now
    closes_at = req.closes_at or (now + timedelta(days=7))

    created_assignments = []
    for email in req.candidate_emails:
        user = db.query(User).filter(User.email == email.lower()).first()
        if not user:
            user = User(
                email=email.lower(),
                password_hash="INVITED_PLACEHOLDER",
                full_name=email.split("@")[0]
            )
            db.add(user)
            db.flush()

        invite_token = secrets.token_urlsafe(32)
        assignment = ExamAssignment(
            organization_id=exam.organization_id,
            exam_version_id=version.id,
            candidate_id=user.id,
            invite_token=invite_token,
            opens_at=opens_at,
            closes_at=closes_at
        )
        db.add(assignment)
        db.flush()
        created_assignments.append({
            "email": email,
            "invite_token": invite_token,
            "assignment_id": assignment.id
        })

    db.commit()
    return {"assigned_count": len(created_assignments), "assignments": created_assignments}
class BulkDeleteEnrollmentsRequest(BaseModel):
    enrollment_ids: List[str]


@router.post("/{exam_id}/enrollments/bulk-delete")
def bulk_delete_student_enrollments(
    exam_id: str,
    req: BulkDeleteEnrollmentsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk delete candidate enrollments and cascade associated sessions and attempt logs."""
    from app.models import ExamEnrollment, CandidateSession, ExamAttempt, AttemptAnswer, ProctorSession, ProctorEvent, EvidenceAsset
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    if not req.enrollment_ids:
        return {"status": "success", "deleted_count": 0, "message": "No enrollments specified"}

    enrollments = db.query(ExamEnrollment).filter(
        ExamEnrollment.id.in_(req.enrollment_ids),
        ExamEnrollment.exam_id == exam.id
    ).all()

    enr_ids = [e.id for e in enrollments]
    if not enr_ids:
        return {"status": "success", "deleted_count": 0, "message": "No matching enrollments found"}

    db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enr_ids)).delete(synchronize_session=False)
    attempts = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id.in_(enr_ids)).all()
    for att in attempts:
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
        for ev in events:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
            db.delete(ev)
        db.delete(att)

    deleted_count = db.query(ExamEnrollment).filter(
        ExamEnrollment.id.in_(enr_ids),
        ExamEnrollment.exam_id == exam.id
    ).delete(synchronize_session=False)

    db.commit()
    return {"status": "success", "deleted_count": deleted_count, "message": f"Successfully removed {deleted_count} candidate enrollment(s)"}


@router.post("/{exam_id}/send-invites")
def send_exam_email_invites(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Emails Room Code, Candidate UID, PIN, and portal link to all enrolled candidates with an email."""
    from app.models import ExamEnrollment, Organization
    from app.core.email import send_email

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    org = db.query(Organization).filter(Organization.id == exam.organization_id).first()
    org_name = org.name if org else "Lunaris Assessment Platform"
    frontend_url = os.getenv("FRONTEND_URL", "https://lunarisedu.tatakaelabs.tech").rstrip("/")
    portal_link = f"{frontend_url}/candidate-login?room={exam.room_code}" if exam.room_code else f"{frontend_url}/candidate-login"

    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    sent = 0
    for enr in enrollments:
        if not enr.candidate_email or "@" not in enr.candidate_email:
            continue
        pin_text = enr.access_pin_plain or "(Provided by instructor)"
        html = f"""
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="margin: 0 0 8px 0; color: #0f172a;">Exam Invitation: {exam.title}</h2>
          <p style="color: #475569; font-size: 14px;">Hello {enr.candidate_name or 'Candidate'}, you are enrolled for <strong>{exam.title}</strong> hosted by <strong>{org_name}</strong>.</p>
          <div style="background: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #0f172a;">
            <div><strong>Room Code:</strong> {exam.room_code or exam.id}</div>
            <div><strong>Candidate UID:</strong> {enr.candidate_uid}</div>
            <div><strong>Access PIN:</strong> {pin_text}</div>
            <div><strong>Duration:</strong> {exam.duration_minutes} minutes</div>
          </div>
          <a href="{portal_link}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            Open Candidate Exam Portal →
          </a>
        </div>
        """
        send_email(
            to_email=enr.candidate_email,
            subject=f"[{org_name}] Exam Access Credentials: {exam.title}",
            html_content=html,
        )
        sent += 1

    return {"status": "success", "invites_dispatched": sent, "total_enrollments": len(enrollments)}

