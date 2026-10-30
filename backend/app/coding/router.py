import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models import Question
from app.coding.runner import (
    SUPPORTED_LANGUAGES,
    execute_single_run,
    evaluate_test_cases,
    find_executable
)

router = APIRouter(prefix="/coding", tags=["Coding Sandbox & Compiler Engine"])


class CodeExecutionRequest(BaseModel):
    source_code: str
    language: str  # "python", "javascript", "cpp", "java"
    stdin_input: Optional[str] = ""
    time_limit_sec: Optional[float] = 3.0


class QuestionEvaluateRequest(BaseModel):
    source_code: str
    language: str
    question_id: Optional[str] = None
    custom_test_cases: Optional[List[Dict[str, Any]]] = None
    time_limit_sec: Optional[float] = 3.0


@router.get("/languages")
def get_supported_languages():
    """Returns supported languages, templates, and compiler readiness on this host."""
    langs = []
    for lang_id, meta in SUPPORTED_LANGUAGES.items():
        is_ready = True
        notes = "Ready"
        if lang_id == "javascript":
            has_node = bool(find_executable("node"))
            is_ready = has_node
            notes = "Ready (Node.js)" if has_node else "Node runtime not detected"
        elif lang_id == "cpp":
            has_gpp = bool(find_executable("g++") or find_executable("clang++"))
            is_ready = has_gpp
            notes = "Ready (G++ / Clang++)" if has_gpp else "C++ compiler not detected"
        elif lang_id == "java":
            has_java = bool(find_executable("javac") and find_executable("java"))
            is_ready = has_java
            notes = "Ready (JDK/Java)" if has_java else "JDK not detected"

        langs.append({
            "id": lang_id,
            "name": meta["name"],
            "extension": meta["extension"],
            "template": meta["template"],
            "is_ready": is_ready,
            "notes": notes
        })
    return langs


@router.post("/execute")
def run_code_sandbox(req: CodeExecutionRequest):
    """
    Executes a single source code run inside an isolated sandbox with custom stdin.
    Enforces process timeout and returns execution output and metrics.
    """
    if not req.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty.")

    res = execute_single_run(
        source_code=req.source_code,
        language=req.language,
        stdin_input=req.stdin_input or "",
        time_limit_sec=min(10.0, max(0.5, req.time_limit_sec or 3.0))
    )
    return res


@router.post("/evaluate")
def evaluate_code_solution(req: QuestionEvaluateRequest, db: Session = Depends(get_db)):
    """
    Runs candidate source code against test cases (from a Question record or custom test cases).
    Evaluates each test case, validates expected vs actual stdout, and computes pass rate.
    """
    if not req.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty.")

    test_cases = req.custom_test_cases or []

    if req.question_id:
        q = db.query(Question).filter(Question.id == req.question_id).first()
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        try:
            content = json.loads(q.content_json) if isinstance(q.content_json, str) else (q.content_json or {})
            question_cases = content.get("test_cases", [])
            if question_cases:
                test_cases = question_cases
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to parse question test cases: {exc}")

    if not test_cases:
        # Fallback to single run if no test cases provided
        single_res = execute_single_run(
            source_code=req.source_code,
            language=req.language,
            stdin_input="",
            time_limit_sec=req.time_limit_sec or 3.0
        )
        return {
            "all_passed": single_res.get("status") == "success",
            "passed_count": 1 if single_res.get("status") == "success" else 0,
            "total_count": 1,
            "score_percentage": 100.0 if single_res.get("status") == "success" else 0.0,
            "total_time_ms": single_res.get("execution_time_ms", 0.0),
            "results": [
                {
                    "test_case_id": "custom",
                    "case_number": 1,
                    "is_hidden": False,
                    "status": single_res.get("status"),
                    "passed": single_res.get("status") == "success",
                    "execution_time_ms": single_res.get("execution_time_ms", 0.0),
                    "input": "",
                    "expected_output": "",
                    "actual_output": single_res.get("stdout", ""),
                    "stderr": single_res.get("stderr", "")
                }
            ]
        }

    return evaluate_test_cases(
        source_code=req.source_code,
        language=req.language,
        test_cases=test_cases,
        time_limit_sec=min(10.0, max(0.5, req.time_limit_sec or 3.0))
    )

