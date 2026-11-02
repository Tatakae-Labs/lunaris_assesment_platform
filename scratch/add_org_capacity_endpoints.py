with open('backend/app/organizations/router.py', 'r', encoding='utf-8') as f:
    c = f.read()

old_usage = """    limits = plan_limits.get(org.plan_id or "free", plan_limits["free"])

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "plan_id": org.plan_id or "free",
        "plan_name": limits.get("name", "Free Starter"),
        "candidates_count": candidates_count,
        "max_candidates": limits.get("max_candidates", 30),"""

new_usage = """    limits = plan_limits.get(org.plan_id or "free", plan_limits["free"])

    # Check custom candidate capacity from properties_json
    properties = {}
    if org.properties_json:
        try:
            properties = json.loads(org.properties_json)
        except Exception:
            properties = {}
    
    max_candidates = properties.get("custom_max_candidates") or properties.get("candidate_capacity") or limits.get("max_candidates", 30)

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "plan_id": org.plan_id or "free",
        "plan_name": limits.get("name", "Free Starter"),
        "candidates_count": candidates_count,
        "max_candidates": int(max_candidates),"""

c = c.replace(old_usage, new_usage)

new_endpoints = """
@router.put("/{org_id}/capacity")
def update_candidate_capacity(
    org_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"Set and edit the organization's maximum candidate capacity.\"\"\"
    from app.models import ExamEnrollment
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    caller_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role.in_(["owner", "admin"])
    ).first()
    if not caller_membership and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only owners or administrators can edit candidate capacity")

    new_capacity = payload.get("max_candidates") or payload.get("candidate_capacity")
    if not new_capacity or int(new_capacity) < 1:
        raise HTTPException(status_code=400, detail="Capacity must be at least 1")

    properties = {}
    if org.properties_json:
        try:
            properties = json.loads(org.properties_json)
        except Exception:
            properties = {}

    properties["custom_max_candidates"] = int(new_capacity)
    org.properties_json = json.dumps(properties)
    db.commit()

    candidates_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org.id).count()

    return {
        "organization_id": org.id,
        "max_candidates": int(new_capacity),
        "candidates_count": candidates_count,
        "message": f"Candidate capacity updated to {new_capacity}"
    }

@router.get("/{org_id}/candidates")
def list_organization_candidates(
    org_id: str,
    search: Optional[str] = None,
    exam_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"List all enrolled candidates, students, and members across the organization.\"\"\"
    from app.models import ExamEnrollment, Exam
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    query = db.query(
        ExamEnrollment,
        Exam.title.label("exam_title")
    ).outerjoin(
        Exam, ExamEnrollment.exam_id == Exam.id
    ).filter(
        ExamEnrollment.organization_id == org.id
    )

    if exam_id:
        query = query.filter(ExamEnrollment.exam_id == exam_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ExamEnrollment.candidate_name.ilike(search_pattern)) |
            (ExamEnrollment.candidate_email.ilike(search_pattern)) |
            (ExamEnrollment.candidate_uid.ilike(search_pattern))
        )

    results = query.order_by(ExamEnrollment.created_at.desc()).all()

    candidates = []
    for enrollment, exam_title in results:
        candidates.append({
            "id": enrollment.id,
            "candidate_uid": enrollment.candidate_uid,
            "candidate_name": enrollment.candidate_name or "Candidate " + enrollment.candidate_uid,
            "candidate_email": enrollment.candidate_email or "",
            "access_pin_plain": enrollment.access_pin_plain,
            "exam_id": enrollment.exam_id,
            "exam_title": exam_title or "General Assessment",
            "status": enrollment.status or "active",
            "max_attempts": enrollment.max_attempts,
            "valid_from": enrollment.valid_from.isoformat() if enrollment.valid_from else None,
            "valid_until": enrollment.valid_until.isoformat() if enrollment.valid_until else None,
            "created_at": enrollment.created_at.isoformat() if enrollment.created_at else None
        })

    return {
        "organization_id": org.id,
        "total": len(candidates),
        "candidates": candidates
    }

@router.post("/{org_id}/candidates")
def add_organization_candidate(
    org_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"Manually enroll an individual student / candidate into the organization.\"\"\"
    import random
    from datetime import datetime, timezone, timedelta
    from app.models import ExamEnrollment, Exam, ExamVersion
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    caller_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id
    ).first()
    if not caller_membership and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Pick exam or first active exam
    target_exam_id = payload.get("exam_id")
    target_exam = None
    if target_exam_id:
        target_exam = db.query(Exam).filter(Exam.id == target_exam_id, Exam.organization_id == org.id).first()
    if not target_exam:
        target_exam = db.query(Exam).filter(Exam.organization_id == org.id).first()

    exam_version_id = None
    if target_exam:
        latest_ver = db.query(ExamVersion).filter(ExamVersion.exam_id == target_exam.id).order_by(ExamVersion.version_number.desc()).first()
        if latest_ver:
            exam_version_id = latest_ver.id

    candidate_name = payload.get("candidate_name") or "New Student"
    candidate_email = payload.get("candidate_email") or ""
    candidate_uid = payload.get("candidate_uid") or f"LUN-{random.randint(100000, 999999)}"
    access_pin = payload.get("access_pin") or str(random.randint(1000, 9999))

    now = datetime.now(timezone.utc)
    enrollment = ExamEnrollment(
        organization_id=org.id,
        exam_id=target_exam.id if target_exam else None,
        exam_version_id=exam_version_id,
        candidate_uid=candidate_uid,
        access_pin_plain=access_pin,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        max_attempts=int(payload.get("max_attempts") or 3),
        valid_from=now,
        valid_until=now + timedelta(days=365),
        status="active"
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    return {
        "status": "success",
        "message": f"Candidate {candidate_name} ({candidate_uid}) enrolled successfully",
        "candidate": {
            "id": enrollment.id,
            "candidate_uid": enrollment.candidate_uid,
            "candidate_name": enrollment.candidate_name,
            "candidate_email": enrollment.candidate_email,
            "access_pin_plain": enrollment.access_pin_plain,
            "exam_id": enrollment.exam_id,
            "exam_title": target_exam.title if target_exam else "General Roster",
            "status": enrollment.status
        }
    }

@router.delete("/{org_id}/candidates/{enrollment_id}")
def delete_organization_candidate(
    org_id: str,
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"Revoke or delete an enrolled candidate seat, freeing capacity.\"\"\"
    from app.models import ExamEnrollment
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.id == enrollment_id,
        ExamEnrollment.organization_id == org.id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Candidate enrollment not found")

    db.delete(enrollment)
    db.commit()

    candidates_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org.id).count()

    return {
        "status": "success",
        "message": f"Candidate seat {enrollment.candidate_uid} removed successfully",
        "candidates_count": candidates_count
    }
"""

c = c + "\n" + new_endpoints

with open('backend/app/organizations/router.py', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated backend/app/organizations/router.py successfully')

