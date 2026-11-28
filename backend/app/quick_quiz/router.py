import json
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.models import (
    Exam, ExamVersion, Question, User, ExamAttempt, AttemptAnswer, Organization,
    QuizRoom, QuizParticipant, QuizRound, QuizResponse, QuizLeaderboardSnapshot
)

router = APIRouter(prefix="/quick-quiz", tags=["Quick Quiz Engine"])

def generate_room_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(alphabet, k=6))


def _resolve_room_and_version(db: Session, clean_code: str):
    """Finds QuizRoom / ExamVersion in SQLite, hydrating from MongoDB across serverless instances if missing."""
    version = db.query(ExamVersion).filter(ExamVersion.room_code == clean_code).first()
    quiz_room = db.query(QuizRoom).filter(QuizRoom.room_code == clean_code).first()
    if version or quiz_room:
        return quiz_room, version

    try:
        from app.core.mongodb import get_mongodb
        from app.core.mongo_sync import _deserialize_doc_for_model
        import app.core.mongo_sync as mongo_sync
        db_mongo = get_mongodb()
        if db_mongo is not None:
            mongo_sync._hydrating_from_mongo = True
            try:
                qr_doc = db_mongo.quiz_rooms.find_one({"room_code": clean_code})
                ver_doc = db_mongo.exam_versions.find_one({"room_code": clean_code})
                org_id_hint = (qr_doc or {}).get("organization_id")
                if org_id_hint:
                    org_doc = db_mongo.organizations.find_one({"_id": str(org_id_hint)})
                    if org_doc:
                        o_kw = _deserialize_doc_for_model(Organization, org_doc)
                        if o_kw.get("id"):
                            db.merge(Organization(**o_kw))
                if ver_doc and ver_doc.get("exam_id"):
                    ex_doc = db_mongo.exams.find_one({"_id": str(ver_doc["exam_id"])})
                    if ex_doc:
                        e_kw = _deserialize_doc_for_model(Exam, ex_doc)
                        if e_kw.get("id"):
                            db.merge(Exam(**e_kw))
                if qr_doc:
                    kwargs = _deserialize_doc_for_model(QuizRoom, qr_doc)
                    if kwargs.get("id"):
                        db.merge(QuizRoom(**kwargs))
                        for p_doc in db_mongo.quiz_participants.find({"room_id": str(kwargs["id"])}):
                            p_kw = _deserialize_doc_for_model(QuizParticipant, p_doc)
                            if p_kw.get("id"):
                                db.merge(QuizParticipant(**p_kw))
                if ver_doc:
                    v_kw = _deserialize_doc_for_model(ExamVersion, ver_doc)
                    if v_kw.get("id"):
                        db.merge(ExamVersion(**v_kw))
                db.commit()
            finally:
                mongo_sync._hydrating_from_mongo = False
    except Exception as exc:
        db.rollback()
        print(f"Quick Quiz MongoDB hydration note: {exc}")

    version = db.query(ExamVersion).filter(ExamVersion.room_code == clean_code).first()
    quiz_room = db.query(QuizRoom).filter(QuizRoom.room_code == clean_code).first()
    return quiz_room, version

class QuickQuizJoinRequest(BaseModel):
    nickname: str
    email: Optional[str] = None

class QuickQuizAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_option_id: str
    time_spent_seconds: float

class ReconnectRequest(BaseModel):
    participant_token: str

class QuickQuizFinishRequest(BaseModel):
    session_id: str

