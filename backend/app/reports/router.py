import io
import csv
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import or_
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
    """Retrieve comprehensive analytics and every candidate attempt for any exam or quiz."""
    from app.models import QuizRoom, QuizParticipant, QuizResponse, AttemptAnswer, ExamEnrollment
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    check_report_permission(db, current_user.id, exam.organization_id)

    # 1. Identify all versions, enrollments, and quiz rooms belonging to this exam
    version_ids = [v.id for v in exam.versions]
    enrollment_records = db.query(ExamEnrollment).filter(ExamEnrollment.exam_id == exam.id).all()
    enrollment_ids = [e.id for e in enrollment_records]
    enrollment_uid_map = {e.id: e.candidate_uid for e in enrollment_records}

    quiz_room_ids = []
    if exam.mode == "quick_quiz" or exam.room_code:
        q_rooms = db.query(QuizRoom).filter(
            (QuizRoom.room_code == exam.room_code) |
            ((QuizRoom.title == exam.title) & (QuizRoom.organization_id == exam.organization_id))
        ).all()
        quiz_room_ids = [r.id for r in q_rooms]

    filters = []
    if version_ids:
        filters.append(ExamAttempt.exam_version_id.in_(version_ids))
    if enrollment_ids:
        filters.append(ExamAttempt.enrollment_id.in_(enrollment_ids))
    if quiz_room_ids:
        p_ids = [p.id for p in db.query(QuizParticipant.id).filter(QuizParticipant.room_id.in_(quiz_room_ids)).all()]
        if p_ids:
            filters.append(ExamAttempt.id.in_(p_ids))

    # Also match direct room_code in ExamVersion or QuizRoom
    if not filters and exam.organization_id:
        filters.append(ExamAttempt.organization_id == exam.organization_id)

    attempts = db.query(ExamAttempt).filter(or_(*filters)).all() if filters else []

    # Reconcile attempts that have ended but were left in_progress
    now = datetime.now(timezone.utc)
    updated_any = False
    first_room = db.query(QuizRoom).filter(QuizRoom.id.in_(quiz_room_ids)).first() if quiz_room_ids else None
    quick_quiz_duration = ((first_room.total_rounds or 5) * (first_room.per_question_time_seconds or 20) + 30) if first_room else 120

    for att in attempts:
        if att.status == "in_progress":
            # 1. Quick Quiz attempts
            if exam.mode == "quick_quiz" or att.assignment_id == "quick_quiz_assignment":
                time_passed = 999999
                if att.started_at:
                    st_tz = att.started_at.replace(tzinfo=timezone.utc) if att.started_at.tzinfo is None else att.started_at
                    time_passed = (now - st_tz).total_seconds()
                
                resp_count = db.query(QuizResponse).filter(QuizResponse.participant_id == att.id).count()
                total_rounds = first_room.total_rounds if first_room else 5

                # Finished if responded to all rounds OR time elapsed exceeded quiz duration
                if resp_count >= total_rounds or time_passed > quick_quiz_duration or (first_room and first_room.status == "completed"):
                    att.status = "completed"
                    if not att.submitted_at:
                        effective_sec = min(int(time_passed), quick_quiz_duration)
                        att.submitted_at = (att.started_at or now) + timedelta(seconds=effective_sec)
                    updated_any = True

            # 2. Proctored CBT or Standard Practice exams
            else:
                is_expired = False
                if att.deadline_at:
                    dl_tz = att.deadline_at.replace(tzinfo=timezone.utc) if att.deadline_at.tzinfo is None else att.deadline_at
                    if now > dl_tz:
                        is_expired = True
                elif att.started_at:
                    st_tz = att.started_at.replace(tzinfo=timezone.utc) if att.started_at.tzinfo is None else att.started_at
                    dur_min = exam.duration_minutes or 60
                    if (now - st_tz).total_seconds() > (dur_min * 60 + 60):
                        is_expired = True

                if is_expired:
                    att.status = "submitted"
                    if not att.submitted_at:
                        att.submitted_at = att.deadline_at or now
                    updated_any = True

    if updated_any:
        try:
            db.commit()
        except Exception:
            db.rollback()

    # Check if there are QuizParticipants in quiz_room that don't have ExamAttempt yet
    seen_attempt_ids = set(a.id for a in attempts)
    extra_participants = []
    if quiz_room_ids:
        for q_room_id in quiz_room_ids:
            parts = db.query(QuizParticipant).filter(QuizParticipant.room_id == q_room_id).all()
            for p in parts:
                if p.id not in seen_attempt_ids:
                    extra_participants.append(p)
                    seen_attempt_ids.add(p.id)

    total_attempts = len(attempts) + len(extra_participants)
    submitted_attempts = [a for a in attempts if a.status in ["submitted", "completed", "expired"]]
    in_progress_count = total_attempts - len(submitted_attempts)

    all_scores = [a.score_total for a in attempts if a.score_total is not None] + [p.score for p in extra_participants if p.score is not None]
    avg_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0
    highest_score = max(all_scores) if all_scores else 0.0
    lowest_score = min(all_scores) if all_scores else 0.0

    subject_stats = {}
    for a in attempts:
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

    # 3. Build candidate attempt list for EVERY candidate who attempted
    candidate_records = []
    
    # Process standard and quick quiz attempts
    for att in attempts:
        cand_name = att.candidate_name or (att.candidate.full_name if att.candidate else "Candidate")
        cand_ident = att.candidate_identifier or (att.candidate.email if att.candidate else "")
        cand_uid = enrollment_uid_map.get(att.enrollment_id) or (cand_ident if cand_ident.startswith("LUN-") else "")
        
        event_count = db.query(ProctorEvent).filter(ProctorEvent.attempt_id == att.id).count()
        critical_flags = db.query(ProctorEvent).filter(
            ProctorEvent.attempt_id == att.id,
            ProctorEvent.severity.in_(["suspicious", "high"])
        ).count()

        # Score breakdown details
        score_details = {}
        if att.score_details_json:
            try:
                score_details = json.loads(att.score_details_json)
            except:
                pass

        # Duration
        duration_sec = 0
        if att.started_at and att.submitted_at:
            duration_sec = int((att.submitted_at - att.started_at).total_seconds())

        candidate_records.append({
            "attempt_id": att.id,
            "candidate_name": cand_name,
            "candidate_email": cand_ident,
            "candidate_uid": cand_uid,
            "score": att.score_total or 0.0,
            "status": att.status or "in_progress",
            "started_at": att.started_at.isoformat() if att.started_at else None,
            "submitted_at": att.submitted_at.isoformat() if att.submitted_at else "In Progress",
            "duration_seconds": duration_sec,
            "integrity_flags": event_count,
            "critical_flags": critical_flags,
            "score_details": score_details
        })

    # Process extra participants
    for p in extra_participants:
        candidate_records.append({
            "attempt_id": p.id,
            "candidate_name": p.nickname,
            "candidate_email": "Quick Quiz Arena",
            "candidate_uid": "",
            "score": float(p.score or 0),
            "status": "completed" if not p.is_connected else "in_progress",
            "started_at": p.joined_at.isoformat() if p.joined_at else None,
            "submitted_at": "In Progress" if p.is_connected else "Completed",
            "duration_seconds": 0,
            "integrity_flags": 0,
            "critical_flags": 0,
            "score_details": {"speed_streak": p.streak}
        })

    # Sort leaderboard by score descending
    candidate_records.sort(key=lambda x: (x["score"] or 0.0), reverse=True)
    for rank, item in enumerate(candidate_records, start=1):
        item["rank"] = rank

    total_enrolled_count = len(enrollment_records) if enrollment_records else total_attempts

    return {
        "exam_id": exam.id,
        "exam_title": exam.title,
        "mode": exam.mode,
        "results_released": exam.results_released or False,
        "total_enrolled": total_enrolled_count,
        "total_attempted": total_attempts,
        "total_submitted": len(submitted_attempts),
        "total_in_progress": in_progress_count,
        "average_score": avg_score,
        "highest_score": highest_score,
        "lowest_score": lowest_score,
        "subject_accuracy": subject_accuracy,
        "leaderboard": candidate_records
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


@router.get("/verify/{attempt_id}")
def verify_scorecard_public(attempt_id: str, db: Session = Depends(get_db)):
    """Public QR verification endpoint for Lunaris PDF Scorecards & Certificates."""
    from app.core.mongo_sync import hydrate_attempt_events_from_mongodb
    try:
        hydrate_attempt_events_from_mongodb(db, attempt_id)
    except Exception:
        pass

    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Scorecard verification record not found.")

    exam = None
    if attempt.exam_version_id:
        ver = db.query(ExamVersion).filter(ExamVersion.id == attempt.exam_version_id).first()
        if ver:
            exam = db.query(Exam).filter(Exam.id == ver.exam_id).first()
    org = db.query(Organization).filter(Organization.id == attempt.organization_id).first()

    events = db.query(ProctorEvent).filter(
        ProctorEvent.attempt_id == attempt.id,
        ProctorEvent.event_type != "cctv_frame"
    ).all()
    high_cnt = sum(1 for e in events if e.severity in ("suspicious", "high"))
    adv_cnt = max(0, len(events) - high_cnt)
    integrity_score = max(0, min(100, 100 - (high_cnt * 18) - (adv_cnt * 4)))

    return {
        "verified": True,
        "attempt_id": attempt.id,
        "candidate_name": attempt.candidate_name or "Candidate",
        "candidate_uid": attempt.candidate_identifier or "N/A",
        "organization_name": org.name if org else "Lunaris Assessment Platform",
        "exam_title": exam.title if exam else "Assessment",
        "status": attempt.status,
        "score_total": attempt.score_total or 0.0,
        "integrity_score": integrity_score,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    }


@router.get("/attempts/{attempt_id}/analytics")
def get_attempt_time_accuracy_analytics(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Per-question time spent, accuracy breakdown, and cohort percentile for an attempt."""
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).all()
    ans_map = {a.question_id: a for a in answers}

    cohort_scores = [
        a.score_total or 0.0
        for a in db.query(ExamAttempt).filter(
            ExamAttempt.organization_id == attempt.organization_id,
            ExamAttempt.exam_version_id == attempt.exam_version_id,
            ExamAttempt.status == "submitted"
        ).all()
    ]
    my_score = attempt.score_total or 0.0
    if cohort_scores:
        below_or_equal = sum(1 for s in cohort_scores if s <= my_score)
        percentile = round((below_or_equal / len(cohort_scores)) * 100, 1)
    else:
        percentile = 100.0

    per_question = []
    for qid, ans in ans_map.items():
        per_question.append({
            "question_id": qid,
            "time_spent_sec": ans.time_spent_sec or 0,
            "revision": ans.revision,
            "saved_at": ans.saved_at.isoformat() if ans.saved_at else None
        })

    return {
        "attempt_id": attempt.id,
        "score_total": my_score,
        "percentile": percentile,
        "cohort_size": len(cohort_scores),
        "total_time_spent_sec": sum(q["time_spent_sec"] for q in per_question),
        "per_question": per_question,
    }
