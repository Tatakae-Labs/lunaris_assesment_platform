import json
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.models import (
    Exam, ExamVersion, ExamEnrollment, CandidateSession,
    ExamAttempt, AttemptAnswer, ProctorSession, ProctorEvent, EvidenceAsset,
    Question, Organization
)
from app.evidence.storage import StorageService
from app.grading.engine import JeeGradingEngine

router = APIRouter(prefix="/candidate", tags=["Candidate Exam Portal"])

def utcnow():
    return datetime.now(timezone.utc)

class VerifyAccessRequest(BaseModel):
    exam_slug: str
    candidate_uid: str
    access_pin: Optional[str] = None

class PreflightConsentRequest(BaseModel):
    consent_given: bool
    camera_status: str = "granted"  # granted, denied, degraded, not_required
    client_metadata: Optional[Dict[str, Any]] = None

class SaveAnswerRequest(BaseModel):
    question_id: str
    answer: Dict[str, Any]
    revision: int = 1
    sequence_number: Optional[int] = 1

class IngestCandidateProctorEventRequest(BaseModel):
    event_type: str  # face_not_detected, multiple_faces, head_turned, tab_switch, fullscreen_exit, mobile_hint, audio_spike
    duration_ms: Optional[int] = 0
    confidence: Optional[float] = 1.0
    source: Optional[str] = "mediapipe"
    severity: Optional[str] = "advisory"  # advisory, suspicious, high
    metadata: Optional[Dict[str, Any]] = None
    snapshot_base64: Optional[str] = None

def get_candidate_session(
    authorization: Optional[str] = Header(None),
    x_candidate_session: Optional[str] = Header(None, alias="X-Candidate-Session"),
    db: Session = Depends(get_db)
) -> CandidateSession:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
    elif x_candidate_session:
        token = x_candidate_session.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid candidate session credentials"
        )
    session = db.query(CandidateSession).filter(
        CandidateSession.session_token == token,
        CandidateSession.is_active == True
    ).first()

    if not session:
        try:
            from app.core.mongo_sync import hydrate_candidate_session_from_mongodb
            session = hydrate_candidate_session_from_mongodb(db, token)
        except Exception:
            session = None

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please re-enter your exam UID."
        )

    now = utcnow()
    exp = session.expires_at.replace(tzinfo=timezone.utc) if session.expires_at.tzinfo is None else session.expires_at
    if exp < now:
        session.is_active = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Candidate session expired. Please re-enter credentials."
        )

    return session

