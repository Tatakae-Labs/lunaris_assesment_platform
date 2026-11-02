with open('backend/app/exams/router.py', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """    db.delete(enrollment)
    db.commit()
    return {"message": "Candidate enrollment permanently deleted", "id": enrollment_id, "candidate_uid": enrollment.candidate_uid}"""

replacement1 = """    cand_uid = enrollment.candidate_uid
    db.delete(enrollment)
    db.commit()
    return {"message": "Candidate enrollment permanently deleted", "id": enrollment_id, "candidate_uid": cand_uid}"""

assert target1 in text, "target1 not found in exams/router.py"
text = text.replace(target1, replacement1, 1)

bulk_endpoint = '''
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
'''

new_text = text.rstrip() + bulk_endpoint + "\n"
with open('backend/app/exams/router.py', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Updated backend/app/exams/router.py with bulk delete")

