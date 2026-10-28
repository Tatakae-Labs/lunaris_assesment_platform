import os
import json
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.core.config import settings
from app.models import User, OrganizationMember, Organization, Question, AIQuestionDraft

router = APIRouter(prefix="/ai", tags=["AI Question Generation"])

class GenerateQuestionsRequest(BaseModel):
    organization_id: str
    topic: str
    subject: str = "Physics"  # Physics, Chemistry, Mathematics
    difficulty: str = "medium"  # easy, medium, hard
    count: int = 4
    include_numerical: bool = True
    groq_api_key: Optional[str] = None

def generate_via_groq(topic: str, subject: str, difficulty: str, count: int, api_key: str) -> Optional[List[Dict[str, Any]]]:
    prompt = f"""You are an expert exam author for advanced academic and competitive examinations (such as IIT JEE Main & Advanced).
Generate {count} high-quality questions for subject: {subject}, topic: "{topic}", difficulty: {difficulty}.
Include a mix of Single-Choice MCQs and Numerical Value Questions (NVQ).
Output ONLY a JSON object matching this schema:
{{
  "questions": [
    {{
      "type": "single_mcq",
      "text": "Question text with LaTeX formulas like $E = mc^2$ where needed",
      "options": [
        {{"id": "opt_1", "text": "Option A"}},
        {{"id": "opt_2", "text": "Option B"}},
        {{"id": "opt_3", "text": "Option C"}},
        {{"id": "opt_4", "text": "Option D"}}
      ],
      "correct_option_id": "opt_1",
      "explanation": "Detailed step-by-step solution"
    }},
    {{
      "type": "numerical",
      "text": "Numerical value question text...",
      "numerical_answer": 42.0,
      "tolerance": 0.01,
      "explanation": "Detailed calculation steps"
    }}
  ]
}}"""

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": "You are a precise STEM question generation engine that outputs only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.5,
        "max_tokens": 3000
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content_str = data["choices"][0]["message"]["content"]
                parsed = json.loads(content_str)
                if isinstance(parsed, dict) and "questions" in parsed and isinstance(parsed["questions"], list):
                    return parsed["questions"]
    except Exception as e:
        print(f"Groq API call error: {e}")
    return None