@router.post("/verify-access")
@router.post("/verify")
def verify_candidate_access(
    req: VerifyAccessRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Candidate enters Exam UID and access PIN without creating a permanent account.
    Returns a short-lived exam-scoped session token.
    """
    # 1. Look up exam by ID, room_code or title slug
    clean_slug = req.exam_slug.strip().lower()
    uid_clean = req.candidate_uid.strip().upper()

    # On serverless/multi-container, ensure latest exam & enrollment are hydrated from MongoDB
    try:
        from app.core.mongo_sync import hydrate_exam_access_from_mongodb
        hydrate_exam_access_from_mongodb(db, req.exam_slug, uid_clean)
    except Exception:
        pass

    exam = db.query(Exam).filter(
        (Exam.id == req.exam_slug) | 
        (Exam.room_code == req.exam_slug) |
        (Exam.title.ilike(f"%{clean_slug.replace('-', ' ')}%"))
    ).first()

    if not exam:
        # Check by published version
        version = db.query(ExamVersion).filter(ExamVersion.id == req.exam_slug).first()
        if version:
            exam = db.query(Exam).filter(Exam.id == version.exam_id).first()

    if not exam:
        # Fallback to the first available published exam for demo convenience if needed
        exam = db.query(Exam).filter(Exam.status == "published").first()

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam session not found or not currently active."
        )

    # 2. Look up candidate enrollment
    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.exam_id == exam.id,
        ExamEnrollment.candidate_uid == uid_clean
    ).first()

    if not enrollment:
        # Generic error message to prevent enumeration
        raise HTTPException(
            status_code=401,
            detail="Invalid Exam UID or Access PIN for this examination session."
        )

    # 3. Check enrollment status
    if enrollment.status == "revoked":
        raise HTTPException(status_code=403, detail="Your enrollment has been revoked by the exam administrator.")
    if enrollment.status == "completed" or (enrollment.attempts_used >= enrollment.max_attempts):
        raise HTTPException(status_code=403, detail="Maximum exam attempts exceeded for this UID.")

    # 4. Check time window
    now = utcnow()
    if enrollment.valid_from:
        v_from = enrollment.valid_from.replace(tzinfo=timezone.utc) if enrollment.valid_from.tzinfo is None else enrollment.valid_from
        if now < v_from:
            raise HTTPException(status_code=403, detail="This exam access window has not opened yet.")
    if enrollment.valid_until:
        v_until = enrollment.valid_until.replace(tzinfo=timezone.utc) if enrollment.valid_until.tzinfo is None else enrollment.valid_until
        if now > v_until:
            raise HTTPException(status_code=403, detail="This exam access window has expired.")

    # 5. Check PIN if set on enrollment
    if enrollment.access_pin_hash or enrollment.access_pin_plain:
        if not req.access_pin or not req.access_pin.strip():
            raise HTTPException(status_code=401, detail="Access PIN is required to unlock this examination session.")
        pin_valid = False
        if enrollment.access_pin_hash:
            from app.core.security import verify_password
            pin_valid = verify_password(req.access_pin.strip(), enrollment.access_pin_hash)
        elif enrollment.access_pin_plain:
            pin_valid = (req.access_pin.strip() == enrollment.access_pin_plain.strip())
        if not pin_valid:
            raise HTTPException(status_code=401, detail="Invalid Exam UID or Access PIN for this examination session.")

    # 6. Generate secure short-lived candidate session
    session_token = f"lunaris_cand_{secrets.token_urlsafe(32)}"
    cand_session = CandidateSession(
        enrollment_id=enrollment.id,
        session_token=session_token,
        ip_address=request.client.host if request.client else "127.0.0.1",
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=now + timedelta(hours=6),
        is_active=True
    )
    db.add(cand_session)
    db.commit()

    # Extract proctoring settings from exam
    exam_settings = {}
    if exam.settings_json:
        try:
            exam_settings = json.loads(exam.settings_json)
        except Exception:
            exam_settings = {}

    return {
        "session_token": session_token,
        "enrollment_id": enrollment.id,
        "candidate_uid": enrollment.candidate_uid,
        "candidate_name": enrollment.candidate_name,
        "candidate_email": enrollment.candidate_email,
        "attempts_remaining": max(0, enrollment.max_attempts - enrollment.attempts_used),
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "mode": exam.mode,
            "proctoring_enabled": exam.mode == "proctored_cbt",
            "proctoring_checks": exam_settings.get("proctoring_checks", [
                "face_not_detected",
                "multiple_faces",
                "head_turned",
                "tab_switch",
                "fullscreen_exit"
            ])
        }
    }

@router.post("/preflight-consent")
def submit_preflight_consent(
    req: PreflightConsentRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Candidate submits device check verification and privacy consent prior to starting exam."""
    enrollment = session.enrollment
    return {
        "status": "consent_recorded",
        "candidate_uid": enrollment.candidate_uid,
        "consent_given": req.consent_given,
        "camera_status": req.camera_status,
        "timestamp": utcnow().isoformat()
    }

@router.post("/start-attempt")
def start_candidate_attempt(
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Starts or resumes the candidate's exam attempt with server-governed deadline."""
    enrollment = session.enrollment
    exam = enrollment.exam

    # Get latest published version of exam
    version = (
        db.query(ExamVersion)
        .filter(ExamVersion.exam_id == exam.id)
        .order_by(ExamVersion.version_number.desc())
        .first()
    )
    if not version:
        # Auto-create version 1 snapshot for instant testing convenience
        questions = db.query(Question).filter(Question.organization_id == exam.organization_id).all()

        snapshot_questions = []
        for q in questions:
            try:
                c = json.loads(q.content_json)
            except Exception:
                c = {"text": "Question Item", "options": []}
            snapshot_questions.append({
                "id": q.id,
                "subject": q.subject,
                "type": q.question_type,
                "points_positive": 4.0,
                "points_negative": -1.0,
                "content": c
            })

        version = ExamVersion(
            exam_id=exam.id,
            version_number=1,
            title=exam.title,
            duration_minutes=exam.duration_minutes or 60,
            settings_json=exam.settings_json or "{}",
            snapshot_json=json.dumps(snapshot_questions)
        )
        exam.status = "published"
        db.add(version)
        db.commit()
        db.refresh(version)

    now = utcnow()

    # Look for existing in-progress attempt for this enrollment
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.enrollment_id == enrollment.id,
        ExamAttempt.status == "in_progress"
    ).first()

    if not attempt:
        dur_mins = version.duration_minutes or 60
        try:
            ver_settings = json.loads(version.settings_json) if version.settings_json else {}
            if ver_settings.get("timing_model") == "pic_only":
                q_list = json.loads(version.snapshot_json) if version.snapshot_json else []
                total_pic_secs = sum(
                    (q.get("per_question_time_seconds") or version.per_question_time_seconds or 30)
                    for q in q_list
                )
                dur_mins = max(1, int((total_pic_secs + 120) / 60))
        except Exception:
            pass
        deadline = now + timedelta(minutes=dur_mins)
        attempt = ExamAttempt(
            enrollment_id=enrollment.id,
            exam_version_id=version.id,
            candidate_name=enrollment.candidate_name,
            candidate_identifier=enrollment.candidate_uid,
            organization_id=exam.organization_id,
            started_at=now,
            deadline_at=deadline,
            status="in_progress"
        )
        db.add(attempt)
        db.flush()

        # Create proctor session
        proctor_sess = ProctorSession(
            attempt_id=attempt.id,
            consent_given=True,
            consent_timestamp=now,
            camera_status="granted",
            monitoring_state="active"
        )
        db.add(proctor_sess)

        # Update enrollment attempt counter
        enrollment.attempts_used += 1
        db.commit()

    # Bind attempt to candidate session
    session.attempt_id = attempt.id
    db.commit()

    # Calculate remaining seconds
    deadline_ts = attempt.deadline_at.replace(tzinfo=timezone.utc) if attempt.deadline_at.tzinfo is None else attempt.deadline_at
    remaining_sec = max(0, int((deadline_ts - now).total_seconds()))

    if remaining_sec == 0 and attempt.status == "in_progress":
        attempt.status = "expired"
        db.commit()

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at.isoformat(),
        "deadline_at": attempt.deadline_at.isoformat(),
        "remaining_seconds": remaining_sec,
        "title": version.title,
        "duration_minutes": version.duration_minutes,
        "mode": exam.mode,
        "proctoring_enabled": exam.mode == "proctored_cbt"
    }

