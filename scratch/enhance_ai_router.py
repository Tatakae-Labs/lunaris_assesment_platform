import re

with open('backend/app/ai_generation/router.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
code = code.replace(
    'from fastapi import APIRouter, Depends, HTTPException, status\n',
    'from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form\n'
)

# 2. Update GenerateQuestionsRequest schema
old_schema = """class GenerateQuestionsRequest(BaseModel):
    organization_id: str
    topic: str
    subject: str = "General"  # Any custom subject name (e.g. Computer Science, Constitutional Law, Anatomy, Physics)
    difficulty: str = "medium"  # easy, medium, hard, olympiad
    question_format: str = "mixed"  # mixed, single_mcq, multi_mcq, numerical, coding, one_word, crossword, true_false, match_following
    bloom_level: Optional[str] = "analytical"  # recall, comprehension, application, analytical, problem_solving
    reference_notes: Optional[str] = None  # Optional instructor notes or syllabus excerpt
    count: int = 4
    include_numerical: bool = True
    groq_api_key: Optional[str] = None"""

new_schema = """class GenerateQuestionsRequest(BaseModel):
    organization_id: str
    topic: str
    subject: str = "General"  # Any custom subject name
    difficulty: str = "medium"  # easy, medium, hard, olympiad
    question_format: str = "mixed"  # mixed, single_mcq, multi_mcq, numerical, coding, one_word, crossword, true_false, match_following, assertion_reason, case_study
    selected_formats: Optional[List[str]] = None  # Multiple categories simultaneously
    bloom_level: Optional[str] = "analytical"  # recall, comprehension, application, analytical, problem_solving
    target_audience: Optional[str] = "Undergraduate"  # K-12, Undergraduate, Graduate, Certification
    explanation_detail: Optional[str] = "detailed"  # concise, detailed, step_by_step
    reference_notes: Optional[str] = None  # Optional instructor notes or syllabus excerpt
    count: int = 10
    include_numerical: bool = True
    groq_api_key: Optional[str] = None"""

code = code.replace(old_schema, new_schema)

# 3. Update generate_via_groq signature
old_func_sig = """def generate_via_groq(
    topic: str,
    subject: str,
    difficulty: str,
    count: int,
    api_key: str,
    question_format: str = "mixed",
    bloom_level: str = "analytical",
    reference_notes: Optional[str] = None
) -> Optional[tuple]:"""

new_func_sig = """def generate_via_groq(
    topic: str,
    subject: str,
    difficulty: str,
    count: int,
    api_key: str,
    question_format: str = "mixed",
    selected_formats: Optional[List[str]] = None,
    bloom_level: str = "analytical",
    target_audience: str = "Undergraduate",
    explanation_detail: str = "detailed",
    reference_notes: Optional[str] = None
) -> Optional[tuple]:"""

code = code.replace(old_func_sig, new_func_sig)

# 4. Update format instructions inside generate_via_groq
old_fmt_block = """    format_instruction = "Include a balanced mix of Single-Choice MCQs and other formats appropriate for the subject."
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
        format_instruction = "Generate ONLY Crossword Puzzle clues (type: 'crossword') with clues list ({direction, clue, answer, row, col})." """

new_fmt_block = """    if selected_formats and len(selected_formats) > 0:
        fmt_labels = []
        for sf in selected_formats:
            if sf == "single_mcq": fmt_labels.append("Single-Choice MCQ (type: 'single_mcq')")
            elif sf == "multi_mcq": fmt_labels.append("Multiple-Correct MCQ (type: 'multi_mcq', correct_option_ids array)")
            elif sf == "numerical": fmt_labels.append("Numerical Value Problem (type: 'numerical', numerical_answer, tolerance)")
            elif sf == "assertion_reason": fmt_labels.append("Assertion & Reason (type: 'assertion_reason', Assertion (A) & Reason (R) statements with 4 options)")
            elif sf == "true_false": fmt_labels.append("True/False (type: 'true_false', correct_answer 'true' or 'false')")
            elif sf == "coding": fmt_labels.append("Coding Sandbox (type: 'coding', starter_code, test_cases)")
            elif sf == "one_word": fmt_labels.append("One-Word Answer (type: 'one_word', target_word, acceptable_words, hint)")
            elif sf == "match_following": fmt_labels.append("Match the Following (type: 'match_following', pairs: [{left, right}])")
            elif sf == "case_study": fmt_labels.append("Case Study / Passage (type: 'case_study', passage, options, correct_option_id)")
            else: fmt_labels.append(sf)
        format_instruction = f"Generate an evenly distributed mix across ALL of these selected categories simultaneously: {', '.join(fmt_labels)}. Ensure every selected format is present."
    elif question_format == "single_mcq":
        format_instruction = "Generate ONLY Single-Choice Multiple Choice Questions (type: 'single_mcq')."
    elif question_format == "multi_mcq":
        format_instruction = "Generate ONLY Multiple-Correct Multiple Choice Questions (type: 'multi_mcq') with 'correct_option_ids' array."
    elif question_format == "numerical":
        format_instruction = "Generate ONLY Numerical Value Questions (type: 'numerical') with numerical_answer and tolerance."
    elif question_format == "assertion_reason":
        format_instruction = "Generate ONLY Assertion & Reason evaluation questions (type: 'assertion_reason')."
    elif question_format == "coding":
        format_instruction = "Generate ONLY Coding & Algorithm problems (type: 'coding') with starter_code (python, js, cpp), and at least 2 test_cases."
    elif question_format == "one_word":
        format_instruction = "Generate ONLY One-Word Answer / Definition questions (type: 'one_word') with target_word, acceptable_words list, and a hint."
    elif question_format == "true_false":
        format_instruction = "Generate ONLY True/False statement verification questions (type: 'true_false') with correct_answer ('true' or 'false')."
    elif question_format == "match_following":
        format_instruction = "Generate ONLY Match the Following questions (type: 'match_following') with pairs."
    else:
        format_instruction = "Include a rich, balanced mix of Single-Choice MCQs, Multiple-Correct MCQs, Numerical Value Problems, and Conceptual Questions." """

code = code.replace(old_fmt_block, new_fmt_block)

# 5. Update prompt with audience and detail
old_prompt_line = 'Difficulty Level: {difficulty.upper()} (Cognitive level: {bloom_level}).'
new_prompt_line = 'Difficulty Level: {difficulty.upper()} (Cognitive level: {bloom_level}, Academic Tier: {target_audience}, Explanation Style: {explanation_detail}).'
code = code.replace(old_prompt_line, new_prompt_line)

# 6. Update caller in generate_questions
old_caller = """        groq_result = generate_via_groq(
            topic=req.topic,
            subject=req.subject,
            difficulty=req.difficulty,
            count=req.count,
            api_key=active_api_key,
            question_format=req.question_format,
            bloom_level=req.bloom_level or "analytical",
            reference_notes=req.reference_notes
        )"""

new_caller = """        groq_result = generate_via_groq(
            topic=req.topic,
            subject=req.subject,
            difficulty=req.difficulty,
            count=req.count,
            api_key=active_api_key,
            question_format=req.question_format,
            selected_formats=req.selected_formats,
            bloom_level=req.bloom_level or "analytical",
            target_audience=req.target_audience or "Undergraduate",
            explanation_detail=req.explanation_detail or "detailed",
            reference_notes=req.reference_notes
        )"""

code = code.replace(old_caller, new_caller)

# 7. Add Bulk Approve & File Ingestion Endpoints at the bottom
endpoints_to_append = """
@router.post("/drafts/bulk-approve")
def bulk_approve_ai_drafts(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"Approve all or selected AI question drafts and add them to the Question Bank.\"\"\"
    organization_id = payload.get("organization_id")
    draft_ids = payload.get("draft_ids")

    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    resolved_id = org.id if org else organization_id

    query = db.query(AIQuestionDraft).filter(
        AIQuestionDraft.organization_id == resolved_id,
        AIQuestionDraft.status == "draft"
    )
    if draft_ids and len(draft_ids) > 0:
        query = query.filter(AIQuestionDraft.id.in_(draft_ids))

    drafts = query.all()
    approved_count = 0
    created_questions = []

    for draft in drafts:
        draft.status = "approved"
        question = Question(
            organization_id=draft.organization_id,
            subject=draft.subject or "General",
            question_type=draft.question_type or "single_mcq",
            content_json=draft.content_json
        )
        db.add(question)
        approved_count += 1
        created_questions.append(question)

    db.commit()
    return {
        "status": "success",
        "message": f"Successfully approved {approved_count} questions into the active Question Bank!",
        "count": approved_count
    }


def extract_file_text(filename: str, file_bytes: bytes) -> str:
    \"\"\"Extract readable text from PDF, DOCX, TXT, CSV, JSON, or Markdown files.\"\"\"
    ext = os.path.splitext(filename)[1].lower()
    text = ""
    if ext == ".pdf":
        import io
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                extracted = []
                for p in pdf.pages[:40]:
                    t = p.extract_text()
                    if t: extracted.append(t)
                text = "\\n\\n".join(extracted)
        except Exception:
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                pages = [p.extract_text() for p in reader.pages[:40] if p.extract_text()]
                text = "\\n\\n".join(pages)
            except Exception:
                text = ""
    else:
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                text = ""
    return text.strip()


def parse_questions_from_document_text(
    doc_text: str,
    subject: str,
    groq_api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    \"\"\"Intelligently extract, categorize, and structure individual questions from document text.\"\"\"
    if not doc_text:
        return []

    # Method A: High-accuracy extraction via Groq LLM
    active_key = groq_api_key or os.getenv("GROQ_API_KEY", "")
    if active_key and active_key.strip():
        prompt = f\"\"\"You are an expert assessment document parser and examination categorizer.
Analyze the following text extracted from an academic exam, test sheet, or Past Year Question paper (PYQ):
'''
{doc_text[:12000]}
'''

Task:
Extract and categorize EVERY distinct question from this document.
For each question:
1. "text": Complete question prompt / statement (preserve formulas in LaTeX like $x^2$).
2. "type": "single_mcq" | "multi_mcq" | "numerical" | "assertion_reason" | "true_false" | "one_word" | "subjective"
3. "options": If multiple-choice, extract 4 options [{{"id": "opt_1", "text": "..."}}, {{"id": "opt_2", "text": "..."}}, {{"id": "opt_3", "text": "..."}}, {{"id": "opt_4", "text": "..."}}].
4. "correct_option_id": Correct option id if specified in answer key or deduced; default "opt_1".
5. "numerical_answer": Float answer if numerical question; null otherwise.
6. "explanation": Answer key explanation or solution rationale.
7. "subject": Subject or domain (e.g. "{subject}" or auto-detected).
8. "topic": Specific chapter / topic / category (e.g. "Binary Trees", "Thermodynamics", "Linear Algebra").
9. "difficulty": "easy" | "medium" | "hard".
10. "tags": ["PYQ", "Categorized", topic_name].

Return ONLY a JSON object strictly matching:
{{
  "questions": [ ... ]
}}
\"\"\"
        headers = {
            "Authorization": f"Bearer {active_key.strip()}",
            "Content-Type": "application/json"
        }
        for model in ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "openai/gpt-oss-120b"]:
            try:
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "You are a precise academic question parser that outputs strictly valid JSON."},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.3,
                            "max_tokens": 8192
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_content = data["choices"][0]["message"]["content"]
                        parsed = json.loads(raw_content)
                        if "questions" in parsed and isinstance(parsed["questions"], list) and len(parsed["questions"]) > 0:
                            return parsed["questions"]
            except Exception:
                continue

    # Method B: Robust Regex & Heuristic Fallback Parser
    import re
    questions = []
    # Split by common question delimiters: "Q1.", "Question 1", "1.", etc.
    blocks = re.split(r'\\n(?=(?:Q(?:uestion)?\\.?\\s*\\d+|\\b\\d{1,3}\\b[\\.\\)]))\\s*', doc_text)
    for b in blocks:
        b = b.strip()
        if len(b) < 25:
            continue
        
        # Check for options A), B), C), D) or (A), (B), (C), (D)
        opt_matches = re.findall(r'(?:[\\(\\s]|^)([A-Da-d])[\\)\\.]\\s*([^\\n]+)', b)
        q_lines = b.split('\\n')
        q_title = q_lines[0][:160]

        if len(opt_matches) >= 3:
            # It's an MCQ!
            opts = []
            for idx, (letter, opt_text) in enumerate(opt_matches[:4]):
                opts.append({"id": f"opt_{idx+1}", "text": f"({letter.upper()}) {opt_text.strip()}"})
            
            # Find answer key if indicated
            ans_match = re.search(r'(?:Ans(?:wer)?|Key|Correct)[\\s\\:\\-]+([A-Da-d])', b, re.IGNORECASE)
            corr_id = "opt_1"
            if ans_match:
                letter_idx = ord(ans_match.group(1).upper()) - ord('A')
                if 0 <= letter_idx < len(opts):
                    corr_id = opts[letter_idx]["id"]

            questions.append({
                "type": "single_mcq",
                "text": b[:400].strip(),
                "options": opts,
                "correct_option_id": corr_id,
                "explanation": "Extracted from examination paper.",
                "subject": subject,
                "topic": "Curriculum Review",
                "difficulty": "medium",
                "tags": ["PYQ", "Document Import"]
            })
        else:
            # Numerical or Subjective question
            num_match = re.search(r'(?:Ans(?:wer)?|Value)[\\s\\:\\-]+([\\d\\.]+)', b, re.IGNORECASE)
            num_val = float(num_match.group(1)) if num_match else 0.0
            questions.append({
                "type": "numerical" if num_match else "single_mcq",
                "text": b[:400].strip(),
                "numerical_answer": num_val,
                "tolerance": 0.1,
                "options": [
                    {"id": "opt_1", "text": "Statement 1 is theoretically consistent"},
                    {"id": "opt_2", "text": "Statement 2 is invalid"},
                    {"id": "opt_3", "text": "Both statements are mutually exclusive"},
                    {"id": "opt_4", "text": "Empirical validation required"}
                ] if not num_match else None,
                "correct_option_id": "opt_1" if not num_match else None,
                "explanation": "Extracted from examination document.",
                "subject": subject,
                "topic": "Curriculum Review",
                "difficulty": "medium",
                "tags": ["PYQ", "Document Import"]
            })

    return questions


@router.post("/ingest-file")
async def ingest_question_file(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    subject: Optional[str] = Form("General"),
    auto_approve: bool = Form(False),
    groq_api_key: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    \"\"\"Upload any file (PYQ, PDF, TXT, CSV, JSON), intelligently analyze & categorize questions, and ingest into Question Bank.\"\"\"
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    filename = file.filename or "uploaded_paper.pdf"
    doc_text = extract_file_text(filename, file_bytes)

    if not doc_text or len(doc_text.strip()) < 15:
        raise HTTPException(status_code=400, detail=f"Could not extract readable text from '{filename}'. Please ensure the file contains text.")

    # Analyze & categorize questions via AI
    extracted_questions = parse_questions_from_document_text(doc_text, subject or "General", groq_api_key)

    if not extracted_questions:
        raise HTTPException(status_code=422, detail="No structured assessment questions could be recognized from this document.")

    created_drafts = []
    categories_breakdown = {}

    for item in extracted_questions:
        q_type = item.get("type", "single_mcq")
        q_topic = item.get("topic") or "Document Item"
        q_subject = item.get("subject") or subject or "General"
        q_diff = item.get("difficulty") or "medium"
        q_tags = item.get("tags") or ["PYQ"]

        categories_breakdown[q_type] = categories_breakdown.get(q_type, 0) + 1

        content = {
            "text": item.get("text", "Question statement"),
            "explanation": item.get("explanation", "Extracted from imported paper"),
            "tags": q_tags,
            "source_file": filename
        }

        if q_type == "numerical":
            try:
                content["numerical_answer"] = float(item.get("numerical_answer", 0.0))
            except:
                content["numerical_answer"] = 0.0
            content["tolerance"] = float(item.get("tolerance", 0.1))
        elif q_type in ["single_mcq", "multi_mcq", "assertion_reason", "case_study"]:
            options = item.get("options") or [
                {"id": "opt_1", "text": "Option A"},
                {"id": "opt_2", "text": "Option B"},
                {"id": "opt_3", "text": "Option C"},
                {"id": "opt_4", "text": "Option D"}
            ]
            content["options"] = options
            if q_type == "multi_mcq":
                content["correct_option_ids"] = item.get("correct_option_ids", ["opt_1"])
            else:
                content["correct_option_id"] = item.get("correct_option_id", options[0]["id"])
        elif q_type == "true_false":
            content["correct_answer"] = item.get("correct_answer", "true")
        elif q_type == "coding":
            content["starter_code"] = item.get("starter_code", "# Write solution\\n")
            content["test_cases"] = item.get("test_cases", [])

        # Create AI Question Draft
        draft = AIQuestionDraft(
            organization_id=org.id,
            topic=q_topic,
            subject=q_subject,
            difficulty=q_diff,
            question_type=q_type,
            content_json=json.dumps(content),
            status="approved" if auto_approve else "draft"
        )
        db.add(draft)
        db.flush()

        # If auto_approve requested, also create directly in Question Bank!
        if auto_approve:
            q_rec = Question(
                organization_id=org.id,
                subject=q_subject,
                question_type=q_type,
                content_json=json.dumps(content)
            )
            db.add(q_rec)

        created_drafts.append({
            "id": draft.id,
            "topic": draft.topic,
            "subject": draft.subject,
            "type": draft.question_type,
            "difficulty": draft.difficulty,
            "content": content
        })

    db.commit()

    return {
        "status": "success",
        "filename": filename,
        "questions_extracted": len(created_drafts),
        "categories_breakdown": categories_breakdown,
        "auto_approved": auto_approve,
        "message": f"Successfully analyzed '{filename}' and extracted {len(created_drafts)} categorized questions!",
        "drafts": created_drafts
    }
"""

code = code + "\n" + endpoints_to_append

with open('backend/app/ai_generation/router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated backend/app/ai_generation/router.py successfully')

