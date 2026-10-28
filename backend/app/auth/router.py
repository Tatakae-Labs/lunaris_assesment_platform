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
from app.models import User, OrganizationMember, Organization, UserSession

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: Optional[str] = None
    plan_id: Optional[str] = "free"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    full_name: str
    is_superadmin: bool = False
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
    memberships: List[dict]


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    from app.models import Subscription
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered. Please sign in.")

    user = User(
        email=req.email.lower(),
        password_hash=get_password_hash(req.password),
        full_name=req.full_name
    )
    db.add(user)
    db.flush()

    org_name = req.organization_name or f"{req.full_name}'s Academy"
    plan_code = req.plan_id or "free"

    slug = org_name.lower().replace(" ", "-")[:50]
    existing_slug = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_slug:
        slug = f"{slug}-{user.id[:6]}"

    org = Organization(
        name=org_name,
        slug=slug,
        plan_id=plan_code,
        ai_generation_credits=2000 if plan_code == "institution" else 500 if plan_code == "creator_pro" else 20,
        proctoring_attempts_quota=500 if plan_code == "institution" else 0
    )
    db.add(org)
    db.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role="owner")
    db.add(member)

    sub = Subscription(organization_id=org.id, plan_id=plan_code, status="active")
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
        "organization_id": org.id,
        "organization_slug": org.slug,
        "organization_name": org_name,
        "plan_id": plan_code
    }


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
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
        "memberships": membership_data
    }


