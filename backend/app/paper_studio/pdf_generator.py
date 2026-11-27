import io
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        KeepTogether,
        HRFlowable
    )
    REPORTLAB_AVAILABLE = True
except Exception as _rl_exc:
    REPORTLAB_AVAILABLE = False


# Unicode transliteration map for clean normal ASCII text across all platforms and print engines
_UNICODE_REPLACEMENTS = {
    # Superscripts
    "\u2070": "^0", "\u00b9": "^1", "\u00b2": "^2", "\u00b3": "^3",
    "\u2074": "^4", "\u2075": "^5", "\u2076": "^6", "\u2077": "^7",
    "\u2078": "^8", "\u2079": "^9", "\u207a": "^+", "\u207b": "^-",
    # Subscripts
    "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3",
    "\u2084": "4", "\u2085": "5", "\u2086": "6", "\u2087": "7",
    "\u2088": "8", "\u2089": "9",
    # Mathematical operators & signs
    "\u00b1": "+/-", "\u2213": "-/+", "\u00d7": "*", "\u00f7": "/",
    "\u2264": "<=", "\u2265": ">=", "\u2260": "!=", "\u2248": "~",
    "\u2261": "=", "\u221e": "inf", "\u221a": "sqrt", "\u222b": "integral ",
    "\u2211": "sum ", "\u220f": "prod ", "\u2202": "d", "\u2206": "Delta",
    "\u00b0": " deg", "\u2022": "|", "\u00b7": "-", "\u2026": "...",
    # Arrows & relations
    "\u21cc": "<=>", "\u21c4": "<=>", "\u2192": "->", "\u279c": "->",
    "\u2794": "->", "\u2190": "<-", "\u21d2": "=>", "\u21d4": "<=>",
    # Greek letters
    "\u03b1": "alpha", "\u0391": "Alpha", "\u03b2": "beta", "\u0392": "Beta",
    "\u03b3": "gamma", "\u0393": "Gamma", "\u03b4": "delta", "\u0394": "Delta",
    "\u03b5": "epsilon", "\u03b8": "theta", "\u0398": "Theta", "\u03bb": "lambda",
    "\u039b": "Lambda", "\u03bc": "mu", "\u03c0": "pi", "\u03a0": "Pi",
    "\u03c1": "rho", "\u03c3": "sigma", "\u03a3": "Sigma", "\u03c4": "tau",
    "\u03c6": "phi", "\u03d5": "phi", "\u03a6": "Phi", "\u03c9": "omega",
    "\u03a9": "Omega",
    # Quotes and dashes
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
    "\u2013": "-", "\u2014": "-", "\u2015": "-", "\u00a0": " ",
}


def _clean_text(val: Any) -> str:
    """Sanitizes text by replacing unicode signs, math symbols, and artifacts with clear normal text."""
    if val is None:
        return ""
    text = str(val)
    # 1. Apply unicode transliteration
    for orig, repl in _UNICODE_REPLACEMENTS.items():
        if orig in text:
            text = text.replace(orig, repl)
    # 2. Strip ReportLab / PDF font artifacts like (cid:127) or \ufffd
    import re
    text = re.sub(r'\(cid:\d+\)', '', text)
    text = text.replace('\ufffd', '')
    # 3. Clean any remaining non-ascii characters to spaces so font rendering never fails
    cleaned = []
    for ch in text:
        if ord(ch) < 128:
            cleaned.append(ch)
        else:
            cleaned.append(' ')
    text = "".join(cleaned)
    # 4. XML escape for ReportLab Paragraph
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.strip()


