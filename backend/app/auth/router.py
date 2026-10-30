from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    decode_access_token, oauth2_scheme,
    create_user_session, revoke_user_session,
    get_current_user,
)
import json
import random
import string
from datetime import datetime, timezone, timedelta
from app.models import (
    User, OrganizationMember, Organization, UserSession, OrganizationInvite,
    Plan, PlanEntitlement, Subscription, DEFAULT_ORG_SERVICES,
    CaptchaChallenge, EmailVerificationOtp
)
from app.core.email import send_welcome_joined_org_email, send_registration_otp_email
from app.core.captcha import create_captcha_challenge, verify_captcha_challenge

router = APIRouter(prefix="/auth", tags=["Authentication"])


class CaptchaResponse(BaseModel):
    captcha_id: str
    captcha_svg: str
    expires_in_seconds: int = 300


class SendOtpRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    registration_type: Optional[str] = "create_org"  # "create_org" | "join_org"
    invite_code: Optional[str] = None
    captcha_id: str
    captcha_solution: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: Optional[str] = None
    plan_id: Optional[str] = "free"
    registration_type: Optional[str] = "create_org"  # "create_org" | "join_org"
    invite_code: Optional[str] = None
    otp_code: Optional[str] = None
    captcha_id: Optional[str] = None
    captcha_solution: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    captcha_id: Optional[str] = None
    captcha_solution: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    full_name: str
    is_superadmin: bool = False
    admin_role: Optional[str] = None
    organization_id: Optional[str] = None
    organization_slug: Optional[str] = None
    organization_name: Optional[str] = None
    plan_id: Optional[str] = "free"


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    status: str
    is_superadmin: bool = False
    admin_role: Optional[str] = None
    memberships: List[dict]


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha_challenge(db: Session = Depends(get_db)):
    """Generates a secure visual/alphanumeric SVG CAPTCHA challenge valid for 5 minutes."""
    return create_captcha_challenge(db)


