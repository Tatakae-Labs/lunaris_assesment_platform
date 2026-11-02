with open('backend/app/reports/router.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure or_ is imported
if 'from sqlalchemy import or_' not in content:
    content = content.replace('from sqlalchemy.orm import Session', 'from sqlalchemy import or_\nfrom sqlalchemy.orm import Session')

# Replace get_exam_analytics
idx_start = content.find('def get_exam_analytics(')
idx_end = content.find('class ReleaseResultsRequest', idx_start)

new_func = '''def get_exam_analytics(
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

'''

content = content[:idx_start] + new_func + content[idx_end:]
with open('backend/app/reports/router.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated backend reports router get_exam_analytics")

