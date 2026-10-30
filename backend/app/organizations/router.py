from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from app.core.database import get_db
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, OrganizationInvite
from app.core.email import send_organization_invite_email

router = APIRouter(prefix="/organizations", tags=["Organizations"])

class CreateOrgRequest(BaseModel):
    name: str

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "exam_author"  # admin, exam_author, proctor, candidate

class JoinOrgRequest(BaseModel):
    invite_code: str

@router.post("")
def create_organization(
    req: CreateOrgRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    slug = req.name.lower().replace(" ", "-")[:50]
    existing_slug = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_slug:
        slug = f"{slug}-{current_user.id[:6]}"

    org = Organization(name=req.name, slug=slug)
    db.add(org)
    db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(member)
    db.commit()

    return {"id": org.id, "name": org.name, "slug": org.slug, "role": "owner"}

@router.get("/my")
def get_my_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    results = (
        db.query(Organization, OrganizationMember.role)
        .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
        .filter(OrganizationMember.user_id == current_user.id)
        .all()
    )
    return [
        {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "status": org.status,
            "plan_id": org.plan_id or "free",
            "role": role,
            "services": org.get_services(),
            "properties": org.get_properties(),
            "ai_generation_credits": org.ai_generation_credits,
            "proctoring_quota": org.proctoring_attempts_quota
        }
        for org, role in results
    ]

@router.get("/{org_id}/services")
def get_organization_services(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "status": org.status,
        "plan_id": org.plan_id or "free",
        "services": org.get_services(),
        "properties": org.get_properties(),
        "ai_generation_credits": org.ai_generation_credits,
        "proctoring_quota": org.proctoring_attempts_quota
    }

@router.get("/{org_id}/invite-code")
def get_org_invite_code(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    code = f"ORG-{org.slug.upper()}"
    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "invite_code": code,
        "role_granted": "exam_author"
    }

@router.post("/join")
def join_organization_with_code(
    req: JoinOrgRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_code = req.invite_code.strip().lower().replace("org-", "")
    org = db.query(Organization).filter(
        (Organization.slug == clean_code) |
        (Organization.id == clean_code) |
        (Organization.slug == req.invite_code.strip().lower())
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Invalid organization invite code. Please check and try again.")

    # Check if already a member
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id
    ).first()
    if not membership:
        membership = OrganizationMember(
            organization_id=org.id,
            user_id=current_user.id,
            role="exam_author"
        )
        db.add(membership)
        db.commit()

    return {
        "message": f"Successfully joined {org.name} as {membership.role}!",
        "organization_id": org.id,
        "organization_slug": org.slug,
        "organization_name": org.name,
        "plan_id": org.plan_id or "free",
        "role": membership.role
    }

@router.post("/{org_id}/members")
def invite_member(
    org_id: str,
    req: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify current user is owner or admin in this org
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role.in_(["owner", "admin"])
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="You do not have permission to manage members for this organization")

    target_user = db.query(User).filter(User.email == req.email.lower()).first()
    if not target_user:
        # Create lightweight placeholder account for invited user
        target_user = User(
            email=req.email.lower(),
            password_hash="INVITED_PLACEHOLDER",
            full_name=req.email.split("@")[0]
        )
        db.add(target_user)
        db.flush()

    # Check existing membership
    existing_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == target_user.id
    ).first()

    if existing_member:
        existing_member.role = req.role
    else:
        new_member = OrganizationMember(
            organization_id=org.id,
            user_id=target_user.id,
            role=req.role
        )
        db.add(new_member)

    # Record or update invitation audit
    invite = db.query(OrganizationInvite).filter(
        OrganizationInvite.organization_id == org.id,
        OrganizationInvite.email == req.email.lower()
    ).first()
    if not invite:
        invite = OrganizationInvite(
            organization_id=org.id,
            email=req.email.lower(),
            role=req.role,
            invited_by_id=current_user.id,
            status="pending"
        )
        db.add(invite)
    else:
        invite.role = req.role
        invite.status = "pending"

    db.commit()
    code = f"ORG-{org.slug.upper()}"

    # Dispatch invite email via SMTP mailer
    mail_result = send_organization_invite_email(
        to_email=req.email.lower(),
        org_name=org.name,
        invite_code=code,
        inviter_name=current_user.full_name or "Organization Administrator"
    )

    return {
        "message": f"Invitation dispatched to {req.email} for role {req.role}",
        "email": req.email,
        "role": req.role,
        "invite_code": code,
        "delivery_status": mail_result.get("status", "sent")
    }

@router.get("/{org_id}/members")
def get_organization_members(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    memberships = (
        db.query(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .filter(OrganizationMember.organization_id == org.id)
        .all()
    )

    result = []
    for m, u in memberships:
        role_label = {
            "owner": "Full Platform Administration",
            "admin": "Full Platform Administration",
            "exam_author": "Exam Authoring & Question Publishing",
            "proctor": "Live Video & Event Proctoring",
            "candidate": "Candidate Examination Access"
        }.get(m.role, "Authorized Access")

        result.append({
            "id": m.id,
            "user_id": u.id,
            "name": u.full_name or u.email.split("@")[0],
            "email": u.email,
            "role": m.role,
            "status": "Active" if u.password_hash != "INVITED_PLACEHOLDER" else "Pending Activation",
            "permissions": role_label
        })
    return result

@router.get("/{org_id}/usage")
def get_organization_usage(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models import Exam, Question, ExamAttempt
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members_count = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).count()
    exams_count = db.query(Exam).filter(Exam.organization_id == org.id).count()
    questions_count = db.query(Question).filter(Question.organization_id == org.id).count()
    attempts_count = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org.id).count()

    plan_limits = {
        "starter": {"max_candidates": 50, "max_exams": 5, "proctoring_enabled": True},
        "pro": {"max_candidates": 500, "max_exams": 50, "proctoring_enabled": True},
        "enterprise": {"max_candidates": 5000, "max_exams": 500, "proctoring_enabled": True}
    }
    limits = plan_limits.get(org.plan_id, plan_limits["starter"])

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "plan_id": org.plan_id or "starter",
        "members_count": members_count,
        "exams_count": exams_count,
        "questions_count": questions_count,
        "attempts_count": attempts_count,
        "limits": limits
    }

@router.delete("/{org_id}/members/{member_id}")
def remove_member(
    org_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a team member / student from an organization workspace."""
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    caller_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role.in_(["owner", "admin"])
    ).first()
    if not caller_membership and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only owners or administrators can remove members")

    target_membership = db.query(OrganizationMember).filter(
        OrganizationMember.id == member_id,
        OrganizationMember.organization_id == org.id
    ).first()
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found in this organization")

    if target_membership.role == "owner" and target_membership.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself as organization owner")

    db.delete(target_membership)
    db.commit()
    return {"message": "Member removed successfully", "id": member_id}

