import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, OrganizationMember, Organization, QuestionPaperTemplate, TemplateVersion

router = APIRouter(prefix="/templates", tags=["Question Paper Templates"])


def check_org_permission(db: Session, user_id: str, org_id: str):
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
        raise HTTPException(status_code=403, detail="Insufficient template management permissions")
    return org


class SectionConfig(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    subject: str
    chapter: Optional[str] = None
    topic: Optional[str] = None
    required_questions: int = 10
    total_pool_questions: Optional[int] = None
    marks_per_question: float = 4.0
    negative_marking: float = 1.0
    question_types: Optional[List[str]] = ["single_mcq"]  # single_mcq, multi_mcq, numerical, fill_in_blanks, true_false, subjective
    difficulty_distribution: Optional[Dict[str, int]] = None  # { "easy": 30, "medium": 50, "hard": 20 }
    selection_rule: Optional[str] = "all_mandatory"  # all_mandatory, attempt_any, optional_choice
    attempt_limit: Optional[int] = None  # e.g. Attempt any 5 out of 8
    randomize_order: Optional[bool] = True
    preselected_question_ids: Optional[List[str]] = None


class CreateTemplateRequest(BaseModel):
    organization_id: str
    title: str
    description: Optional[str] = ""
    exam_type: Optional[str] = "cbt"  # cbt, standard_quiz, midterm, final, olympiad, custom
    language: Optional[str] = "English"
    duration_minutes: Optional[int] = 180
    instructions: Optional[str] = "1. Read all section instructions carefully.\n2. Negative marks apply where indicated.\n3. Verify your answers before submitting."
    rules: Optional[Dict[str, Any]] = None  # { randomize_sections, allow_calculator, show_instant_scorecard }
    sections: List[SectionConfig]
    status: Optional[str] = "draft"  # draft, published


class UpdateTemplateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    exam_type: Optional[str] = None
    language: Optional[str] = None
    duration_minutes: Optional[int] = None
    instructions: Optional[str] = None
    rules: Optional[Dict[str, Any]] = None
    sections: Optional[List[SectionConfig]] = None
    status: Optional[str] = None
    change_summary: Optional[str] = "Updated template configuration"


def _calculate_totals(sections: List[Dict[str, Any]]) -> tuple:
    total_q = 0
    total_m = 0.0
    for s in sections:
        req_q = int(s.get("required_questions") or s.get("attempt_limit") or 0)
        marks_each = float(s.get("marks_per_question") or 4.0)
        total_q += req_q
        total_m += (req_q * marks_each)
    return total_q, round(total_m, 2)


@router.post("")
def create_template(
    req: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_permission(db, current_user.id, req.organization_id)

    # Process and assign IDs to sections if missing
    sections_list = []
    for s in req.sections:
        s_dict = s.dict()
        if not s_dict.get("id"):
            s_dict["id"] = generate_uuid()
        sections_list.append(s_dict)

    total_q, total_m = _calculate_totals(sections_list)

    rules = req.rules or {
        "randomize_sections": False,
        "allow_calculator": False,
        "show_instant_scorecard": False,
        "shuffle_options": True
    }

    template = QuestionPaperTemplate(
        organization_id=org.id,
        title=req.title.strip(),
        description=req.description or "",
        exam_type=req.exam_type or "cbt",
        language=req.language or "English",
        total_marks=total_m,
        total_questions=total_q,
        duration_minutes=req.duration_minutes or 180,
        instructions=req.instructions or "",
        rules_json=json.dumps(rules),
        sections_json=json.dumps(sections_list),
        status=req.status or "draft",
        current_version=1,
        created_by=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Create Initial TemplateVersion snapshot
    initial_snapshot = {
        "title": template.title,
        "description": template.description,
        "exam_type": template.exam_type,
        "language": template.language,
        "total_marks": template.total_marks,
        "total_questions": template.total_questions,
        "duration_minutes": template.duration_minutes,
        "instructions": template.instructions,
        "rules": rules,
        "sections": sections_list
    }

    ver = TemplateVersion(
        template_id=template.id,
        version_number=1,
        title=template.title,
        snapshot_json=json.dumps(initial_snapshot),
        change_summary="Initial template creation",
        created_by=current_user.id
    )
    db.add(ver)
    db.commit()

    return {
        "id": template.id,
        "organization_id": template.organization_id,
        "title": template.title,
        "description": template.description,
        "exam_type": template.exam_type,
        "language": template.language,
        "total_marks": template.total_marks,
        "total_questions": template.total_questions,
        "duration_minutes": template.duration_minutes,
        "status": template.status,
        "current_version": template.current_version,
        "rules": rules,
        "sections": sections_list,
        "created_at": template.created_at.isoformat(),
        "created_by_name": current_user.full_name
    }


@router.get("")
def list_templates(
    organization_id: str,
    status: Optional[str] = None,
    exam_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_permission(db, current_user.id, organization_id)
    query = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.organization_id == org.id)

    if status and status.strip():
        query = query.filter(QuestionPaperTemplate.status == status.strip())
    if exam_type and exam_type.strip():
        query = query.filter(QuestionPaperTemplate.exam_type == exam_type.strip())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(QuestionPaperTemplate.title.ilike(term))

    templates = query.order_by(QuestionPaperTemplate.updated_at.desc()).all()

    results = []
    for t in templates:
        try:
            sections = json.loads(t.sections_json) if t.sections_json else []
        except Exception:
            sections = []

        try:
            rules = json.loads(t.rules_json) if t.rules_json else {}
        except Exception:
            rules = {}

        results.append({
            "id": t.id,
            "organization_id": t.organization_id,
            "title": t.title,
            "description": t.description,
            "exam_type": t.exam_type,
            "language": t.language,
            "total_marks": t.total_marks,
            "total_questions": t.total_questions,
            "duration_minutes": t.duration_minutes,
            "status": t.status,
            "current_version": t.current_version,
            "sections": sections,
            "sections_json": sections,
            "sections_count": len(sections),
            "sections_summary": [
                {
                    "id": s.get("id"),
                    "name": s.get("name"),
                    "subject": s.get("subject"),
                    "required_questions": s.get("required_questions"),
                    "marks_per_question": s.get("marks_per_question"),
                    "question_types": s.get("question_types", [])
                }
                for s in sections
            ],
            "rules": rules,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None
        })

    return {
        "templates": results,
        "total": len(results)
    }


@router.get("/{template_id}")
def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Question paper template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    sections = json.loads(template.sections_json) if template.sections_json else []
    rules = json.loads(template.rules_json) if template.rules_json else {}

    # Get version count
    version_count = db.query(TemplateVersion).filter(TemplateVersion.template_id == template.id).count()

    return {
        "id": template.id,
        "organization_id": template.organization_id,
        "title": template.title,
        "description": template.description,
        "exam_type": template.exam_type,
        "language": template.language,
        "total_marks": template.total_marks,
        "total_questions": template.total_questions,
        "duration_minutes": template.duration_minutes,
        "instructions": template.instructions,
        "status": template.status,
        "current_version": template.current_version,
        "version_count": version_count,
        "rules": rules,
        "sections": sections,
        "created_by": template.created_by,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }


@router.put("/{template_id}")
def update_template(
    template_id: str,
    req: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    if req.title is not None:
        template.title = req.title.strip()
    if req.description is not None:
        template.description = req.description
    if req.exam_type is not None:
        template.exam_type = req.exam_type
    if req.language is not None:
        template.language = req.language
    if req.duration_minutes is not None:
        template.duration_minutes = req.duration_minutes
    if req.instructions is not None:
        template.instructions = req.instructions
    if req.status is not None:
        template.status = req.status
    if req.rules is not None:
        template.rules_json = json.dumps(req.rules)

    if req.sections is not None:
        sections_list = []
        for s in req.sections:
            s_dict = s.dict()
            if not s_dict.get("id"):
                s_dict["id"] = generate_uuid()
            sections_list.append(s_dict)

        total_q, total_m = _calculate_totals(sections_list)
        template.sections_json = json.dumps(sections_list)
        template.total_questions = total_q
        template.total_marks = total_m

    # Increment version
    new_version_num = (template.current_version or 1) + 1
    template.current_version = new_version_num
    template.updated_at = datetime.now(timezone.utc)

    # Save version snapshot
    snapshot = {
        "title": template.title,
        "description": template.description,
        "exam_type": template.exam_type,
        "language": template.language,
        "total_marks": template.total_marks,
        "total_questions": template.total_questions,
        "duration_minutes": template.duration_minutes,
        "instructions": template.instructions,
        "rules": json.loads(template.rules_json) if template.rules_json else {},
        "sections": json.loads(template.sections_json) if template.sections_json else []
    }

    ver = TemplateVersion(
        template_id=template.id,
        version_number=new_version_num,
        title=template.title,
        snapshot_json=json.dumps(snapshot),
        change_summary=req.change_summary or f"Version {new_version_num} update",
        created_by=current_user.id
    )
    db.add(ver)

    db.commit()
    db.refresh(template)

    return {
        "id": template.id,
        "title": template.title,
        "status": template.status,
        "current_version": template.current_version,
        "total_marks": template.total_marks,
        "total_questions": template.total_questions,
        "message": f"Template updated to Version {template.current_version}"
    }


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    db.delete(template)
    db.commit()
    return {"message": "Template permanently deleted", "id": template_id}


@router.post("/{template_id}/duplicate")
def duplicate_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source template not found")

    check_org_permission(db, current_user.id, source.organization_id)

    # Parse and regenerate IDs for sections to ensure complete independence
    try:
        sections = json.loads(source.sections_json)
        for s in sections:
            s["id"] = generate_uuid()
    except Exception:
        sections = []

    clone = QuestionPaperTemplate(
        organization_id=source.organization_id,
        title=f"{source.title} (Copy)",
        description=source.description,
        exam_type=source.exam_type,
        language=source.language,
        total_marks=source.total_marks,
        total_questions=source.total_questions,
        duration_minutes=source.duration_minutes,
        instructions=source.instructions,
        rules_json=source.rules_json,
        sections_json=json.dumps(sections),
        status="draft",
        current_version=1,
        created_by=current_user.id
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)

    # Initial version for duplicate
    snapshot = {
        "title": clone.title,
        "description": clone.description,
        "exam_type": clone.exam_type,
        "language": clone.language,
        "total_marks": clone.total_marks,
        "total_questions": clone.total_questions,
        "duration_minutes": clone.duration_minutes,
        "instructions": clone.instructions,
        "rules": json.loads(clone.rules_json) if clone.rules_json else {},
        "sections": sections
    }
    ver = TemplateVersion(
        template_id=clone.id,
        version_number=1,
        title=clone.title,
        snapshot_json=json.dumps(snapshot),
        change_summary=f"Cloned from '{source.title}'",
        created_by=current_user.id
    )
    db.add(ver)
    db.commit()

    return {
        "id": clone.id,
        "title": clone.title,
        "status": clone.status,
        "message": "Template duplicated successfully"
    }


@router.post("/{template_id}/publish")
def publish_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    # Validate before publish
    sections = json.loads(template.sections_json) if template.sections_json else []
    if not sections:
        raise HTTPException(status_code=400, detail="Cannot publish a template without at least 1 section defined.")

    for idx, s in enumerate(sections, 1):
        if not s.get("name") or not s.get("subject"):
            raise HTTPException(status_code=400, detail=f"Section #{idx} is missing a name or subject.")
        if (s.get("required_questions") or 0) <= 0:
            raise HTTPException(status_code=400, detail=f"Section '{s.get('name')}' must require at least 1 question.")

    template.status = "published"
    template.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "id": template.id,
        "title": template.title,
        "status": template.status,
        "message": "Template published and ready for examination generation"
    }


@router.get("/{template_id}/versions")
def get_template_versions(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    versions = db.query(TemplateVersion).filter(TemplateVersion.template_id == template_id).order_by(TemplateVersion.version_number.desc()).all()

    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "title": v.title,
            "change_summary": v.change_summary,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "created_by": v.created_by,
            "is_current": v.version_number == template.current_version
        }
        for v in versions
    ]


@router.post("/{template_id}/rollback/{version_number}")
def rollback_template_version(
    template_id: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    target_ver = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id,
        TemplateVersion.version_number == version_number
    ).first()
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found for this template")

    snapshot = json.loads(target_ver.snapshot_json)

    # Roll back attributes
    template.title = snapshot.get("title", template.title)
    template.description = snapshot.get("description", template.description)
    template.exam_type = snapshot.get("exam_type", template.exam_type)
    template.language = snapshot.get("language", template.language)
    template.total_marks = snapshot.get("total_marks", template.total_marks)
    template.total_questions = snapshot.get("total_questions", template.total_questions)
    template.duration_minutes = snapshot.get("duration_minutes", template.duration_minutes)
    template.instructions = snapshot.get("instructions", template.instructions)
    template.rules_json = json.dumps(snapshot.get("rules", {}))
    template.sections_json = json.dumps(snapshot.get("sections", []))

    # Append a new version representing this rollback event
    new_version_num = template.current_version + 1
    template.current_version = new_version_num
    template.updated_at = datetime.now(timezone.utc)

    ver = TemplateVersion(
        template_id=template.id,
        version_number=new_version_num,
        title=template.title,
        snapshot_json=json.dumps(snapshot),
        change_summary=f"Rolled back to Version {version_number}",
        created_by=current_user.id
    )
    db.add(ver)

    db.commit()
    db.refresh(template)

    return {
        "id": template.id,
        "title": template.title,
        "current_version": template.current_version,
        "message": f"Successfully rolled back to configuration of Version {version_number}"
    }


@router.post("/{template_id}/validate")
def validate_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(QuestionPaperTemplate).filter(QuestionPaperTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_org_permission(db, current_user.id, template.organization_id)

    sections = json.loads(template.sections_json) if template.sections_json else []
    errors = []
    warnings = []

    if not sections:
        errors.append("Template contains no sections. At least one section is mandatory.")

    calc_q = 0
    calc_m = 0.0

    for idx, s in enumerate(sections, 1):
        s_name = s.get("name") or f"Section #{idx}"
        req_q = s.get("required_questions") or 0
        marks_each = s.get("marks_per_question") or 0

        if not s.get("subject"):
            errors.append(f"{s_name}: Missing subject mapping.")
        if req_q <= 0:
            errors.append(f"{s_name}: Required questions must be greater than 0.")
        if marks_each <= 0:
            warnings.append(f"{s_name}: Marks per question is set to 0 or negative.")

        q_types = s.get("question_types") or []
        if not q_types:
            warnings.append(f"{s_name}: No question types selected. Defaults to single_mcq.")

        # Check difficulty distribution sum if set
        diff = s.get("difficulty_distribution")
        if diff and isinstance(diff, dict):
            total_pct = sum(diff.values())
            if total_pct > 0 and total_pct != 100:
                warnings.append(f"{s_name}: Difficulty percentage total is {total_pct}% (recommended: 100%).")

        calc_q += req_q
        calc_m += (req_q * marks_each)

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "total_sections": len(sections),
            "calculated_questions": calc_q,
            "calculated_marks": round(calc_m, 2),
            "template_total_marks": template.total_marks
        }
    }

