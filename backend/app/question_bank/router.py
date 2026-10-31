import io
import csv
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, OrganizationMember, Question, QuestionBank, QuestionRevision

router = APIRouter(prefix="/questions", tags=["Question Bank"])

class CreateQuestionRequest(BaseModel):
    organization_id: str
    subject: str  # Physics, Chemistry, Mathematics
    question_type: str  # single_mcq, multi_mcq, numerical
    content: Dict[str, Any]  # text, options: [{id, text}], correct_option_id or numerical_answer

class UpdateQuestionRequest(BaseModel):
    subject: Optional[str] = None
    question_type: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    change_summary: Optional[str] = "Question content updated"

def check_org_author_permission(db: Session, user_id: str, org_id: str):
    from app.models import Organization
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
        raise HTTPException(status_code=403, detail="Insufficient permissions for question bank in this organization")
    return org

@router.post("")
def create_question(
    req: CreateQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_author_permission(db, current_user.id, req.organization_id)

    # Ensure option IDs are generated if missing
    content = dict(req.content)
    if "options" in content and isinstance(content["options"], list):
        for opt in content["options"]:
            if "id" not in opt or not opt["id"]:
                opt["id"] = generate_uuid()

    question = Question(
        organization_id=org.id,
        subject=req.subject,
        question_type=req.question_type,
        content_json=json.dumps(content),
        version=1
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "id": question.id,
        "subject": question.subject,
        "question_type": question.question_type,
        "version": question.version,
        "content": json.loads(question.content_json)
    }

@router.get("")
def list_questions(
    organization_id: str,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = check_org_author_permission(db, current_user.id, organization_id)

    query = db.query(Question).filter(Question.organization_id == org.id)
    if subject:
        query = query.filter(Question.subject == subject)

    questions = query.order_by(Question.created_at.desc()).all()
    return [
        {
            "id": q.id,
            "subject": q.subject,
            "question_type": q.question_type,
            "version": q.version or 1,
            "content": json.loads(q.content_json),
            "created_at": q.created_at.isoformat()
        }
        for q in questions
    ]

@router.delete("/bulk/clear-org")
def clear_org_questions(
    organization_id: str,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk deletes questions in an organization question bank (optionally filtered by subject)."""
    org = check_org_author_permission(db, current_user.id, organization_id)
    query = db.query(Question).filter(Question.organization_id == org.id)
    if subject and subject.strip():
        query = query.filter(Question.subject == subject.strip())
    
    # Cascade delete revisions first
    q_ids = [q.id for q in query.all()]
    if q_ids:
        db.query(QuestionRevision).filter(QuestionRevision.question_id.in_(q_ids)).delete(synchronize_session=False)
        deleted_count = query.delete(synchronize_session=False)
        db.commit()
    else:
        deleted_count = 0

    return {"message": f"Successfully deleted {deleted_count} questions from Question Bank", "count": deleted_count}

@router.delete("/{question_id}")
def delete_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently deletes a question from the question bank."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    check_org_author_permission(db, current_user.id, question.organization_id)
    
    # Delete associated revisions
    db.query(QuestionRevision).filter(QuestionRevision.question_id == question.id).delete(synchronize_session=False)
    db.delete(question)
    db.commit()
    return {"message": "Question permanently deleted from Question Bank", "id": question_id}

@router.put("/{question_id}")
def update_question(
    question_id: str,
    req: UpdateQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates a question and records the prior state in QuestionRevision."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    check_org_author_permission(db, current_user.id, question.organization_id)

    # Archive current version into QuestionRevision
    current_ver = question.version or 1
    revision = QuestionRevision(
        question_id=question.id,
        version=current_ver,
        content_json=question.content_json,
        change_summary=req.change_summary or "Updated question content",
        created_by=current_user.id
    )
    db.add(revision)

    if req.subject:
        question.subject = req.subject
    if req.question_type:
        question.question_type = req.question_type
    if req.content:
        content = dict(req.content)
        if "options" in content and isinstance(content["options"], list):
            for opt in content["options"]:
                if "id" not in opt or not opt["id"]:
                    opt["id"] = generate_uuid()
        question.content_json = json.dumps(content)

    question.version = current_ver + 1
    db.commit()
    db.refresh(question)

    return {
        "id": question.id,
        "subject": question.subject,
        "question_type": question.question_type,
        "version": question.version,
        "content": json.loads(question.content_json),
        "message": f"Question updated to version {question.version}"
    }

@router.get("/{question_id}/revisions")
def get_question_revisions(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List historical revisions for a given question."""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    check_org_author_permission(db, current_user.id, question.organization_id)

    revs = db.query(QuestionRevision).filter(QuestionRevision.question_id == question_id).order_by(QuestionRevision.version.desc()).all()
    return [
        {
            "id": r.id,
            "version": r.version,
            "content": json.loads(r.content_json),
            "change_summary": r.change_summary,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat()
        }
        for r in revs
    ]

class CsvImportRequest(BaseModel):
    organization_id: str
    csv_data: str

@router.post("/import-csv")
def import_questions_csv(
    req: CsvImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Imports questions from CSV text into the organization's question bank."""
    org = check_org_author_permission(db, current_user.id, req.organization_id)

    reader = csv.DictReader(io.StringIO(req.csv_data))
    imported_count = 0
    for row in reader:
        subject = row.get("subject", "Physics").strip()
        q_type = row.get("question_type", "single_mcq").strip()
        text = row.get("text", "").strip()
        if not text:
            continue

        if q_type == "numerical":
            num_val = row.get("correct_answer", "0").strip()
            content = {
                "text": text,
                "numerical_value": num_val,
                "numerical_range": [float(num_val) - 0.05, float(num_val) + 0.05] if num_val.replace('.', '', 1).isdigit() else [0, 0]
            }
        else:
            opt_a = row.get("option_a", "").strip()
            opt_b = row.get("option_b", "").strip()
            opt_c = row.get("option_c", "").strip()
            opt_d = row.get("option_d", "").strip()
            correct = row.get("correct_option", "A").strip().upper()
            
            opts = []
            opt_ids = {}
            for label, val in [("A", opt_a), ("B", opt_b), ("C", opt_c), ("D", opt_d)]:
                if val:
                    o_id = generate_uuid()
                    opt_ids[label] = o_id
                    opts.append({"id": o_id, "text": val})

            correct_id = opt_ids.get(correct, opts[0]["id"] if opts else None)
            content = {
                "text": text,
                "options": opts,
                "correct_option_id": correct_id
            }

        q = Question(
            organization_id=org.id,
            subject=subject,
            question_type=q_type,
            content_json=json.dumps(content),
            version=1
        )
        db.add(q)
        imported_count += 1

    db.commit()
    return {"message": f"Successfully imported {imported_count} questions", "count": imported_count}

@router.get("/export-csv")
def export_questions_csv(
    organization_id: str,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exports questions to downloadable CSV format."""
    org = check_org_author_permission(db, current_user.id, organization_id)
    query = db.query(Question).filter(Question.organization_id == org.id)
    if subject:
        query = query.filter(Question.subject == subject)
    questions = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "subject", "question_type", "text", "option_a", "option_b", "option_c", "option_d", "correct_answer"])

    for q in questions:
        try:
            c = json.loads(q.content_json)
        except Exception:
            c = {}
        text = c.get("text", "")
        options = c.get("options", [])
        opt_texts = [o.get("text", "") for o in options]
        while len(opt_texts) < 4:
            opt_texts.append("")
        correct = c.get("correct_option_id") or c.get("numerical_value") or ""
        writer.writerow([q.id, q.subject, q.question_type, text, opt_texts[0], opt_texts[1], opt_texts[2], opt_texts[3], correct])

    return PlainTextResponse(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=lunaris_questions_{org.slug}.csv"})
