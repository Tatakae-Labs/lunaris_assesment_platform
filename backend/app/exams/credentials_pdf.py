import os
import io
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

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


def generate_credentials_roster_pdf(
    exam_title: str,
    room_code: str,
    org_name: str,
    duration_minutes: int,
    enrollments: List[Dict[str, Any]],
    portal_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") + "/candidate-login"
) -> bytes:
    """
    Generates a professional examination credentials sheet and student roster PDF.
    Contains candidate login UIDs, access PINs/passwords, exam room code, and join instructions.
    """
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

    # Custom styles
    brand_style = ParagraphStyle(
        "BrandStyle",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#2563eb"),
        leading=14,
        textTransform="uppercase",
        spaceAfter=2
    )

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontSize=20,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        leading=24,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        "SubtitleStyle",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica",
        textColor=colors.HexColor("#475569"),
        leading=15,
        spaceAfter=12
    )

    instruction_header = ParagraphStyle(
        "InstHeader",
        parent=styles["Normal"],
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"),
        leading=14,
        spaceAfter=4
    )

    instruction_body = ParagraphStyle(
        "InstBody",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#334155"),
        leading=13
    )

    cell_style = ParagraphStyle(
        "CellNormal",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#1e293b"),
        leading=12
    )

    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        leading=12
    )

    cell_code = ParagraphStyle(
        "CellCode",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Courier-Bold",
        textColor=colors.HexColor("#1d4ed8"),
        leading=12
    )

    cell_pin = ParagraphStyle(
        "CellPin",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Courier-Bold",
        textColor=colors.HexColor("#b91c1c"),
        leading=12
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("LUNARIS ASSESSMENT PLATFORM • ACADEMIC PROCTORING", brand_style))
    story.append(Paragraph("Candidate Credentials & Examination Login Sheet", title_style))
    story.append(Paragraph(
        f"<b>Examination:</b> {exam_title} &nbsp;|&nbsp; <b>Academy:</b> {org_name} &nbsp;|&nbsp; <b>Duration:</b> {duration_minutes} Minutes",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=12))

    # 2. Key Metadata & Login Instructions Callout Box
    instructions_text = f"""
    <b>1. Direct Exam Entry Portal:</b> <font color="#2563eb"><u>{portal_url}</u></font><br/>
    <b>2. Exam Room Code:</b> <font color="#0f172a"><b>{room_code}</b></font><br/>
    <b>3. Instructions for Candidates:</b><br/>
    &nbsp;&nbsp;• Navigate to the portal URL on any modern browser (Chrome, Edge, Firefox, or Safari).<br/>
    &nbsp;&nbsp;• Enter your unique <b>Candidate Login UID</b> and <b>Access Password / PIN</b> listed in the roster below.<br/>
    &nbsp;&nbsp;• Complete camera & biometric identity verification if webcam proctoring is enabled, then click <b>'Start Examination'</b>.<br/>
    &nbsp;&nbsp;• Submissions and verified scores will automatically record back to the institution gradebook upon completion.
    """

    callout_data = [
        [
            Paragraph("📋 CANDIDATE JOIN INSTRUCTIONS & EXAM ACCESS DETAILS", instruction_header)
        ],
        [
            Paragraph(instructions_text, instruction_body)
        ]
    ]

    callout_table = Table(callout_data, colWidths=[540])
    callout_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
    ]))
    story.append(callout_table)
    story.append(Spacer(1, 16))

    # 3. Roster Table Header
    story.append(Paragraph(f"<b>Enrolled Candidate Login Credentials ({len(enrollments)} Candidates)</b>", instruction_header))
    story.append(Spacer(1, 6))

    table_data = [
        [
            Paragraph("<b>#</b>", cell_bold),
            Paragraph("<b>Candidate Name</b>", cell_bold),
            Paragraph("<b>Email / Classroom ID</b>", cell_bold),
            Paragraph("<b>Candidate Login UID</b>", cell_bold),
            Paragraph("<b>Access Password / PIN</b>", cell_bold),
            Paragraph("<b>Status</b>", cell_bold)
        ]
    ]

    for idx, e in enumerate(enrollments, start=1):
        name = e.get("candidate_name") or e.get("name") or f"Candidate #{idx}"
        email = e.get("candidate_email") or e.get("email") or "—"
        uid = e.get("candidate_uid") or e.get("uid") or f"LUN-{idx:05d}"
        pin = e.get("access_pin") or e.get("pin") or "—"
        status = (e.get("status") or "Active").title()

        table_data.append([
            Paragraph(str(idx), cell_style),
            Paragraph(name, cell_bold),
            Paragraph(email, cell_style),
            Paragraph(uid, cell_code),
            Paragraph(pin, cell_pin),
            Paragraph(f"<font color='#16a34a'><b>{status}</b></font>", cell_style)
        ])

    col_widths = [24, 130, 150, 96, 80, 60]
    roster_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]

    # Header cell text colors to white
    for col_idx in range(len(col_widths)):
        t_style.append(('TEXTCOLOR', (col_idx, 0), (col_idx, 0), colors.white))

    # Alternating row colors
    for r_idx in range(1, len(table_data)):
        bg_col = colors.HexColor("#ffffff") if r_idx % 2 != 0 else colors.HexColor("#f8fafc")
        t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg_col))

    roster_table.setStyle(TableStyle(t_style))
    story.append(roster_table)

    story.append(Spacer(1, 20))
    footer_text = f"Generated by Lunaris on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} • Strictly Confidential Document"
    story.append(Paragraph(footer_text, ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, fontName="Helvetica", textColor=colors.HexColor("#94a3b8"), alignment=1)))

    doc.build(story)
    return buf.getvalue()