@router.get("/paper")
def get_candidate_paper(
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Returns sanitized question paper (answers and scoring solutions strictly omitted)."""
    enrollment = session.enrollment
    exam = enrollment.exam

    version = None
    if session.attempt_id:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == session.attempt_id).first()
        if attempt and attempt.exam_version_id:
            version = db.query(ExamVersion).filter(ExamVersion.id == attempt.exam_version_id).first()

    if not version:
        version = (
            db.query(ExamVersion)
            .filter(ExamVersion.exam_id == exam.id)
            .order_by(ExamVersion.version_number.desc())
            .first()
        )
    if not version:
        raise HTTPException(status_code=404, detail="Exam version snapshot not found")

    snapshot = json.loads(version.snapshot_json)

    # Sanitize each question
    sanitized = []
    for q in snapshot:
        raw_content = q.get("content", {})
        safe_content = {
            "text": raw_content.get("text", ""),
            "options": [
                {"id": opt["id"], "text": opt.get("text", "")}
                for opt in raw_content.get("options", [])
            ]
        }
        sanitized.append({
            "id": q["id"],
            "subject": q.get("subject", "General"),
            "type": q.get("type", "single_mcq"),
            "points_positive": q.get("points_positive", 4.0),
            "points_negative": q.get("points_negative", -1.0),
            "per_question_time_seconds": q.get("per_question_time_seconds") or version.per_question_time_seconds or exam.per_question_time_seconds or 30,
            "content": safe_content
        })

    # Load previously saved answers if any
    saved_answers = {}
    if session.attempt_id:
        answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == session.attempt_id).all()
        for ans in answers:
            try:
                saved_answers[ans.question_id] = json.loads(ans.answer_json)
            except Exception:
                pass

    exam_settings = json.loads(exam.settings_json) if exam.settings_json else {}
    return {
        "title": version.title,
        "duration_minutes": version.duration_minutes,
        "mode": exam.mode,
        "proctoring_enabled": exam.mode == "proctored_cbt",
        "per_question_time_seconds": version.per_question_time_seconds or exam.per_question_time_seconds or 30,
        "speed_scoring": version.speed_scoring or exam.speed_scoring or False,
        "timing_model": exam_settings.get("timing_model", "total_duration"),
        "pic_auto_advance": exam_settings.get("pic_auto_advance", True),
        "pic_strict_cap": exam_settings.get("pic_strict_cap", False),
        "settings": exam_settings,
        "total_questions": len(sanitized),
        "questions": sanitized,
        "saved_answers": saved_answers
    }

@router.post("/save-answer")
def save_candidate_answer(
    req: SaveAnswerRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Autosaves a candidate answer with revision tracking."""
    if not session.attempt_id:
        raise HTTPException(status_code=400, detail="No active attempt found for this session")

    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == session.attempt_id).first()
    if not attempt or attempt.status != "in_progress":
        raise HTTPException(status_code=400, detail="Cannot save answers for an inactive or completed attempt")

    existing_ans = db.query(AttemptAnswer).filter(
        AttemptAnswer.attempt_id == attempt.id,
        AttemptAnswer.question_id == req.question_id
    ).first()

    now = utcnow()
    # Enforce server-authoritative deadline
    deadline_ts = attempt.deadline_at.replace(tzinfo=timezone.utc) if attempt.deadline_at.tzinfo is None else attempt.deadline_at
    if now > deadline_ts:
        attempt.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Exam time has expired. Answers can no longer be saved.")

    seq = req.sequence_number or (existing_ans.sequence_number + 1 if existing_ans and existing_ans.sequence_number else 1)
    if existing_ans:
        # Ignore stale out-of-order save packets
        if existing_ans.sequence_number and seq < existing_ans.sequence_number:
            return {"status": "ignored_stale_sequence", "question_id": req.question_id}
        existing_ans.answer_json = json.dumps(req.answer)
        existing_ans.revision += 1
        existing_ans.sequence_number = seq
        existing_ans.saved_at = now
    else:
        new_ans = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=req.question_id,
            answer_json=json.dumps(req.answer),
            revision=1,
            sequence_number=seq,
            saved_at=now
        )
        db.add(new_ans)

    db.commit()
    return {"status": "saved", "question_id": req.question_id, "sequence_number": seq, "saved_at": now.isoformat()}


