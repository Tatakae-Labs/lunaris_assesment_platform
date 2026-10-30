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
    subject: str = "General"  # Any custom subject name (e.g. Computer Science, Constitutional Law, Anatomy, Physics)
    difficulty: str = "medium"  # easy, medium, hard, olympiad
    question_format: str = "mixed"  # mixed, single_mcq, multi_mcq, numerical, coding, one_word, crossword, true_false, match_following
    bloom_level: Optional[str] = "analytical"  # recall, comprehension, application, analytical, problem_solving
    reference_notes: Optional[str] = None  # Optional instructor notes or syllabus excerpt
    count: int = 4
    include_numerical: bool = True
    groq_api_key: Optional[str] = None

def generate_via_groq(
    topic: str,
    subject: str,
    difficulty: str,
    count: int,
    api_key: str,
    question_format: str = "mixed",
    bloom_level: str = "analytical",
    reference_notes: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    notes_clause = ""
    if reference_notes and reference_notes.strip():
        notes_clause = f"\nGROUNDING REFERENCE NOTES:\n'''\n{reference_notes.strip()[:2000]}\n'''\nSynthesize questions strictly aligned with these provided notes.\n"

    format_instruction = "Include a balanced mix of Single-Choice MCQs and other formats appropriate for the subject."
    if question_format == "single_mcq":
        format_instruction = "Generate ONLY Single-Choice Multiple Choice Questions (type: 'single_mcq')."
    elif question_format == "multi_mcq":
        format_instruction = "Generate ONLY Multiple-Correct Multiple Choice Questions (type: 'multi_mcq') with 'correct_option_ids' array."
    elif question_format == "numerical":
        format_instruction = "Generate ONLY Numerical Value Questions (type: 'numerical') with numerical_answer and tolerance."
    elif question_format == "coding":
        format_instruction = "Generate ONLY Coding & Algorithm problems (type: 'coding') with starter_code (python, js, cpp), and at least 2 test_cases (with input, expected_output, is_hidden)."
    elif question_format == "one_word":
        format_instruction = "Generate ONLY One-Word Answer / Definition questions (type: 'one_word') with target_word, acceptable_words list, and a hint."
    elif question_format == "true_false":
        format_instruction = "Generate ONLY True/False statement verification questions (type: 'true_false') with correct_answer ('true' or 'false')."
    elif question_format == "match_following":
        format_instruction = "Generate ONLY Match the Following questions (type: 'match_following') with 3-4 pairs ({left, right})."
    elif question_format == "crossword":
        format_instruction = "Generate ONLY Crossword Puzzle clues (type: 'crossword') with clues list ({direction, clue, answer, row, col})."

    prompt = f"""You are an expert curriculum author for university examinations, competitive certifications, and professional assessments across all disciplines.
Generate {count} high-quality, scientifically sound assessment questions for Subject: "{subject}", Topic: "{topic}".
Difficulty Level: {difficulty.upper()} (Cognitive level: {bloom_level}).
{format_instruction}
{notes_clause}

Output ONLY a JSON object strictly matching this schema:
{{
  "questions": [
    {{
      "type": "single_mcq",
      "text": "Question statement (use LaTeX formulas like $E=mc^2$ where appropriate)",
      "options": [
        {{"id": "opt_1", "text": "Option A"}},
        {{"id": "opt_2", "text": "Option B"}},
        {{"id": "opt_3", "text": "Option C"}},
        {{"id": "opt_4", "text": "Option D"}}
      ],
      "correct_option_id": "opt_1",
      "explanation": "Detailed pedagogical explanation"
    }},
    {{
      "type": "coding",
      "text": "Problem description with input/output constraints...",
      "starter_code": {{
        "python": "import sys\\ndef solve():\\n    pass\\nif __name__ == '__main__':\\n    solve()\\n",
        "javascript": "const fs = require('fs');\\nfunction solve() {{}}\\nsolve();\\n"
      }},
      "test_cases": [
        {{"id": "1", "input": "3 4\\n", "expected_output": "7", "is_hidden": false, "explanation": "3 + 4 = 7"}},
        {{"id": "2", "input": "10 20\\n", "expected_output": "30", "is_hidden": true}}
      ],
      "time_limit_sec": 2.0,
      "explanation": "Optimal algorithm walkthrough"
    }},
    {{
      "type": "one_word",
      "text": "Give one word or scientific term for the following definition...",
      "target_word": "MITOCHONDRIA",
      "acceptable_words": ["mitochondrion", "powerhouse"],
      "hint": "Cellular ATP generator",
      "explanation": "Mitochondria produce cellular adenosine triphosphate."
    }},
    {{
      "type": "true_false",
      "text": "Statement to verify as true or false...",
      "correct_answer": "true",
      "explanation": "Verification rationale."
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
            {"role": "system", "content": "You are a precise, universal academic assessment engine that outputs only valid JSON conforming strictly to the requested schema."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.5,
        "max_tokens": 4000
    }
    try:
        with httpx.Client(timeout=35.0) as client:
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

    if not org.is_service_enabled("ai_studio"):
        raise HTTPException(
            status_code=403,
            detail="AI Question Studio service is disabled for your organization by the platform administrator."
        )

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
        groq_questions = generate_via_groq(
            topic=req.topic,
            subject=req.subject,
            difficulty=req.difficulty,
            count=req.count,
            api_key=groq_key,
            question_format=req.question_format,
            bloom_level=req.bloom_level or "analytical",
            reference_notes=req.reference_notes
        )
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
            if q_type == "coding":
                content["starter_code"] = item.get("starter_code") or {
                    "python": "import sys\ndef solve():\n    pass\nif __name__ == '__main__':\n    solve()\n",
                    "javascript": "const fs = require('fs');\nfunction solve() {}\nsolve();\n"
                }
                content["test_cases"] = item.get("test_cases") or [
                    {"id": "1", "input": "3 4\n", "expected_output": "7", "is_hidden": False}
                ]
                content["time_limit_sec"] = float(item.get("time_limit_sec", 2.0))
            elif q_type == "one_word":
                content["target_word"] = str(item.get("target_word", "")).strip().upper()
                content["acceptable_words"] = item.get("acceptable_words", [])
                content["hint"] = item.get("hint", "")
            elif q_type == "true_false":
                content["correct_answer"] = str(item.get("correct_answer", "true")).strip().lower()
            elif q_type == "match_following":
                content["pairs"] = item.get("pairs") or [
                    {"id": "1", "left": "Item A", "right": "Match A"},
                    {"id": "2", "left": "Item B", "right": "Match B"}
                ]
            elif q_type == "crossword":
                content["clues"] = item.get("clues") or []
            elif q_type == "multi_mcq":
                options = item.get("options") or [
                    {"id": "opt_1", "text": "Option A"},
                    {"id": "opt_2", "text": "Option B"},
                    {"id": "opt_3", "text": "Option C"},
                    {"id": "opt_4", "text": "Option D"}
                ]
                content["options"] = options
                content["correct_option_ids"] = item.get("correct_option_ids", ["opt_1"])
            elif q_type == "numerical":
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
