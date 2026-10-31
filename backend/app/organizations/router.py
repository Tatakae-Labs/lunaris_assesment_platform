from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from app.core.database import get_db
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, OrganizationInvite, OrganizationSubject
from app.core.email import send_organization_invite_email

router = APIRouter(prefix="/organizations", tags=["Organizations"])

class CreateOrgRequest(BaseModel):
    name: str

class UpdateOrgRequest(BaseModel):
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
    base_slug = "".join(c if c.isalnum() else "-" for c in req.name.lower()).strip("-")[:45]
    if not base_slug:
        base_slug = "academy"
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(name=req.name.strip(), slug=slug, plan_id="free")
    db.add(org)
    db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(member)
    db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan_id": org.plan_id or "free",
        "role": "owner",
        "message": f"Academy '{org.name}' created successfully!"
    }


@router.put("/{org_id}")
@router.patch("/{org_id}")
def update_organization(
    org_id: str,
    req: UpdateOrgRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the organization / academy name.
    """
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Organization name cannot be empty.")

    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    if not current_user.is_superadmin:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == current_user.id
        ).first()
        if not member or member.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Only organization owners or administrators can change the organization name."
            )

    org.name = clean_name
    db.commit()
    db.refresh(org)

    return {
        "status": "success",
        "message": f"Organization name updated to '{org.name}'",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan_id": org.plan_id or "free"
        }
    }


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

    # Check plan limit for team members
    from app.plans.router import get_organization_entitlements
    entitlements_info = get_organization_entitlements(db, org.id)
    max_members = int(entitlements_info.get("entitlements", {}).get("team_members", 2))
    current_members_count = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).count()
    if current_members_count >= max_members:
        raise HTTPException(
            status_code=403,
            detail=f"Team member limit reached: Your current plan allows a maximum of {max_members} staff members (current: {current_members_count}). Please upgrade your plan in Plans & Billing to invite more faculty."
        )

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
    from app.models import Exam, Question, ExamAttempt, ExamEnrollment, ProctorSession
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members_count = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).count()
    exams_count = db.query(Exam).filter(Exam.organization_id == org.id).count()
    questions_count = db.query(Question).filter(Question.organization_id == org.id).count()
    attempts_count = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org.id).count()
    candidates_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org.id).count()
    proctoring_used = db.query(ProctorSession).join(
        ExamAttempt, ProctorSession.attempt_id == ExamAttempt.id
    ).filter(
        ExamAttempt.organization_id == org.id
    ).count()

    plan_limits = {
        "free": {
            "name": "Free Starter",
            "max_candidates": 30,
            "max_exams": 3,
            "max_members": 2,
            "max_proctoring_attempts": 5,
            "proctoring_enabled": True
        },
        "starter": {
            "name": "Free Starter",
            "max_candidates": 30,
            "max_exams": 3,
            "max_members": 2,
            "max_proctoring_attempts": 5,
            "proctoring_enabled": True
        },
        "creator_pro": {
            "name": "Creator Pro",
            "max_candidates": 250,
            "max_exams": 25,
            "max_members": 5,
            "max_proctoring_attempts": 100,
            "proctoring_enabled": True
        },
        "pro": {
            "name": "Creator Pro",
            "max_candidates": 250,
            "max_exams": 25,
            "max_members": 5,
            "max_proctoring_attempts": 100,
            "proctoring_enabled": True
        },
        "institution": {
            "name": "Institution",
            "max_candidates": 5000,
            "max_exams": 1000,
            "max_members": 50,
            "max_proctoring_attempts": 5000,
            "proctoring_enabled": True
        },
        "enterprise": {
            "name": "Institution",
            "max_candidates": 5000,
            "max_exams": 1000,
            "max_members": 50,
            "max_proctoring_attempts": 5000,
            "proctoring_enabled": True
        }
    }
    limits = plan_limits.get(org.plan_id or "free", plan_limits["free"])

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "plan_id": org.plan_id or "free",
        "plan_name": limits.get("name", "Free Starter"),
        "candidates_count": candidates_count,
        "max_candidates": limits.get("max_candidates", 30),
        "exams_count": exams_count,
        "max_exams": limits.get("max_exams", 3),
        "members_count": members_count,
        "max_members": limits.get("max_members", 2),
        "proctoring_used": proctoring_used,
        "max_proctoring_attempts": limits.get("max_proctoring_attempts", 5),
        "questions_count": questions_count,
        "attempts_count": attempts_count,
        "ai_generation_credits": org.ai_generation_credits,
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


# =====================================================================
# UNIVERSAL DOMAIN ENGINE: CUSTOM SUBJECTS & CURRICULUM MANAGEMENT
# =====================================================================

DEFAULT_SUBJECT_PRESETS = {
    "stem": [
        {"name": "Physics", "code": "PHY", "category": "STEM", "color_hex": "#2563eb", "description": "Mechanics, Electrodynamics, Optics & Modern Physics"},
        {"name": "Chemistry", "code": "CHEM", "category": "STEM", "color_hex": "#059669", "description": "Organic, Inorganic & Physical Chemistry"},
        {"name": "Mathematics", "code": "MATH", "category": "STEM", "color_hex": "#7c3aed", "description": "Calculus, Algebra, Coordinate Geometry & Vectors"},
        {"name": "Biology", "code": "BIO", "category": "STEM", "color_hex": "#dc2626", "description": "Botany, Zoology, Genetics & Cell Biology"}
    ],
    "tech": [
        {"name": "Data Structures & Algorithms", "code": "CS-DSA", "category": "Computer Science", "color_hex": "#2563eb", "description": "Arrays, Trees, Graphs, Dynamic Programming & Complexity"},
        {"name": "Web & Full-Stack Development", "code": "CS-WEB", "category": "Computer Science", "color_hex": "#0284c7", "description": "React, Node.js, REST APIs, Microservices & Frontend Architecture"},
        {"name": "Databases & System Design", "code": "CS-SYS", "category": "Computer Science", "color_hex": "#7c3aed", "description": "SQL, NoSQL, Scalability, Caching & Distributed Systems"},
        {"name": "Python & Backend Engineering", "code": "CS-PY", "category": "Computer Science", "color_hex": "#059669", "description": "Object-Oriented Programming, AsyncIO & Backend Services"}
    ],
    "medical": [
        {"name": "Human Anatomy & Histology", "code": "MED-ANAT", "category": "Medical & Health", "color_hex": "#dc2626", "description": "Gross Anatomy, Embryology, Neuroanatomy & Histological structures"},
        {"name": "Human Physiology", "code": "MED-PHYS", "category": "Medical & Health", "color_hex": "#ea580c", "description": "Cardiovascular, Respiratory, Renal & Endocrine systems"},
        {"name": "Pharmacology", "code": "MED-PHARM", "category": "Medical & Health", "color_hex": "#0284c7", "description": "Mechanism of Action, Drug Interactions & Clinical Therapeutics"},
        {"name": "Pathology & Microbiology", "code": "MED-PATH", "category": "Medical & Health", "color_hex": "#9333ea", "description": "General Pathology, Immunology, Bacteriology & Virology"}
    ],
    "law": [
        {"name": "Constitutional Law", "code": "LAW-CONST", "category": "Law & Legal Studies", "color_hex": "#b45309", "description": "Fundamental Rights, Directive Principles & Judicial Review"},
        {"name": "Law of Contracts & Torts", "code": "LAW-CONT", "category": "Law & Legal Studies", "color_hex": "#2563eb", "description": "Offer, Acceptance, Negligence, Damages & Specific Relief"},
        {"name": "Criminal Law & Procedure", "code": "LAW-CRIM", "category": "Law & Legal Studies", "color_hex": "#dc2626", "description": "Penal Code, General Exceptions, Offenses & Trial Procedure"},
        {"name": "Legal & Logical Reasoning", "code": "LAW-REAS", "category": "Law & Legal Studies", "color_hex": "#4f46e5", "description": "Analytical Reasoning, Precedents & Legal Aptitude"}
    ],
    "commerce": [
        {"name": "Financial Accounting", "code": "COM-ACC", "category": "Commerce & Finance", "color_hex": "#059669", "description": "Double Entry, Balance Sheets, Depreciation & Company Accounts"},
        {"name": "Business Studies & Management", "code": "COM-MGMT", "category": "Commerce & Finance", "color_hex": "#2563eb", "description": "Principles of Management, Marketing, HR & Organizational Behavior"},
        {"name": "Economics & Quantitative Aptitude", "code": "COM-ECON", "category": "Commerce & Finance", "color_hex": "#7c3aed", "description": "Microeconomics, Macroeconomics, Market Structures & Fiscal Policy"}
    ]
}


class SubjectCreateRequest(BaseModel):
    name: str
    code: Optional[str] = None
    category: Optional[str] = "General"
    color_hex: Optional[str] = "#2563eb"
    description: Optional[str] = None


class SubjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None


@router.get("/{org_id}/subjects")
def list_org_subjects(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all custom curriculum subjects configured for this organization.
    If none exist yet, automatically provisions starter subjects.
    """
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    subjects = db.query(OrganizationSubject).filter(
        OrganizationSubject.organization_id == org.id
    ).order_by(OrganizationSubject.name.asc()).all()

    return [
        {
            "id": s.id,
            "organization_id": s.organization_id,
            "name": s.name,
            "code": s.code,
            "category": s.category,
            "color_hex": s.color_hex,
            "description": s.description,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in subjects
    ]


@router.post("/{org_id}/subjects")
def create_org_subject(
    org_id: str,
    req: SubjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new custom subject for this organization."""
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Subject name is required.")

    # Check duplicate
    existing = db.query(OrganizationSubject).filter(
        OrganizationSubject.organization_id == org.id,
        OrganizationSubject.name.ilike(clean_name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject '{clean_name}' already exists in this organization.")

    sub = OrganizationSubject(
        organization_id=org.id,
        name=clean_name,
        code=req.code.strip().upper() if req.code else None,
        category=req.category.strip() if req.category else "General",
        color_hex=req.color_hex or "#2563eb",
        description=req.description.strip() if req.description else None
    )
    db.add(sub)
    db.commit()

    return {
        "message": f"Subject '{clean_name}' created successfully.",
        "subject": {
            "id": sub.id,
            "name": sub.name,
            "code": sub.code,
            "category": sub.category,
            "color_hex": sub.color_hex
        }
    }


@router.put("/{org_id}/subjects/{subject_id}")
def update_org_subject(
    org_id: str,
    subject_id: str,
    req: SubjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates an existing subject's name, code, category, or color."""
    sub = db.query(OrganizationSubject).filter(
        OrganizationSubject.id == subject_id,
        OrganizationSubject.organization_id == org_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    if req.name is not None and req.name.strip():
        sub.name = req.name.strip()
    if req.code is not None:
        sub.code = req.code.strip().upper() if req.code.strip() else None
    if req.category is not None:
        sub.category = req.category.strip()
    if req.color_hex is not None:
        sub.color_hex = req.color_hex
    if req.description is not None:
        sub.description = req.description.strip()

    db.commit()
    return {"message": "Subject updated successfully", "subject_id": sub.id}


@router.delete("/{org_id}/subjects/{subject_id}")
def delete_org_subject(
    org_id: str,
    subject_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a custom subject from an organization."""
    sub = db.query(OrganizationSubject).filter(
        OrganizationSubject.id == subject_id,
        OrganizationSubject.organization_id == org_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    name = sub.name
    db.delete(sub)
    db.commit()
    return {"message": f"Subject '{name}' deleted successfully."}


@router.post("/{org_id}/subjects/clear-all")
def clear_all_org_subjects(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes all subjects in an organization so the user can start completely fresh."""
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    deleted_count = db.query(OrganizationSubject).filter(
        OrganizationSubject.organization_id == org.id
    ).delete(synchronize_session=False)
    db.commit()

    return {"message": f"All {deleted_count} subjects cleared successfully.", "deleted_count": deleted_count}


@router.post("/{org_id}/subjects/seed-pack")
def seed_subject_preset_pack(
    org_id: str,
    pack_name: str,  # "tech", "medical", "law", "commerce", "stem"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Imports a curated subject curriculum pack (e.g. Computer Science, Medical, Law, Commerce, STEM).
    """
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    pack_key = pack_name.lower().strip()
    if pack_key not in DEFAULT_SUBJECT_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid preset pack '{pack_name}'. Available: {list(DEFAULT_SUBJECT_PRESETS.keys())}"
        )

    pack = DEFAULT_SUBJECT_PRESETS[pack_key]
    added = 0
    for p in pack:
        exists = db.query(OrganizationSubject).filter(
            OrganizationSubject.organization_id == org.id,
            OrganizationSubject.name.ilike(p["name"])
        ).first()
        if not exists:
            s_obj = OrganizationSubject(
                organization_id=org.id,
                name=p["name"],
                code=p["code"],
                category=p["category"],
                color_hex=p["color_hex"],
                description=p["description"]
            )
            db.add(s_obj)
            added += 1

    db.commit()
    return {
        "message": f"Imported {added} subjects from the '{pack_key.title()}' curriculum pack.",
        "added_count": added
    }