@router.post("/generate-questions")
def generate_ai_questions(
    req: GenerateQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == req.organization_id) | (Organization.slug == req.organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.plans.entitlements import check_entitlement, record_usage
    allowed, reason, details = check_entitlement(db, org.id, "ai_questions", req.count)
    if not allowed and org.ai_generation_credits <= 0:
        raise HTTPException(status_code=403, detail=reason)

    # Domain topic templates with curriculum intelligence
    templates = {
        "Physics": [
            {
                "type": "single_mcq",
                "text": f"In the context of {req.topic}, consider a body executing motion under conservative forces. If potential energy is U(x) = ax² - bx, find the equilibrium position x₀.",
                "options": [
                    {"id": "opt_1", "text": "b / (2a)"},
                    {"id": "opt_2", "text": "2a / b"},
                    {"id": "opt_3", "text": "a / (2b)"},
                    {"id": "opt_4", "text": "b / a"}
                ],
                "correct_option_id": "opt_1",
                "explanation": "Equilibrium occurs where dU/dx = 0 => 2ax - b = 0 => x = b / (2a)."
            },
            {
                "type": "numerical",
                "text": f"In an experiment on {req.topic}, a resonant frequency of 440 Hz is observed with wire tension T = 100 N. If tension is increased to 400 N, find the new fundamental frequency in Hz.",
                "numerical_answer": 880.0,
                "tolerance": 1.0,
                "explanation": "Frequency is proportional to sqrt(T). sqrt(400/100) = 2, so 440 * 2 = 880 Hz."
            },
            {
                "type": "single_mcq",
                "text": f"A capacitor of capacitance C is connected across an AC voltage source V = V₀ sin(ωt) regarding {req.topic}. The displacement current through the plates is:",
                "options": [
                    {"id": "opt_1", "text": "ω C V₀ cos(ωt)"},
                    {"id": "opt_2", "text": "V₀ / (ω C) sin(ωt)"},
                    {"id": "opt_3", "text": "-ω C V₀ sin(ωt)"},
                    {"id": "opt_4", "text": "Zero"}
                ],
                "correct_option_id": "opt_1",
                "explanation": "Id = C dV/dt = C (ω V₀ cos(ωt))."
            }
        ],
        "Chemistry": [
            {
                "type": "single_mcq",
                "text": f"For the equilibrium reaction involving {req.topic}: N₂O₄(g) ⇌ 2NO₂(g), if total pressure is doubled at constant temperature, the degree of dissociation α will:",
                "options": [
                    {"id": "opt_1", "text": "Decrease"},
                    {"id": "opt_2", "text": "Increase"},
                    {"id": "opt_3", "text": "Remain constant"},
                    {"id": "opt_4", "text": "Become zero"}
                ],
                "correct_option_id": "opt_1",
                "explanation": "Increasing pressure shifts equilibrium toward fewer gas moles (left), decreasing α."
            },
            {
                "type": "numerical",
                "text": f"Calculate the oxidation number of chromium in potassium dichromate (K₂Cr₂O₇) related to {req.topic}.",
                "numerical_answer": 6.0,
                "tolerance": 0.01,
                "explanation": "2(+1) + 2(Cr) + 7(-2) = 0 => 2Cr = +12 => Cr = +6."
            }
        ],
        "Mathematics": [
            {
                "type": "single_mcq",
                "text": f"Evaluate the integral ∫ [x / (x² + 4)] dx related to {req.topic}:",
                "options": [
                    {"id": "opt_1", "text": "(1/2) ln(x² + 4) + C"},
                    {"id": "opt_2", "text": "ln(x² + 4) + C"},
                    {"id": "opt_3", "text": "(1/4) arctan(x/2) + C"},
                    {"id": "opt_4", "text": "2 ln(x² + 4) + C"}
                ],
                "correct_option_id": "opt_1",
                "explanation": "Substitute u = x² + 4, du = 2x dx => (1/2) ∫ (1/u) du = (1/2) ln(x² + 4) + C."
            },
            {
                "type": "numerical",
                "text": f"Find the number of real roots of the equation x⁴ + 4x² + 3 = 0 relating to {req.topic}.",
                "numerical_answer": 0.0,
                "tolerance": 0.01,
                "explanation": "(x² + 1)(x² + 3) = 0 has no real roots since x² >= 0 for all real x."
            }
        ]
    }

    groq_key = req.groq_api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    groq_questions = None
    engine_used = "curriculum_template_fallback"

    if groq_key:
        groq_questions = generate_via_groq(req.topic, req.subject, req.difficulty, req.count, groq_key)
        if groq_questions:
            engine_used = "groq_llama_3.3_70b"

    generated_drafts = []

    if groq_questions:
        for item in groq_questions:
            q_type = item.get("type", "single_mcq")
            content = {
                "text": item.get("text", f"Question on {req.topic}"),
                "explanation": item.get("explanation", "")
            }
            if q_type == "numerical":
                try:
                    raw_num = str(item.get("numerical_answer", "0.0")).replace(",", "").strip()
                    content["numerical_answer"] = float(raw_num)
                except (ValueError, TypeError):
                    content["numerical_answer"] = 0.0

                try:
                    raw_tol = str(item.get("tolerance", "0.01")).replace("±", "").replace(",", "").strip()
                    content["tolerance"] = max(0.0, float(raw_tol))
                except (ValueError, TypeError):
                    content["tolerance"] = 0.01
            else:
                options = item.get("options") or [
                    {"id": "opt_1", "text": "Option A"},
                    {"id": "opt_2", "text": "Option B"},
                    {"id": "opt_3", "text": "Option C"},
                    {"id": "opt_4", "text": "Option D"}
                ]
                content["options"] = options
                content["correct_option_id"] = item.get("correct_option_id", options[0]["id"] if options else "opt_1")

            draft = AIQuestionDraft(
                organization_id=org.id,
                topic=req.topic,
                subject=req.subject,
                difficulty=req.difficulty,
                question_type=q_type,
                content_json=json.dumps(content),
                status="draft"
            )
            db.add(draft)
            db.flush()
            generated_drafts.append({
                "id": draft.id,
                "topic": draft.topic,
                "subject": draft.subject,
                "type": draft.question_type,
                "difficulty": draft.difficulty,
                "content": content
            })
    else:
        pool = templates.get(req.subject, templates["Physics"])
        for i in range(min(req.count, len(pool))):
            sample = pool[i % len(pool)]
            content = {
                "text": sample["text"],
                "explanation": sample.get("explanation", "")
            }
            if sample["type"] == "numerical":
                content["numerical_answer"] = sample["numerical_answer"]
                content["tolerance"] = sample["tolerance"]
            else:
                content["options"] = sample["options"]
                content["correct_option_id"] = sample["correct_option_id"]

            draft = AIQuestionDraft(
                organization_id=org.id,
                topic=req.topic,
                subject=req.subject,
                difficulty=req.difficulty,
                question_type=sample["type"],
                content_json=json.dumps(content),
                status="draft"
            )
            db.add(draft)
            db.flush()
            generated_drafts.append({
                "id": draft.id,
                "topic": draft.topic,
                "subject": draft.subject,
                "type": draft.question_type,
                "difficulty": draft.difficulty,
                "content": content
            })

    db.commit()
    return {
        "topic": req.topic,
        "subject": req.subject,
        "engine": engine_used,
        "drafts_count": len(generated_drafts),
        "drafts": generated_drafts
    }

@router.get("/drafts")
def list_ai_drafts(
    organization_id: str,
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    resolved_id = org.id if org else organization_id

    drafts = (
        db.query(AIQuestionDraft)
        .filter(AIQuestionDraft.organization_id == resolved_id, AIQuestionDraft.status == "draft")
        .order_by(AIQuestionDraft.created_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "topic": d.topic,
            "subject": d.subject,
            "type": d.question_type,
            "difficulty": d.difficulty,
            "content": json.loads(d.content_json),
            "created_at": d.created_at.isoformat()
        }
        for d in drafts
    ]

@router.post("/drafts/{draft_id}/approve")
def approve_ai_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(AIQuestionDraft).filter(AIQuestionDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.status = "approved"

    # Insert into active Question bank
    question = Question(
        organization_id=draft.organization_id,
        subject=draft.subject,
        question_type=draft.question_type,
        content_json=draft.content_json
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    return {"message": "Draft approved and added to active Question Bank!", "question_id": question.id}

@router.post("/drafts/{draft_id}/reject")
def reject_ai_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(AIQuestionDraft).filter(AIQuestionDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.status = "rejected"
    db.commit()
    return {"message": "Draft rejected"}
