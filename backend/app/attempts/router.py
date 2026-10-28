import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, ExamAssignment, ExamAttempt, ExamVersion, AttemptAnswer
from app.grading.engine import JeeGradingEngine

router = APIRouter(prefix="/attempts", tags=["Exam Attempts"])

class StartAttemptRequest(BaseModel):
    invite_token: str

class SaveAnswerRequest(BaseModel):
    answer: Dict[str, Any]  # { selected_options: [...], numerical_value: "3.14", state: "answered" | "marked_for_review" | ... }
    revision: int = 1

def sanitize_question_for_candidate(q: Dict[str, Any]) -> Dict[str, Any]:
    """Strip answer keys, solutions, and explanations from candidate paper payload."""
    raw_content = q.get("content", {})
    safe_content = {
        "text": raw_content.get("text", ""),
        "options": [
            {"id": opt["id"], "text": opt.get("text", "")}
            for opt in raw_content.get("options", [])
        ]
    }
    return {
        "id": q["id"],
        "subject": q.get("subject", "General"),
        "type": q.get("type", "single_mcq"),
        "points_positive": q.get("points_positive", 4.0),
        "points_negative": q.get("points_negative", -1.0),
        "content": safe_content
    }

@router.post("")
def start_or_resume_attempt(
    req: StartAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(ExamAssignment).filter(
        ExamAssignment.invite_token == req.invite_token,
        ExamAssignment.candidate_id == current_user.id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Exam invitation not found or not assigned to you")

    now = datetime.now(timezone.utc)
    if now < assignment.opens_at.replace(tzinfo=timezone.utc) if assignment.opens_at.tzinfo is None else assignment.opens_at:
        raise HTTPException(status_code=400, detail="Exam window has not opened yet")

    # Check for existing in-progress attempt
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.assignment_id == assignment.id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    version = db.query(ExamVersion).filter(ExamVersion.id == assignment.exam_version_id).first()
    if not version:
        raise HTTPException(status_code=500, detail="Corrupt exam configuration: version missing")

    if not attempt:
        deadline = now + timedelta(minutes=version.duration_minutes)
        attempt = ExamAttempt(
            assignment_id=assignment.id,
            candidate_id=current_user.id,
            organization_id=assignment.organization_id,
            started_at=now,
            deadline_at=deadline,
            status="in_progress"
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)

    # Calculate remaining time against authoritative server deadline
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
        "duration_minutes": version.duration_minutes
    }

@router.get("/{attempt_id}/paper")
def get_attempt_paper(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    assignment = db.query(ExamAssignment).filter(ExamAssignment.id == attempt.assignment_id).first()
    version = db.query(ExamVersion).filter(ExamVersion.id == assignment.exam_version_id).first()

    raw_questions = json.loads(version.snapshot_json)
    sanitized = [sanitize_question_for_candidate(q) for q in raw_questions]

    # Fetch previously saved answers for reconnect recovery
    saved_answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
    answers_map = {a.question_id: json.loads(a.answer_json) for a in saved_answers}

    now = datetime.now(timezone.utc)
    deadline_ts = attempt.deadline_at.replace(tzinfo=timezone.utc) if attempt.deadline_at.tzinfo is None else attempt.deadline_at
    remaining_sec = max(0, int((deadline_ts - now).total_seconds()))

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "remaining_seconds": remaining_sec,
        "questions": sanitized,
        "saved_answers": answers_map
    }

@router.put("/{attempt_id}/answers/{question_id}")
def save_answer(
    attempt_id: str,
    question_id: str,
    req: SaveAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status != "in_progress":
        raise HTTPException(status_code=403, detail=f"Cannot save answer: attempt is {attempt.status}")

    now = datetime.now(timezone.utc)
    deadline_ts = attempt.deadline_at.replace(tzinfo=timezone.utc) if attempt.deadline_at.tzinfo is None else attempt.deadline_at
    if now > deadline_ts + timedelta(seconds=15):  # 15 second network grace
        attempt.status = "expired"
        db.commit()
        raise HTTPException(status_code=403, detail="Official deadline has passed")

    existing_answer = db.query(AttemptAnswer).filter(
        AttemptAnswer.attempt_id == attempt.id,
        AttemptAnswer.question_id == question_id
    ).first()

    if existing_answer:
        if req.revision >= existing_answer.revision:
            existing_answer.answer_json = json.dumps(req.answer)
            existing_answer.revision = req.revision
            existing_answer.saved_at = now
    else:
        new_answer = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=question_id,
            answer_json=json.dumps(req.answer),
            revision=req.revision,
            saved_at=now
        )
        db.add(new_answer)

    db.commit()
    return {"status": "saved", "question_id": question_id, "revision": req.revision}

@router.post("/{attempt_id}/submit")
def submit_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status == "submitted":
        return {"message": "Exam already submitted", "attempt_id": attempt.id, "score_total": attempt.score_total}

    assignment = db.query(ExamAssignment).filter(ExamAssignment.id == attempt.assignment_id).first()
    version = db.query(ExamVersion).filter(ExamVersion.id == assignment.exam_version_id).first()
    snapshot_questions = json.loads(version.snapshot_json)

    # Collect answers
    answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
    submitted_answers_map = {a.question_id: json.loads(a.answer_json) for a in answers}

    # Deterministic grading
    eval_result = JeeGradingEngine.evaluate_attempt(snapshot_questions, submitted_answers_map)

    now = datetime.now(timezone.utc)
    attempt.status = "submitted"
    attempt.submitted_at = now
    attempt.score_total = eval_result["total_score"]
    attempt.score_details_json = json.dumps(eval_result)

    db.commit()

    return {
        "status": "submitted",
        "attempt_id": attempt.id,
        "score_total": eval_result["total_score"],
        "max_possible_score": eval_result["max_possible_score"],
        "accuracy_percentage": eval_result["accuracy_percentage"],
        "correct_count": eval_result["correct_count"],
        "incorrect_count": eval_result["incorrect_count"],
        "unanswered_count": eval_result["unanswered_count"],
        "subject_breakdown": eval_result["subject_breakdown"]
    }

@router.get("/{attempt_id}/results")
def get_attempt_results(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status not in ["submitted", "expired"]:
        raise HTTPException(status_code=400, detail="Results are not available until exam is submitted")

    details = json.loads(attempt.score_details_json) if attempt.score_details_json else {}
    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "score_total": attempt.score_total,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "details": details
    }
