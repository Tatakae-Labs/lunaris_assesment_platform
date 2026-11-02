with open('backend/app/organizations/router.py', 'r', encoding='utf-8') as f:
    text = f.read()

bulk_endpoint = '''

class BulkDeleteCandidatesRequest(BaseModel):
    candidate_ids: List[str]


@router.post("/{org_id}/candidates/bulk-delete")
def bulk_delete_organization_candidates(
    org_id: str,
    req: BulkDeleteCandidatesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke or delete multiple candidate seats in bulk, freeing candidate capacity."""
    from app.models import ExamEnrollment
    from sqlalchemy import func, or_
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not req.candidate_ids:
        candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
        return {"status": "success", "deleted_count": 0, "candidates_count": candidates_count, "message": "No candidates specified"}

    # Find enrollments matching IDs or candidate_uids
    enrollments = db.query(ExamEnrollment).filter(
        (ExamEnrollment.id.in_(req.candidate_ids)) | (ExamEnrollment.candidate_uid.in_(req.candidate_ids)),
        ExamEnrollment.organization_id == org.id
    ).all()

    if not enrollments:
        candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
        return {"status": "success", "deleted_count": 0, "candidates_count": candidates_count, "message": "No matching candidates found"}

    uids = list(set(e.candidate_uid for e in enrollments if e.candidate_uid))
    emails = list(set(e.candidate_email for e in enrollments if e.candidate_email and e.candidate_email.strip()))

    filters = []
    if uids:
        filters.append(ExamEnrollment.candidate_uid.in_(uids))
    if emails:
        filters.append(ExamEnrollment.candidate_email.in_(emails))
    if req.candidate_ids:
        filters.append(ExamEnrollment.id.in_(req.candidate_ids))

    deleted_count = db.query(ExamEnrollment).filter(
        ExamEnrollment.organization_id == org.id,
        or_(*filters)
    ).delete(synchronize_session=False)

    db.commit()

    candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
    return {
        "status": "success",
        "message": f"Successfully revoked {len(uids) or deleted_count} candidate seat(s)",
        "deleted_count": deleted_count,
        "candidates_count": candidates_count
    }
'''

new_text = text.rstrip() + bulk_endpoint + "\n"
with open('backend/app/organizations/router.py', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Appended bulk delete endpoint to backend/app/organizations/router.py")

