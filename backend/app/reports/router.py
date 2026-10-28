import io
import csv
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.auth.router import get_current_user
from app.models import (
    User, OrganizationMember, Exam, ExamVersion, ExamAssignment,
    ExamEnrollment, ExamAttempt, ProctorEvent, ResultRevision
)

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

def check_report_permission(db: Session, user_id: str, org_id: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_superadmin:
        return True
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.role.in_(["owner", "admin", "exam_author", "proctor"])
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics for this organization")
    return True

@router.get("/exams/{exam_id}/analytics")
def get_exam_analytics(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    check_report_permission(db, current_user.id, exam.organization_id)

    # Fetch all attempts for this exam across both assignments and enrollments
    version_ids = [v.id for v in exam.versions]
    attempts = db.query(ExamAttempt).filter(
        (ExamAttempt.exam_version_id.in_(version_ids)) | 
        (ExamAttempt.organization_id == exam.organization_id)
    ).all()

    total_attempts = len(attempts)
    submitted_attempts = [a for a in attempts if a.status in ["submitted", "expired"]]
    
    scores = [a.score_total for a in submitted_attempts if a.score_total is not None]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    highest_score = max(scores) if scores else 0.0
    lowest_score = min(scores) if scores else 0.0

    subject_stats = {"Physics": {"total": 0, "correct": 0}, "Chemistry": {"total": 0, "correct": 0}, "Mathematics": {"total": 0, "correct": 0}}
    for a in submitted_attempts:
        if a.score_details_json:
            try:
                details = json.loads(a.score_details_json)
                breakdown = details.get("subject_breakdown", {})
                for subj, sdata in breakdown.items():
                    if subj not in subject_stats:
                        subject_stats[subj] = {"total": 0, "correct": 0}
                    subject_stats[subj]["total"] += (sdata.get("correct", 0) + sdata.get("incorrect", 0) + sdata.get("unanswered", 0))
                    subject_stats[subj]["correct"] += sdata.get("correct", 0)
            except Exception:
                pass

    subject_accuracy = {}
    for subj, data in subject_stats.items():
        accuracy = round((data["correct"] / data["total"] * 100), 1) if data["total"] > 0 else 0.0
        subject_accuracy[subj] = accuracy

    # Build Leaderboard
    leaderboard = []
    sorted_attempts = sorted(submitted_attempts, key=lambda x: (x.score_total or 0.0), reverse=True)
    
    for rank, att in enumerate(sorted_attempts, start=1):
        cand_name = att.candidate_name or (att.candidate.full_name if att.candidate else "Enrolled Candidate")
        cand_ident = att.candidate_identifier or (att.candidate.email if att.candidate else "UID Access")
        event_count = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).count()
        critical_flags = db.query(ProctorEvent).filter(
            ProctorEvent.attempt_id == att.id,
            ProctorEvent.severity.in_(["suspicious", "high"])
        ).count()

        leaderboard.append({
            "rank": rank,
            "attempt_id": att.id,
            "candidate_name": cand_name,
            "candidate_email": cand_ident,
            "score": att.score_total or 0.0,
            "status": att.status,
            "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None,
            "integrity_flags": event_count,
            "critical_flags": critical_flags
        })

    return {
        "exam_id": exam.id,
        "exam_title": exam.title,
        "results_released": exam.results_released or False,
        "total_enrolled": total_attempts,
        "total_submitted": len(submitted_attempts),
        "average_score": avg_score,
        "highest_score": highest_score,
        "lowest_score": lowest_score,
        "subject_accuracy": subject_accuracy,
        "leaderboard": leaderboard
    }

class ReleaseResultsRequest(BaseModel):
    results_released: bool

@router.post("/exams/{exam_id}/release-results")
def toggle_release_results(
    exam_id: str,
    req: ReleaseResultsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Controls result publication to candidates (Phase 6)."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_report_permission(db, current_user.id, exam.organization_id)

    exam.results_released = req.results_released
    for v in exam.versions:
        v.results_released = req.results_released
    db.commit()

    return {
        "exam_id": exam.id,
        "results_released": exam.results_released,
        "message": "Results published to candidates" if req.results_released else "Results hidden from candidates"
    }

class RegradeAttemptRequest(BaseModel):
    new_score: float
    reason: str

@router.post("/attempts/{attempt_id}/regrade")
def regrade_attempt(
    attempt_id: str,
    req: RegradeAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manual score evaluation and regrading adjustment audit trail (Phase 6)."""
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    check_report_permission(db, current_user.id, attempt.organization_id)

    previous_score = attempt.score_total or 0.0
    attempt.score_total = req.new_score

    revision = ResultRevision(
        attempt_id=attempt.id,
        revised_by=current_user.id,
        previous_score=previous_score,
        new_score=req.new_score,
        reason=req.reason
    )
    db.add(revision)
    db.commit()

    return {
        "attempt_id": attempt.id,
        "previous_score": previous_score,
        "new_score": attempt.score_total,
        "reason": req.reason,
        "message": "Attempt score successfully revised and logged to audit trail"
    }

@router.get("/exams/{exam_id}/export-csv")
def export_exam_results_csv(
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exports full exam scorecard to downloadable CSV (Phase 6)."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    check_report_permission(db, current_user.id, exam.organization_id)

    version_ids = [v.id for v in exam.versions]
    attempts = db.query(ExamAttempt).filter(
        (ExamAttempt.exam_version_id.in_(version_ids)) |
        (ExamAttempt.organization_id == exam.organization_id)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "Candidate Name", "Candidate UID/Email", "Status", "Score", "Started At", "Submitted At", "Flags"])

    sorted_attempts = sorted(attempts, key=lambda x: (x.score_total or 0.0), reverse=True)
    for rank, att in enumerate(sorted_attempts, start=1):
        cand_name = att.candidate_name or (att.candidate.full_name if att.candidate else "Candidate")
        cand_ident = att.candidate_identifier or (att.candidate.email if att.candidate else "UID")
        flags = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).count()
        writer.writerow([
            rank,
            cand_name,
            cand_ident,
            att.status,
            att.score_total if att.score_total is not None else 0.0,
            att.started_at.isoformat() if att.started_at else "",
            att.submitted_at.isoformat() if att.submitted_at else "",
            flags
        ])

    filename = f"lunaris_results_{exam.title.lower().replace(' ', '_')[:30]}.csv"
    return PlainTextResponse(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
