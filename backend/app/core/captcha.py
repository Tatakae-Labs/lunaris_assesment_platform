import random
import string
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import CaptchaChallenge

# Clear characters excluding visually ambiguous ones: 0/O, 1/I/L
CAPTCHA_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

def generate_captcha_svg(code: str, width: int = 160, height: int = 48) -> str:
    """
    Renders a crisp, dependency-free SVG image with distorted alphanumeric characters,
    wavy noise curves, and rotation to prevent automated scraping while maintaining
    excellent human legibility across mobile and desktop.
    """
    colors = ["#1e40af", "#4338ca", "#0369a1", "#0f766e", "#6d28d9", "#334155"]
    char_elements = []
    
    # Calculate spacing per character
    char_count = len(code)
    x_step = (width - 24) / max(1, char_count)

    for i, char in enumerate(code):
        color = random.choice(colors)
        x = 16 + (i * x_step) + random.uniform(-2, 2)
        y = (height / 2) + random.uniform(5, 8)
        rot = random.uniform(-14, 14)
        size = random.randint(22, 26)
        char_elements.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="Courier, Monaco, monospace" font-size="{size}" '
            f'font-weight="900" fill="{color}" transform="rotate({rot:.1f} {x:.1f} {y:.1f})">{char}</text>'
        )

    # Wavy background noise lines
    noise_paths = []
    for _ in range(3):
        n_color = random.choice(["#cbd5e1", "#93c5fd", "#c4b5fd", "#94a3b8"])
        y1 = random.randint(8, height - 8)
        y2 = random.randint(8, height - 8)
        cx = random.randint(30, width - 30)
        cy = random.randint(4, height - 4)
        noise_paths.append(
            f'<path d="M 0 {y1} Q {cx} {cy} {width} {y2}" stroke="{n_color}" stroke-width="1.5" fill="none" opacity="0.6"/>'
        )

    # Speckle noise dots
    dots = []
    for _ in range(12):
        dx = random.randint(4, width - 4)
        dy = random.randint(4, height - 4)
        dr = random.uniform(1.0, 2.0)
        dots.append(f'<circle cx="{dx}" cy="{dy}" r="{dr:.1f}" fill="#94a3b8" opacity="0.4"/>')

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="background:#f1f5f9;border-radius:6px;user-select:none;">
      <rect width="{width}" height="{height}" fill="#f8fafc" rx="6" stroke="#cbd5e1" stroke-width="1"/>
      {''.join(noise_paths)}
      {''.join(dots)}
      {''.join(char_elements)}
    </svg>"""
    return svg

def create_captcha_challenge(db: Session, length: int = 5) -> dict:
    """Generates and persists a single-use CAPTCHA challenge valid for 5 minutes."""
    # Clean up expired challenges
    now = datetime.now(timezone.utc)
    try:
        db.query(CaptchaChallenge).filter(CaptchaChallenge.expires_at < now).delete(synchronize_session=False)
    except Exception:
        pass

    code = "".join(random.choices(CAPTCHA_CHARSET, k=length))
    challenge = CaptchaChallenge(
        code=code,
        expires_at=now + timedelta(minutes=5)
    )
    db.add(challenge)
    db.commit()

    svg_data = generate_captcha_svg(code)
    return {
        "captcha_id": challenge.id,
        "captcha_svg": svg_data,
        "expires_in_seconds": 300
    }

def verify_captcha_challenge(db: Session, captcha_id: str, solution: str) -> bool:
    """
    Validates the submitted solution against the stored CAPTCHA challenge.
    Challenges are single-use; the challenge is deleted immediately upon check.
    Raises HTTPException 400 if missing or invalid.
    """
    if not captcha_id or not solution or not solution.strip():
        raise HTTPException(
            status_code=400,
            detail="Security CAPTCHA verification is required. Please enter the code shown in the image."
        )

    challenge = db.query(CaptchaChallenge).filter(CaptchaChallenge.id == captcha_id).first()
    if not challenge:
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA session expired. Please refresh the CAPTCHA and try again."
        )

    now = datetime.now(timezone.utc)
    # Handle timezone-aware or naive comparison
    exp = challenge.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        db.delete(challenge)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA has expired. Please refresh the code and try again."
        )

    expected = challenge.code.strip().upper()
    submitted = solution.strip().upper()

    # Always delete challenge after attempt to prevent replay attacks
    db.delete(challenge)
    db.commit()

    if expected != submitted:
        raise HTTPException(
            status_code=400,
            detail="Incorrect CAPTCHA code. Please enter the new code displayed."
        )

    return True

