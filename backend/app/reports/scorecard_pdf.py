import os
import io
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget


def generate_scorecard_pdf(
    candidate_name: str,
    candidate_uid: str,
    exam_title: str,
    org_name: str,
    score_total: float,
    max_score: float,
    integrity_score: int,
    submitted_at: Optional[datetime],
    attempt_id: str,
    subject_breakdown: Optional[Dict[str, Any]] = None,
    verify_url: Optional[str] = None,
) -> bytes:
    """Generates a verified PDF Scorecard & Certificate with an embedded QR verification code."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ScorecardTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ScorecardSub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#2563eb"),
        spaceAfter=10,
    )
    normal_style = ParagraphStyle(
        "ScorecardNormal",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#334155"),
        leading=14,
    )

    frontend_base = os.getenv("FRONTEND_URL", "https://lunarisedu.tatakaelabs.tech").rstrip("/")
    qr_target = verify_url or f"{frontend_base}/verify/{attempt_id}"

    story = []
    story.append(Paragraph(f"{org_name.upper()} — OFFICIAL SCORECARD &amp; CERTIFICATE", subtitle_style))
    story.append(Paragraph(exam_title, title_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=14))

    sub_str = submitted_at.strftime("%Y-%m-%d %H:%M UTC") if submitted_at else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pct = round((score_total / max_score) * 100, 2) if max_score and max_score > 0 else 0.0

    summary_data = [
        ["Candidate Name", candidate_name or "Candidate"],
        ["Candidate UID", candidate_uid or "N/A"],
        ["Score Achieved", f"{score_total:.2f} / {max_score:.2f} ({pct}%)"],
        ["AI Integrity Score", f"{integrity_score} / 100"],
        ["Submitted At", sub_str],
        ["Verification ID", attempt_id],
    ]

    tbl = Table(summary_data, colWidths=[160, 350])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 16))

    if subject_breakdown and isinstance(subject_breakdown, dict):
        story.append(Paragraph("<b>Subject / Section Breakdown</b>", normal_style))
        story.append(Spacer(1, 6))
        sec_rows = [["Section", "Score", "Correct", "Attempted"]]
        for sec, stats in subject_breakdown.items():
            if isinstance(stats, dict):
                sec_rows.append([
                    str(sec),
                    str(stats.get("score", 0)),
                    str(stats.get("correct", 0)),
                    str(stats.get("attempted", 0)),
                ])
        if len(sec_rows) > 1:
            sec_tbl = Table(sec_rows, colWidths=[180, 110, 110, 110])
            sec_tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("PADDING", (0, 0), (-1, -1), 7),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ]
                )
            )
            story.append(sec_tbl)
            story.append(Spacer(1, 16))

    # QR Code Verification Block
    qr_widget = QrCodeWidget(qr_target)
    bounds = qr_widget.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    qr_drawing = Drawing(90, 90, transform=[90.0 / w, 0, 0, 90.0 / h, 0, 0])
    qr_drawing.add(qr_widget)

    qr_table = Table(
        [[qr_drawing, Paragraph(f"<b>Cryptographic Verification</b><br/>Scan QR code or visit:<br/>{qr_target}", normal_style)]],
        colWidths=[110, 400],
    )
    qr_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(qr_table)

    doc.build(story)
    return buffer.getvalue()