@router.post("/send-verification-otp")
def send_verification_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    """
    Validates the security CAPTCHA challenge and dispatches a 6-digit OTP
    to the target email address for registration verification.
    """
    # 1. Verify CAPTCHA challenge
    verify_captcha_challenge(db, req.captcha_id, req.captcha_solution)

    # 2. Validate email availability or invitation status
    email_clean = req.email.strip().lower()

    if req.registration_type == "join_org":
        if not req.invite_code or not req.invite_code.strip():
            raise HTTPException(status_code=400, detail="Invite code is required to join an organization.")

        clean_code = req.invite_code.strip().lower().replace("org-", "")
        org = db.query(Organization).filter(
            (Organization.slug == clean_code) |
            (Organization.id == clean_code) |
            (Organization.slug == req.invite_code.strip().lower())
        ).first()

        if not org:
            raise HTTPException(status_code=404, detail="Invalid organization invite code.")

        invite = db.query(OrganizationInvite).filter(
            OrganizationInvite.organization_id == org.id,
            OrganizationInvite.email == email_clean
        ).first()

        existing_user = db.query(User).filter(User.email == email_clean).first()
        existing_membership = None
        if existing_user:
            existing_membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == existing_user.id
            ).first()

        if not invite and not existing_membership:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: The email '{req.email}' has not been invited by the owner of '{org.name}'."
            )
    else:
        existing = db.query(User).filter(User.email == email_clean).first()
        if existing and existing.password_hash != "INVITED_PLACEHOLDER":
            raise HTTPException(status_code=400, detail="This email is already registered. Please sign in.")

    # 3. Generate 6-digit numeric OTP
    otp_code = "".join(random.choices(string.digits, k=6))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=10)

    # Upsert OTP record for this email
    db.query(EmailVerificationOtp).filter(
        EmailVerificationOtp.email == email_clean,
        EmailVerificationOtp.purpose == "registration"
    ).delete(synchronize_session=False)

    otp_entry = EmailVerificationOtp(
        email=email_clean,
        otp_code=otp_code,
        purpose="registration",
        expires_at=expires_at
    )
    db.add(otp_entry)
    db.commit()

    # 4. Dispatch verification email via SMTP
    delivery = send_registration_otp_email(
        to_email=email_clean,
        otp_code=otp_code,
        full_name=req.full_name
    )

    return {
        "status": "otp_sent",
        "email": email_clean,
        "expires_in_seconds": 600,
        "delivery_status": delivery.get("status", "delivered"),
        "message": f"6-digit verification code sent to {email_clean}."
    }


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    from app.models import Subscription

    # 1. Verify CAPTCHA if provided
    if req.captcha_id and req.captcha_solution:
        verify_captcha_challenge(db, req.captcha_id, req.captcha_solution)

    # 2. Verify 6-digit email OTP
    if not req.otp_code or not req.otp_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Email verification required. Please click 'Send Verification Code' and enter the 6-digit OTP code sent to your email."
        )

    clean_otp = req.otp_code.strip()
    otp_record = db.query(EmailVerificationOtp).filter(
        EmailVerificationOtp.email == req.email.lower(),
        EmailVerificationOtp.purpose == "registration"
    ).first()

    if not otp_record:
        raise HTTPException(
            status_code=400,
            detail="No verification code found for this email. Please request a new verification code."
        )

    now = datetime.now(timezone.utc)
    exp = otp_record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired (valid 10 minutes). Please request a new verification code."
        )

    if otp_record.otp_code.strip() != clean_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid 6-digit verification code. Please check your email inbox and enter the correct code."
        )

    # Consumed OTP successfully
    db.delete(otp_record)
    db.commit()

    # MODE 1: JOIN AN EXISTING ORGANIZATION VIA INVITE CODE
    if req.registration_type == "join_org":
        if not req.invite_code or not req.invite_code.strip():
            raise HTTPException(
                status_code=400,
                detail="Organization invite code is required to join an existing organization."
            )

        clean_code = req.invite_code.strip().lower().replace("org-", "")
        org = db.query(Organization).filter(
            (Organization.slug == clean_code) |
            (Organization.id == clean_code) |
            (Organization.slug == req.invite_code.strip().lower())
        ).first()

        if not org:
            raise HTTPException(
                status_code=404,
                detail="Invalid organization invite code. Please check the code with your institution administrator."
            )

        # STRICT VERIFICATION: The registering email must be pre-authorized / invited by the organization owner!
        invite = db.query(OrganizationInvite).filter(
            OrganizationInvite.organization_id == org.id,
            OrganizationInvite.email == req.email.lower()
        ).first()

        target_user = db.query(User).filter(User.email == req.email.lower()).first()
        existing_membership = None
        if target_user:
            existing_membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == target_user.id
            ).first()

        if not invite and not existing_membership:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: The email '{req.email}' has not been invited by the owner of '{org.name}'. Please ask the organization owner to invite your email address first."
            )

        assigned_role = invite.role if invite else (existing_membership.role if existing_membership else "exam_author")

        if target_user:
            if target_user.password_hash and target_user.password_hash != "INVITED_PLACEHOLDER":
                raise HTTPException(
                    status_code=400,
                    detail="This account is already registered. Please sign in to your existing account."
                )
            target_user.password_hash = get_password_hash(req.password)
            target_user.full_name = req.full_name
            user = target_user
        else:
            user = User(
                email=req.email.lower(),
                password_hash=get_password_hash(req.password),
                full_name=req.full_name
            )
            db.add(user)
            db.flush()

        # Ensure membership is registered
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id
        ).first()
        if not member:
            member = OrganizationMember(organization_id=org.id, user_id=user.id, role=assigned_role)
            db.add(member)
        else:
            member.role = assigned_role

        if invite:
            invite.status = "accepted"

        # Dispatch welcome notification via SMTP mailer
        try:
            send_welcome_joined_org_email(
                to_email=user.email,
                org_name=org.name,
                full_name=user.full_name,
                role=member.role
            )
        except Exception:
            pass

    # MODE 2: CREATE A NEW ORGANIZATION (DEFAULT)
    else:
        existing = db.query(User).filter(User.email == req.email.lower()).first()
        if existing:
            if existing.password_hash == "INVITED_PLACEHOLDER":
                existing.password_hash = get_password_hash(req.password)
                existing.full_name = req.full_name
                user = existing
            else:
                raise HTTPException(status_code=400, detail="Email is already registered. Please sign in.")
        else:
            user = User(
                email=req.email.lower(),
                password_hash=get_password_hash(req.password),
                full_name=req.full_name
            )
            db.add(user)
            db.flush()

        org_name = req.organization_name or f"{req.full_name}'s Academy"
        # Strict Policy: Never allot a paid plan during registration without payment approval!
        # All newly registered organizations strictly start on the Free Starter tier.
        # Paid tiers (creator_pro, institution) require UPI payment submission and SuperAdmin approval.
        initial_plan = "free"

        slug = org_name.lower().replace(" ", "-")[:50]
        existing_slug = db.query(Organization).filter(Organization.slug == slug).first()
        if existing_slug:
            slug = f"{slug}-{user.id[:6]}"

        # Look up current live entitlements configured by Super Admin for the plan
        ents = db.query(PlanEntitlement).filter(PlanEntitlement.plan_id == initial_plan).all()
        ent_map = {e.key: e.value for e in ents}

        ai_credits = int(ent_map.get("ai_questions", 20))
        proctoring_enabled = ent_map.get("proctoring_enabled", "false").lower() == "true"
        proctoring_quota = int(ent_map.get("proctoring_quota", 0)) if proctoring_enabled else 0
        pdf_import_allowed = ent_map.get("pdf_import", "false").lower() == "true"

        # Initialize services according to plan entitlements
        services_dict = json.loads(DEFAULT_ORG_SERVICES) if isinstance(DEFAULT_ORG_SERVICES, str) else dict(DEFAULT_ORG_SERVICES)
        services_dict["live_proctoring"] = proctoring_enabled
        services_dict["proctor_console"] = proctoring_enabled
        services_dict["pdf_import"] = pdf_import_allowed
        services_dict["ai_quiz_generation"] = ai_credits > 0

        org = Organization(
            name=org_name,
            slug=slug,
            plan_id=initial_plan,
            ai_generation_credits=ai_credits,
            proctoring_attempts_quota=proctoring_quota,
            features_json=json.dumps(services_dict)
        )
        db.add(org)
        db.flush()

        member = OrganizationMember(organization_id=org.id, user_id=user.id, role="owner")
        db.add(member)

        sub = Subscription(organization_id=org.id, plan_id=initial_plan, status="active")
        db.add(sub)

    # Persist a revocable server-side session
    ip = request.client.host if request.client else None
    ua = request.headers.get("User-Agent")
    session_token = create_user_session(user.id, ip, ua, db)

    db.commit()

    # Embed the session_token as the JWT (token == session_token for simplicity;
    # the UserSession lookup in get_current_user validates it server-side)
    token = create_access_token(data={"sub": user.id, "email": user.email, "sid": session_token})
    # Store the JWT as the session_token so lookup works
    sess = db.query(UserSession).filter(UserSession.session_token == session_token).first()
    if sess:
        sess.session_token = token
        db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_superadmin": user.is_superadmin,
        "admin_role": getattr(user, "admin_role", "platform_admin") if user.is_superadmin else None,
        "organization_id": org.id,
        "organization_slug": org.slug,
        "organization_name": org.name,
        "plan_id": org.plan_id or "free"
    }


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Verify CAPTCHA if provided
    if req.captcha_id and req.captcha_solution:
        verify_captcha_challenge(db, req.captcha_id, req.captcha_solution)

    user = db.query(User).filter(User.email == req.email.lower()).first()
    # Generic error to prevent account enumeration
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is not active")

    membership = (
        db.query(OrganizationMember, Organization)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .filter(OrganizationMember.user_id == user.id)
        .first()
    )

    org_id = membership[1].id if membership else None
    org_slug = membership[1].slug if membership else None
    org_name = membership[1].name if membership else None
    plan_id = membership[1].plan_id if membership else "free"

    ip = request.client.host if request.client else None
    ua = request.headers.get("User-Agent")
    session_token = create_user_session(user.id, ip, ua, db)
    db.flush()

    token = create_access_token(data={"sub": user.id, "email": user.email})
    # Update the session row so the JWT itself is the lookup key
    sess = db.query(UserSession).filter(UserSession.session_token == session_token).first()
    if sess:
        sess.session_token = token
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_superadmin": user.is_superadmin,
        "admin_role": getattr(user, "admin_role", "platform_admin") if user.is_superadmin else None,
        "organization_id": org_id,
        "organization_slug": org_slug,
        "organization_name": org_name,
        "plan_id": plan_id
    }


@router.post("/logout")
def logout(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Revoke the current session server-side."""
    if token:
        revoke_user_session(token, db)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = (
        db.query(OrganizationMember, Organization)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .filter(OrganizationMember.user_id == current_user.id)
        .all()
    )
    membership_data = [
        {
            "organization_id": m.organization_id,
            "organization_name": o.name,
            "organization_slug": o.slug,
            "role": m.role
        }
        for m, o in memberships
    ]
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "status": current_user.status,
        "is_superadmin": current_user.is_superadmin,
        "admin_role": getattr(current_user, "admin_role", "platform_admin") if current_user.is_superadmin else None,
        "memberships": membership_data
    }


