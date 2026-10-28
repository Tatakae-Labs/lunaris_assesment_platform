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
    duration_minutes: int = 180  # Default JEE 3 hours
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

    settings = req.settings or {
        "shuffle_options": True,
        "negative_marking": True,
        "allow_calculator": False,
        "jee_sections": ["Physics", "Chemistry", "Mathematics"]
    }

    exam = Exam(
        organization_id=org.id,
        title=req.title,
        description=req.description,
        mode=req.mode or "proctored_cbt",
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

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_org_permission(db, current_user.id, exam.organization_id)

    # 1. Delete all enrollments, candidate sessions, and exam attempts
    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    for enr in enrollments:
        db.query(CandidateSession).filter(CandidateSession.enrollment_id == enr.id).delete(synchronize_session=False)
        attempts = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id == enr.id).all()
        for att in attempts:
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
            db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
            events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
            for ev in events:
                db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
                db.delete(ev)
            db.delete(att)
        db.delete(enr)

    # 2. Delete all versions and assignments
    versions = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).all()
    for ver in versions:
        db.query(ExamAssignment).filter(ExamAssignment.exam_version_id == ver.id).delete(synchronize_session=False)
        attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_version_id == ver.id).all()
        for att in attempts:
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete(synchronize_session=False)
            db.query(ProctorSession).filter(ProctorSession.attempt_id == att.id).delete(synchronize_session=False)
            events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).all()
            for ev in events:
                db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).delete(synchronize_session=False)
                db.delete(ev)
            db.delete(att)
        db.delete(ver)

    # 3. Delete the exam record
    db.delete(exam)
    db.commit()
    return {"message": "Exam and all associated data permanently deleted", "id": exam_id}

@router.post("/{exam_id}/publish")
def publish_exam(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    for q in questions:
        content = json.loads(q.content_json)
        snapshot_questions.append({
            "id": q.id,
            "subject": q.subject,
            "type": q.question_type,
            "points_positive": 4.0,
            "points_negative": -1.0,
            "content": content
        })

    version_count = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).count()
    new_version_num = version_count + 1

    version = ExamVersion(
        exam_id=exam.id,
        version_number=new_version_num,
        title=exam.title,
        duration_minutes=exam.duration_minutes,
        settings_json=exam.settings_json or "{}",
        snapshot_json=json.dumps(snapshot_questions)
    )
    exam.status = "published"
    db.add(version)
    db.commit()
    db.refresh(version)

    return {
        "version_id": version.id,
        "version_number": version.version_number,
        "question_count": len(snapshot_questions),
        "status": "published"
    }

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
    max_candidates_allowed = entitlements_info.get("entitlements", {}).get("max_candidates", 25)

    existing_count = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).count()

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
    max_candidates_allowed = entitlements_info.get("entitlements", {}).get("max_candidates", 500)
    existing_count = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).count()
    if existing_count >= max_candidates_allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Subscription entitlement limit reached: Maximum {max_candidates_allowed} candidates allowed."
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

    db.delete(enrollment)
    db.commit()
    return {"message": "Candidate enrollment permanently deleted", "id": enrollment_id, "candidate_uid": enrollment.candidate_uid}

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