@router.post("/create-room")
def create_quick_quiz_room(
    exam_id: str,
    per_question_time: int = 20,
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    from app.models import Organization
    org = db.query(Organization).filter(Organization.id == exam.organization_id).first()
    if org and not org.is_service_enabled("quick_quiz"):
        raise HTTPException(
            status_code=403,
            detail="Quick Quiz Live Arena service is disabled for your organization by the platform administrator."
        )

    effective_per_q = per_question_time if per_question_time != 20 else (exam.per_question_time_seconds or 20)
    room_code = generate_room_code()
    exam.room_code = room_code
    exam.mode = "quick_quiz"
    exam.per_question_time_seconds = effective_per_q
    exam.speed_scoring = True
    exam.status = "published"

    # Fetch questions linked to this exam (or fallback to organization bank)
    exam_settings = json.loads(exam.settings_json) if exam.settings_json else {}
    selected_q_ids = exam_settings.get("question_ids") or []
    if selected_q_ids:
        raw_qs = db.query(Question).filter(
            Question.organization_id == exam.organization_id,
            Question.id.in_(selected_q_ids)
        ).all()
        q_map = {q.id: q for q in raw_qs}
        questions = [q_map[qid] for qid in selected_q_ids if qid in q_map]
    else:
        questions = db.query(Question).filter(Question.organization_id == exam.organization_id).all()
    snapshot_questions = []
    for q in questions:
        content = json.loads(q.content_json)
        snapshot_questions.append({
            "id": q.id,
            "subject": q.subject,
            "type": q.question_type,
            "points_positive": 1000.0,
            "points_negative": 0.0,
            "content": content
        })

    version = ExamVersion(
        exam_id=exam.id,
        version_number=1,
        title=exam.title,
        mode="quick_quiz",
        room_code=room_code,
        per_question_time_seconds=effective_per_q,
        speed_scoring=True,
        duration_minutes=30,
        settings_json=json.dumps({"speed_scoring": True}),
        snapshot_json=json.dumps(snapshot_questions)
    )
    db.add(version)

    # Persist in QuizRoom table (Phase 7)
    quiz_room = QuizRoom(
        organization_id=exam.organization_id,
        room_code=room_code,
        title=exam.title,
        status="waiting",
        current_round=1,
        total_rounds=len(snapshot_questions),
        per_question_time_seconds=effective_per_q,
        speed_scoring=True,
        host_user_id=exam.created_by,
        questions_json=json.dumps(snapshot_questions)
    )
    db.add(quiz_room)
    db.commit()

    return {
        "room_code": room_code,
        "room_id": quiz_room.id,
        "exam_title": exam.title,
        "per_question_seconds": effective_per_q,
        "total_questions": len(snapshot_questions)
    }

@router.post("/rooms/{room_code}/join")
def join_quick_quiz_room(
    room_code: str,
    req: QuickQuizJoinRequest,
    db: Session = Depends(get_db)
):
    clean_code = room_code.strip().upper()
    quiz_room, version = _resolve_room_and_version(db, clean_code)

    if not version and not quiz_room:
        raise HTTPException(status_code=404, detail="Invalid room code. Check the code and try again.")

    # Create player user
    temp_email = req.email.lower() if req.email else f"player_{generate_uuid()[:8]}@quickquiz.local"
    user = db.query(User).filter(User.email == temp_email).first()
    if not user:
        user = User(
            email=temp_email,
            password_hash="QUICK_QUIZ_PLAYER",
            full_name=req.nickname
        )
        db.add(user)
        db.flush()

    # Resolve valid organization_id to satisfy FK constraint on ExamAttempt
    resolved_org_id = quiz_room.organization_id if quiz_room and quiz_room.organization_id else None
    if not resolved_org_id and version:
        parent_exam = db.query(Exam).filter(Exam.id == version.exam_id).first()
        if parent_exam:
            resolved_org_id = parent_exam.organization_id
    if not resolved_org_id:
        any_org = db.query(Organization).first()
        resolved_org_id = any_org.id if any_org else None

    # Create attempt session
    attempt = ExamAttempt(
        assignment_id="quick_quiz_assignment",
        exam_version_id=version.id if version else None,
        candidate_id=user.id,
        candidate_name=req.nickname,
        organization_id=resolved_org_id,
        started_at=datetime.now(timezone.utc),
        deadline_at=datetime.now(timezone.utc),
        status="in_progress",
        score_total=0.0
    )
    db.add(attempt)
    db.flush()

    # Create persistent QuizParticipant
    participant_token = f"part_{generate_uuid()[:16]}"
    if quiz_room:
        participant = QuizParticipant(
            id=attempt.id,
            room_id=quiz_room.id,
            participant_token=participant_token,
            nickname=req.nickname,
            score=0,
            streak=0,
            is_connected=True
        )
        db.add(participant)

    db.commit()

    # Sanitize questions for student
    raw_questions = json.loads(quiz_room.questions_json if quiz_room else version.snapshot_json)
    sanitized_questions = []
    for q in raw_questions:
        raw_c = q.get("content", {})
        sanitized_questions.append({
            "id": q["id"],
            "subject": q.get("subject", "General"),
            "text": raw_c.get("text", ""),
            "options": [
                {"id": opt["id"], "text": opt.get("text", "")}
                for opt in raw_c.get("options", [])
            ]
        })

    title = quiz_room.title if quiz_room else version.title
    per_q = (quiz_room.per_question_time_seconds if quiz_room else version.per_question_time_seconds) or 20

    return {
        "session_id": attempt.id,
        "participant_token": participant_token,
        "nickname": req.nickname,
        "room_code": clean_code,
        "exam_title": title,
        "per_question_seconds": per_q,
        "speed_scoring": True,
        "questions": sanitized_questions
    }

@router.post("/rooms/{room_code}/answer")
def submit_quick_quiz_answer(
    room_code: str,
    req: QuickQuizAnswerRequest,
    db: Session = Depends(get_db)
):
    clean_code = room_code.strip().upper()
    quiz_room, version = _resolve_room_and_version(db, clean_code)

    if not quiz_room and not version:
        raise HTTPException(status_code=404, detail="Room not found")

    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == req.session_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Session not found")

    raw_questions = json.loads(quiz_room.questions_json if quiz_room else version.snapshot_json)
    target_q = next((q for q in raw_questions if q["id"] == req.question_id), None)
    if not target_q:
        raise HTTPException(status_code=404, detail="Question not found")

    correct_opt_id = target_q.get("content", {}).get("correct_option_id")
    is_correct = (req.selected_option_id == correct_opt_id)

    limit = (quiz_room.per_question_time_seconds if quiz_room else version.per_question_time_seconds) or 20
    points_awarded = 0
    if is_correct:
        ratio = max(0.0, min(1.0, req.time_spent_seconds / limit))
        points_awarded = int(round(1000 * (1 - (ratio * 0.5))))

    attempt.score_total = (attempt.score_total or 0.0) + points_awarded

    # Update QuizParticipant if room exists
    participant = db.query(QuizParticipant).filter(QuizParticipant.id == req.session_id).first()
    if participant:
        participant.score += points_awarded
        if is_correct:
            participant.streak += 1
        else:
            participant.streak = 0
        if quiz_room:
            resp = QuizResponse(
                room_id=quiz_room.id,
                participant_id=participant.id,
                round_number=quiz_room.current_round or 1,
                selected_option=req.selected_option_id,
                is_correct=is_correct,
                time_taken_ms=int(req.time_spent_seconds * 1000),
                points_awarded=points_awarded
            )
            db.add(resp)

    db.commit()

    return {
        "is_correct": is_correct,
        "points_awarded": points_awarded,
        "current_total_score": int(attempt.score_total),
        "correct_option_id": correct_opt_id
    }

@router.post("/rooms/{room_code}/finish")
def finish_quick_quiz(
    room_code: str,
    req: QuickQuizFinishRequest,
    db: Session = Depends(get_db)
):
    clean_code = room_code.strip().upper()
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == req.session_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt session not found")

    now = datetime.now(timezone.utc)
    attempt.status = "completed"
    attempt.submitted_at = now

    quiz_room = db.query(QuizRoom).filter(QuizRoom.room_code == clean_code).first()
    if quiz_room:
        participant = db.query(QuizParticipant).filter(QuizParticipant.id == req.session_id).first()
        if participant:
            participant.is_connected = False

    db.commit()
    return {
        "status": "completed",
        "session_id": attempt.id,
        "score": int(attempt.score_total or 0),
        "submitted_at": now.isoformat()
    }

@router.get("/rooms/{room_code}/leaderboard")
def get_quick_quiz_leaderboard(
    room_code: str,
    db: Session = Depends(get_db)
):
    clean_code = room_code.strip().upper()
    quiz_room, version = _resolve_room_and_version(db, clean_code)

    if not quiz_room and not version:
        raise HTTPException(status_code=404, detail="Room not found")

    # Fetch top participants
    if quiz_room:
        participants = (
            db.query(QuizParticipant)
            .filter(QuizParticipant.room_id == quiz_room.id)
            .order_by(QuizParticipant.score.desc())
            .limit(20)
            .all()
        )
        rankings = [
            {
                "rank": idx + 1,
                "session_id": p.id,
                "nickname": p.nickname,
                "score": p.score,
                "streak": p.streak
            }
            for idx, p in enumerate(participants)
        ]
        title = quiz_room.title
    else:
        attempts = (
            db.query(ExamAttempt, User)
            .join(User, ExamAttempt.candidate_id == User.id)
            .filter(ExamAttempt.assignment_id == "quick_quiz_assignment")
            .order_by(ExamAttempt.score_total.desc())
            .limit(20)
            .all()
        )
        rankings = [
            {
                "rank": idx + 1,
                "session_id": att.id,
                "nickname": user.full_name,
                "score": int(att.score_total or 0),
                "streak": 0
            }
            for idx, (att, user) in enumerate(attempts)
        ]
        title = version.title

    return {
        "room_code": clean_code,
        "title": title,
        "leaderboard": rankings
    }

@router.post("/rooms/{room_code}/reconnect")
def reconnect_quick_quiz_player(
    room_code: str,
    req: ReconnectRequest,
    db: Session = Depends(get_db)
):
    """Allows players to reconnect after refresh without losing their score or streak (Phase 7)."""
    clean_code = room_code.strip().upper()
    quiz_room, _ = _resolve_room_and_version(db, clean_code)
    if not quiz_room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = db.query(QuizParticipant).filter(
        QuizParticipant.room_id == quiz_room.id,
        QuizParticipant.participant_token == req.participant_token
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant session not found")

    participant.is_connected = True
    db.commit()

    return {
        "session_id": participant.id,
        "nickname": participant.nickname,
        "score": participant.score,
        "streak": participant.streak,
        "current_round": quiz_room.current_round,
        "status": quiz_room.status,
        "message": "Player session restored successfully"
    }

@router.get("/rooms/{room_code}/state")
def get_quick_quiz_room_state(
    room_code: str,
    db: Session = Depends(get_db)
):
    """Real-time room state polling endpoint."""
    clean_code = room_code.strip().upper()
    quiz_room, _ = _resolve_room_and_version(db, clean_code)
    if not quiz_room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant_count = db.query(QuizParticipant).filter(
        QuizParticipant.room_id == quiz_room.id,
        QuizParticipant.is_connected == True
    ).count()

    return {
        "room_code": clean_code,
        "title": quiz_room.title,
        "status": quiz_room.status,
        "current_round": quiz_room.current_round,
        "total_rounds": quiz_room.total_rounds,
        "active_players": participant_count
    }