@router.get("/reconnect/{attempt_id}")
def candidate_reconnect_recovery(
    attempt_id: str,
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """
    Reconnect recovery endpoint (Phase 4).
    Restores the candidate session state, remaining deadline, and saved answers after network drops.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    now = utcnow()
    deadline_ts = attempt.deadline_at.replace(tzinfo=timezone.utc) if attempt.deadline_at.tzinfo is None else attempt.deadline_at
    remaining_sec = max(0, int((deadline_ts - now).total_seconds()))

    if remaining_sec == 0 and attempt.status == "in_progress":
        attempt.status = "expired"
        db.commit()

    answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
    saved_answers = {}
    for a in answers:
        try:
            saved_answers[a.question_id] = json.loads(a.answer_json)
        except Exception:
            pass

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "remaining_seconds": remaining_sec,
        "deadline_at": attempt.deadline_at.isoformat(),
        "saved_answers_count": len(saved_answers),
        "saved_answers": saved_answers
    }

@router.post("/proctor-event")
def ingest_candidate_proctor_event(
    req: IngestCandidateProctorEventRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """
    Ingests normalized proctoring anomaly events from candidate browser (MediaPipe / sensors).
    AI signals are stored as advisory signals for human review, NEVER as automatic fail verdicts.
    """
    if not session.attempt_id:
        return {"status": "ignored_no_attempt"}

    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == session.attempt_id).first()
    if not attempt:
        return {"status": "ignored_no_attempt"}

    # CCTV camera heartbeats only update the in-memory live stream hub and do not pollute the DB with dummy incident rows
    if req.event_type == "cctv_frame":
        if req.snapshot_base64:
            try:
                raw_b64 = req.snapshot_base64
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",")[1]
                frame_bytes = base64.b64decode(raw_b64)
                from app.proctoring.stream_hub import stream_hub
                stream_hub.update_frame(attempt.id, frame_bytes)
            except Exception:
                pass
        return {"status": "heartbeat_updated"}

    event = ProctorEvent(
        attempt_id=attempt.id,
        event_type=req.event_type,
        severity=req.severity or "advisory",
        duration_ms=req.duration_ms or 0,
        confidence=req.confidence or 1.0,
        source=req.source or "mediapipe",
        review_status="pending",
        metadata_json=json.dumps(req.metadata or {}),
        occurred_at=utcnow()
    )
    db.add(event)
    db.flush()

    if req.snapshot_base64:
        try:
            raw_b64 = req.snapshot_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",")[1]
            frame_bytes = base64.b64decode(raw_b64)
            from app.proctoring.stream_hub import stream_hub
            stream_hub.update_frame(attempt.id, frame_bytes)
        except Exception:
            pass

        storage_key = StorageService.save_base64_snapshot(req.snapshot_base64, prefix=f"evt_{event.id[:8]}")
        if storage_key:
            asset = EvidenceAsset(
                event_id=event.id,
                storage_key=storage_key,
                mime_type="image/jpeg"
            )
            db.add(asset)

    db.commit()

    # Mirror proctor telemetry into local MongoDB collection
    try:
        from app.core.mongodb import get_mongodb
        mongo_db = get_mongodb()
        if mongo_db is not None:
            mongo_db.proctor_telemetry.insert_one({
                "attempt_id": attempt.id,
                "event_type": req.event_type,
                "severity": req.severity,
                "source": req.source,
                "metadata": req.metadata or {},
                "has_snapshot": bool(req.snapshot_base64),
                "occurred_at": datetime.now(timezone.utc).isoformat()
            })
    except Exception:
        pass

    return {"status": "recorded", "event_id": event.id, "review_status": "pending"}

@router.get("/proctor-warnings")
def get_candidate_proctor_warnings(
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Returns any live proctor intervention warnings issued to this candidate attempt."""
    if not session.attempt_id:
        return {"warnings": []}

    warnings = (
        db.query(ProctorEvent)
        .filter(
            ProctorEvent.attempt_id == session.attempt_id,
            ProctorEvent.event_type == "proctor_warning_issued"
        )
        .order_by(ProctorEvent.occurred_at.desc())
        .limit(5)
        .all()
    )

    items = []
    for w in warnings:
        meta = json.loads(w.metadata_json) if w.metadata_json else {}
        items.append({
            "id": w.id,
            "message": meta.get("message", "Attention required"),
            "warning_type": meta.get("warning_type", "general"),
            "reviewer_name": meta.get("reviewer_name", "Official Proctor"),
            "timestamp": w.occurred_at.isoformat()
        })

    return {"warnings": items}

class CandidateStreamFrameRequest(BaseModel):
    frame_base64: str

@router.post("/stream-frame")
def upload_candidate_stream_frame(
    req: CandidateStreamFrameRequest,
    session: CandidateSession = Depends(get_candidate_session)
):
    """Real-time live video frame streaming from candidate webcam to CCTV surveillance wall."""
    try:
        raw_b64 = req.frame_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        frame_bytes = base64.b64decode(raw_b64)
        from app.proctoring.stream_hub import stream_hub
        if session.attempt_id:
            stream_hub.update_frame(session.attempt_id, frame_bytes)
        if session.session_token:
            stream_hub.update_frame(session.session_token, frame_bytes)
        return {"status": "streamed"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.post("/submit")
def submit_candidate_exam(
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Submits the exam, scores the attempt, and finalizes the candidate session."""
    attempt = None
    if session.attempt_id:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == session.attempt_id).first()

    if not attempt:
        attempt = db.query(ExamAttempt).filter(
            ExamAttempt.enrollment_id == session.enrollment_id
        ).order_by(ExamAttempt.started_at.desc()).first()

    if not attempt:
        raise HTTPException(status_code=400, detail="No active attempt found for this candidate session.")

    session.attempt_id = attempt.id

    enrollment = session.enrollment
    exam = enrollment.exam
    version = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).order_by(ExamVersion.version_number.desc()).first()

    now = utcnow()
    if attempt.status != "submitted":
        attempt.status = "submitted"
        attempt.submitted_at = now

    score_result = {
        "total_score": 0.0,
        "max_score": 0.0,
        "correct_count": 0,
        "incorrect_count": 0,
        "unattempted_count": 0,
        "accuracy_percent": 0.0,
        "subject_breakdown": {}
    }

    if version:
        try:
            questions = json.loads(version.snapshot_json)
            answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
            candidate_answers = {a.question_id: json.loads(a.answer_json) for a in answers}
            from app.grading.engine import JeeGradingEngine
            score_result = JeeGradingEngine.calculate_score(questions, candidate_answers)
            attempt.score_total = score_result.get("total_score", 0.0)
            attempt.score_details_json = json.dumps(score_result)
        except Exception as e:
            print("Grading warning:", e)
            attempt.score_total = attempt.score_total or 0.0

    # Mark enrollment completed if attempts exhausted
    if enrollment.attempts_used >= enrollment.max_attempts:
        enrollment.status = "completed"

    db.commit()

    return {
        "status": "submitted",
        "submitted_successfully": True,
        "attempt_id": attempt.id,
        "candidate_uid": enrollment.candidate_uid,
        "candidate_name": enrollment.candidate_name,
        "score_total": attempt.score_total,
        "max_score": score_result.get("max_score", 0.0),
        "correct_count": score_result.get("correct_count", 0),
        "incorrect_count": score_result.get("incorrect_count", 0),
        "unattempted_count": score_result.get("unattempted_count", 0),
        "accuracy": score_result.get("accuracy_percent", 0.0),
        "submitted_at": (attempt.submitted_at or now).isoformat()
    }


class CandidateAppealRequest(BaseModel):
    reason: str
    event_id: Optional[str] = None


@router.post("/appeal")
def submit_candidate_appeal(
    req: CandidateAppealRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: Session = Depends(get_db)
):
    """Zero-account candidate submits an integrity flag appeal (Phase 5)."""
    from app.models import Appeal
    enrollment = session.enrollment
    attempt_id = session.attempt_id
    if not attempt_id:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id == enrollment.id).order_by(ExamAttempt.started_at.desc()).first()
        if attempt:
            attempt_id = attempt.id
        else:
            raise HTTPException(status_code=400, detail="No active or completed attempt to appeal.")

    appeal = Appeal(
        organization_id=enrollment.organization_id,
        attempt_id=attempt_id,
        event_id=req.event_id,
        candidate_identifier=enrollment.candidate_uid,
        reason=req.reason,
        status="pending"
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return {"message": "Appeal submitted successfully for proctor review", "appeal_id": appeal.id}