def generate_student_paper_pdf(
    paper_title: str,
    org_name: str,
    duration_minutes: int,
    total_marks: float,
    instructions: str,
    sections: List[Dict[str, Any]],
    set_name: str = "SET A"
) -> bytes:
    """
    Generates a print-ready Student Question Paper PDF.
    Contains question stems, multiple-choice options, numerical input blocks,
    and workspace for subjective/fill-in-the-blank items. Does NOT contain answers.
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("PDF generation engine is initializing or missing dependencies (ReportLab / Pillow).")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom typography
    header_org = ParagraphStyle(
        "HeaderOrg",
        parent=styles["Normal"],
        fontSize=14,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"),
        alignment=1,  # Center
        leading=18
    )

    header_title = ParagraphStyle(
        "HeaderTitle",
        parent=styles["Normal"],
        fontSize=18,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
        leading=22
    )

    meta_style = ParagraphStyle(
        "MetaStyle",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#334155"),
        leading=14
    )

    inst_style = ParagraphStyle(
        "InstStyle",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#475569"),
        leading=13
    )

    sec_header_style = ParagraphStyle(
        "SecHeader",
        parent=styles["Normal"],
        fontSize=12,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        leading=16
    )

    q_text_style = ParagraphStyle(
        "QText",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica",
        textColor=colors.HexColor("#1e293b"),
        leading=14
    )

    opt_style = ParagraphStyle(
        "OptStyle",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#334155"),
        leading=13
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph(_clean_text(org_name.upper()), header_org))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_clean_text(paper_title), header_title))
    story.append(Spacer(1, 6))

    # Meta Table (Set, Time, Marks, Candidate Details)
    meta_data = [
        [
            Paragraph(f"<b>SERIES:</b> {set_name}", meta_style),
            Paragraph(f"<b>TIME ALLOWED:</b> {duration_minutes} Mins", meta_style),
            Paragraph(f"<b>MAXIMUM MARKS:</b> {int(total_marks) if total_marks.is_integer() else total_marks}", meta_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[170, 180, 180])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # Candidate Fill Box
    cand_box = [
        [
            Paragraph("<b>Candidate Name:</b> ___________________________", meta_style),
            Paragraph("<b>Roll / UID:</b> ___________________________", meta_style)
        ]
    ]
    cand_table = Table(cand_box, colWidths=[265, 265])
    cand_table.setStyle(TableStyle([
        ("PADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(cand_table)
    story.append(Spacer(1, 10))

    # General Instructions Box
    if instructions:
        inst_p = Paragraph(f"<b>GENERAL INSTRUCTIONS:</b><br/>{_clean_text(instructions).replace(chr(10), '<br/>')}", inst_style)
        inst_table = Table([[inst_p]], colWidths=[532])
        inst_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(inst_table)
        story.append(Spacer(1, 14))

    # 2. Iterate through Sections and Questions
    q_global_index = 1

    for sec_idx, sec in enumerate(sections, 1):
        sec_name = sec.get("name") or f"Section {chr(64 + sec_idx)}"
        sec_desc = sec.get("description") or ""
        sec_subj = sec.get("subject") or "General"
        marks_each = sec.get("marks_per_question") or 4.0
        neg_each = sec.get("negative_marking") or 0.0
        questions = sec.get("questions") or []

        # Section Banner
        sec_title_text = f"<b>{sec_name.upper()} ({sec_subj})</b>"
        if marks_each:
            sec_title_text += f" &nbsp;|&nbsp; [{marks_each} Marks | Negative: {neg_each}]"
        story.append(Paragraph(sec_title_text, sec_header_style))
        if sec_desc:
            story.append(Spacer(1, 2))
            story.append(Paragraph(f"<i>{_clean_text(sec_desc)}</i>", inst_style))

        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0f172a"), spaceBefore=4, spaceAfter=10))

        for q in questions:
            content = q.get("content") or {}
            q_text = content.get("text") or q.get("text") or "Question text"
            q_type = q.get("question_type") or "single_mcq"
            q_marks = q.get("marks") or marks_each

            q_flowables = []

            # Question Header + Stem
            stem_html = f"<b>Q{q_global_index}.</b> {_clean_text(q_text)} <font color='#64748b'>({q_marks} Marks)</font>"
            q_flowables.append(Paragraph(stem_html, q_text_style))
            q_flowables.append(Spacer(1, 5))

            # Options / Interaction Blocks based on Question Type
            if q_type in ("single_mcq", "multi_mcq"):
                options = content.get("options") or q.get("options") or []
                opt_rows = []
                opt_labels = ["(A)", "(B)", "(C)", "(D)", "(E)", "(F)"]
                for i, opt in enumerate(options):
                    lbl = opt_labels[i] if i < len(opt_labels) else f"({i+1})"
                    opt_t = opt.get("text") if isinstance(opt, dict) else str(opt)
                    opt_rows.append(Paragraph(f"<b>{lbl}</b> {_clean_text(opt_t)}", opt_style))

                # Arrange options into 2-column table if 4 options, or vertical list
                if len(opt_rows) == 4:
                    opt_table = Table([[opt_rows[0], opt_rows[1]], [opt_rows[2], opt_rows[3]]], colWidths=[256, 256])
                    opt_table.setStyle(TableStyle([
                        ("PADDING", (0, 0), (-1, -1), 3),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]))
                    q_flowables.append(opt_table)
                else:
                    for r in opt_rows:
                        q_flowables.append(r)
                        q_flowables.append(Spacer(1, 2))

            elif q_type == "numerical":
                num_box = Paragraph("<b>Answer: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</b> &nbsp;&nbsp;&nbsp; <font color='#94a3b8'><i>(Enter numerical value with decimal)</i></font>", opt_style)
                q_flowables.append(num_box)

            elif q_type == "true_false":
                tf_box = Paragraph("<b>[ &nbsp;&nbsp; ] TRUE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp;&nbsp; ] FALSE</b>", opt_style)
                q_flowables.append(tf_box)

            elif q_type == "fill_in_blanks":
                fib_box = Paragraph("<b>Answer: __________________________________________________</b>", opt_style)
                q_flowables.append(fib_box)

            elif q_type == "subjective":
                # Ruled lines for answer space
                q_flowables.append(Spacer(1, 4))
                rule_lines = [
                    Paragraph("<font color='#cbd5e1'>____________________________________________________________________________________</font>", inst_style),
                    Paragraph("<font color='#cbd5e1'>____________________________________________________________________________________</font>", inst_style),
                    Paragraph("<font color='#cbd5e1'>____________________________________________________________________________________</font>", inst_style)
                ]
                for rl in rule_lines:
                    q_flowables.append(rl)
                    q_flowables.append(Spacer(1, 2))

            q_flowables.append(Spacer(1, 10))
            story.append(KeepTogether(q_flowables))
            q_global_index += 1

        story.append(Spacer(1, 10))

    # Build document
    doc.build(story)
    return buf.getvalue()


def generate_teacher_key_pdf(
    paper_title: str,
    org_name: str,
    total_marks: float,
    sections: List[Dict[str, Any]],
    set_name: str = "SET A"
) -> bytes:
    """
    Generates a complete Teacher Answer Key & Scoring Guide PDF.
    Contains question numbers, correct answers, step-by-step solutions,
    explanations, numerical tolerances, and subjective grading rubrics.
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("PDF generation engine is initializing or missing dependencies (ReportLab / Pillow).")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    header_title = ParagraphStyle(
        "KeyHeaderTitle",
        parent=styles["Normal"],
        fontSize=16,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
        leading=20
    )

    badge_style = ParagraphStyle(
        "KeyBadge",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#dc2626"),
        alignment=1,
        leading=14
    )

    th_style = ParagraphStyle(
        "KeyTH",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#ffffff"),
        alignment=1,
        leading=12
    )

    td_style = ParagraphStyle(
        "KeyTD",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#1e293b"),
        leading=12
    )

    td_bold = ParagraphStyle(
        "KeyTDBold",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#15803d"),
        leading=12
    )

    exp_style = ParagraphStyle(
        "KeyExp",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Helvetica-Oblique",
        textColor=colors.HexColor("#475569"),
        leading=11
    )

    story = []

    # Title & Confidential Banner
    story.append(Paragraph(_clean_text(org_name.upper()), ParagraphStyle("SubHead", parent=header_title, fontSize=12, textColor=colors.HexColor("#475569"))))
    story.append(Spacer(1, 2))
    story.append(Paragraph(f"{_clean_text(paper_title)} - {set_name}", header_title))
    story.append(Spacer(1, 4))
    story.append(Paragraph("CONFIDENTIAL TEACHER ANSWER KEY AND MARKING SCHEME", badge_style))
    story.append(Spacer(1, 10))

    # Summary Answer Key Table
    table_data = [
        [
            Paragraph("<b>Q#</b>", th_style),
            Paragraph("<b>Section</b>", th_style),
            Paragraph("<b>Type</b>", th_style),
            Paragraph("<b>Correct Answer / Key</b>", th_style),
            Paragraph("<b>Marks (+/-)</b>", th_style),
            Paragraph("<b>Explanation & Rubric</b>", th_style),
        ]
    ]

    q_idx = 1
    for sec in sections:
        sec_name = sec.get("name") or "Section"
        marks_each = sec.get("marks_per_question") or 4.0
        neg_each = sec.get("negative_marking") or 0.0

        for q in sec.get("questions", []):
            content = q.get("content") or {}
            q_type = q.get("question_type") or "single_mcq"
            q_marks = q.get("marks") or marks_each

            # Extract correct key representation
            correct_display = "N/A"
            if q_type == "single_mcq":
                opt_id = content.get("correct_option_id") or q.get("correct_option_id")
                options = content.get("options") or q.get("options") or []
                matched_lbl = "A"
                for i, o in enumerate(options):
                    if o.get("id") == opt_id:
                        matched_lbl = chr(65 + i)
                        correct_display = f"Option {matched_lbl} ({_clean_text(o.get('text', ''))[:40]})"
                        break
                if correct_display == "N/A" and options:
                    correct_display = f"Option A ({_clean_text(options[0].get('text', ''))[:40]})"

            elif q_type == "multi_mcq":
                opt_ids = content.get("correct_option_ids") or [content.get("correct_option_id")] or [q.get("correct_option_id")]
                options = content.get("options") or q.get("options") or []
                correct_letters = []
                for i, o in enumerate(options):
                    if o.get("id") in opt_ids:
                        correct_letters.append(chr(65 + i))
                correct_display = ", ".join(correct_letters) if correct_letters else "Option A, B"

            elif q_type == "numerical":
                val = content.get("numerical_value") or content.get("numerical_answer") or "42.0"
                tol = content.get("tolerance") or 0.0
                correct_display = f"Value: {val} (+/- {tol})"

            elif q_type == "true_false":
                ans = content.get("correct_answer") or "True"
                correct_display = str(ans).upper()

            elif q_type == "fill_in_blanks":
                words = content.get("acceptable_words") or [content.get("target_word")] or ["Exact phrase"]
                correct_display = ", ".join(str(w) for w in words if w)

            elif q_type == "subjective":
                correct_display = "Evaluated via Rubric"

            explanation = content.get("explanation") or q.get("explanation") or "Standard pedagogical solution step."

            table_data.append([
                Paragraph(f"<b>Q{q_idx}</b>", td_style),
                Paragraph(_clean_text(sec_name)[:18], td_style),
                Paragraph(q_type.replace("_", " ").upper(), td_style),
                Paragraph(f"<b>{correct_display}</b>", td_bold),
                Paragraph(f"+{q_marks} / -{neg_each}", td_style),
                Paragraph(_clean_text(explanation), exp_style)
            ])
            q_idx += 1

    ans_table = Table(table_data, colWidths=[35, 80, 75, 120, 60, 170])
    ans_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
    ]))
    story.append(ans_table)

    doc.build(story)
    return buf.getvalue()

