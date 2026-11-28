import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, OrganizationInvite, OrganizationSubject
from app.core.email import send_organization_invite_email

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def _resolve_org(db: Session, org_id: str) -> Optional[Organization]:
    """Find org by id or slug in SQLite; fall back to MongoDB hydration on cross-container miss."""
    org = db.query(Organization).filter(
        (Organization.id == org_id) | (Organization.slug == org_id)
    ).first()
    if org:
        return org
    # Cross-container miss: hydrate from MongoDB
    try:
        from app.core.mongodb import get_mongodb
        from app.core.mongo_sync import _deserialize_doc_for_model
        import app.core.mongo_sync as mongo_sync
        db_mongo = get_mongodb()
        if db_mongo is not None:
            org_doc = (
                db_mongo.organizations.find_one({"_id": str(org_id)}) or
                db_mongo.organizations.find_one({"slug": str(org_id)})
            )
            if org_doc:
                mongo_sync._hydrating_from_mongo = True
                try:
                    kw = _deserialize_doc_for_model(Organization, org_doc)
                    if kw.get("id"):
                        db.merge(Organization(**kw))
                        # Also hydrate members for this org
                        for m_doc in db_mongo.organization_members.find({"organization_id": str(kw["id"])}):
                            from app.models import OrganizationMember as OM
                            m_kw = _deserialize_doc_for_model(OM, m_doc)
                            if m_kw.get("id"):
                                db.merge(OM(**m_kw))
                        db.commit()
                finally:
                    mongo_sync._hydrating_from_mongo = False
                org = db.query(Organization).filter(Organization.id == kw.get("id", org_id)).first()
    except Exception as exc:
        db.rollback()
        print(f"Org MongoDB hydration note: {exc}")
    return org


def _resolve_org_or_404(db: Session, org_id: str, detail: str = "Organization not found") -> Organization:
    org = _resolve_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail=detail)
    return org

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

    org = _resolve_org_or_404(db, org_id, "Organization not found.")

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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)
    
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

    # Check for pre-authorized invitation for this user
    invite = db.query(OrganizationInvite).filter(
        OrganizationInvite.organization_id == org.id,
        OrganizationInvite.email == current_user.email.lower()
    ).first()
    assigned_role = invite.role if invite else "exam_author"

    # Check if already a member
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id
    ).first()

    if not membership:
        from app.plans.router import get_organization_entitlements
        entitlements_info = get_organization_entitlements(db, org.id)
        max_members = int(entitlements_info.get("entitlements", {}).get("team_members", 2))
        current_members_count = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).count()
        if current_members_count >= max_members:
            raise HTTPException(
                status_code=403,
                detail=f"Team member capacity reached for '{org.name}' (Maximum: {max_members}). Please ask the administrator to upgrade the plan in Plans & Billing."
            )
        membership = OrganizationMember(
            organization_id=org.id,
            user_id=current_user.id,
            role=assigned_role
        )
        db.add(membership)
    elif invite:
        membership.role = assigned_role

    if invite:
        invite.status = "accepted"

    db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan_id": org.plan_id or "free",
        "role": membership.role,
        "services": org.get_services(),
        "properties": org.get_properties(),
        "message": f"Successfully joined {org.name} as {membership.role}!"
    }

@router.post("/{org_id}/members")
def invite_member(
    org_id: str,
    req: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify current user is owner or admin in this org
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

    members_count = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).count()
    exams_count = db.query(Exam).filter(Exam.organization_id == org.id).count()
    questions_count = db.query(Question).filter(Question.organization_id == org.id).count()
    attempts_count = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org.id).count()
    from sqlalchemy import func
    candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
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

    # Check custom candidate capacity from properties_json
    properties = {}
    if org.properties_json:
        try:
            properties = json.loads(org.properties_json)
        except Exception:
            properties = {}
    
    max_candidates = properties.get("custom_max_candidates") or properties.get("candidate_capacity") or limits.get("max_candidates", 30)

    # Check live PlanEntitlement for ads_enabled (fallback to free/starter => True)
    from app.models import Plan, PlanEntitlement
    active_plan_id = org.plan_id or "free"
    ads_ent = db.query(PlanEntitlement).filter(
        PlanEntitlement.plan_id == active_plan_id,
        PlanEntitlement.key == "ads_enabled"
    ).first()
    if ads_ent is not None:
        ads_enabled = ads_ent.value.lower() == "true"
    else:
        ads_enabled = active_plan_id.lower() in ("free", "starter")

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "organization_slug": org.slug,
        "plan_id": active_plan_id,
        "plan_name": limits.get("name", "Free Starter"),
        "ads_enabled": ads_enabled,
        "candidates_count": candidates_count,
        "max_candidates": int(max_candidates),
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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

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
    org = _resolve_org_or_404(db, org_id)

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



@router.put("/{org_id}/capacity")
def update_candidate_capacity(
    org_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set and edit the organization's maximum candidate capacity. Strictly restricted to Super Admins."""
    from app.models import ExamEnrollment
    org = _resolve_org_or_404(db, org_id)

    # Strictly check if current user is superadmin
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=403,
            detail="Plan terms, subscription tiers, and candidate capacity quotas can strictly be modified only by platform super administrators."
        )

    new_capacity = payload.get("max_candidates") or payload.get("candidate_capacity")
    if not new_capacity or int(new_capacity) < 1:
        raise HTTPException(status_code=400, detail="Capacity must be at least 1")

    properties = {}
    if org.properties_json:
        try:
            properties = json.loads(org.properties_json)
        except Exception:
            properties = {}

    properties["custom_max_candidates"] = int(new_capacity)
    org.properties_json = json.dumps(properties)
    db.commit()

    candidates_count = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org.id).count()

    return {
        "organization_id": org.id,
        "max_candidates": int(new_capacity),
        "candidates_count": candidates_count,
        "message": f"Candidate capacity updated to {new_capacity}"
    }

@router.get("/{org_id}/candidates")
def list_organization_candidates(
    org_id: str,
    search: Optional[str] = None,
    exam_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all enrolled candidates, students, and members across the organization without duplicates."""
    from app.models import ExamEnrollment, Exam
    from app.core.mongo_sync import reconcile_org_collection_deletions
    org = _resolve_org_or_404(db, org_id)
    reconcile_org_collection_deletions(db, ExamEnrollment, org.id)

    query = db.query(
        ExamEnrollment,
        Exam.title.label("exam_title")
    ).outerjoin(
        Exam, ExamEnrollment.exam_id == Exam.id
    ).filter(
        ExamEnrollment.organization_id == org.id
    )

    if exam_id:
        query = query.filter(ExamEnrollment.exam_id == exam_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ExamEnrollment.candidate_name.ilike(search_pattern)) |
            (ExamEnrollment.candidate_email.ilike(search_pattern)) |
            (ExamEnrollment.candidate_uid.ilike(search_pattern))
        )

    results = query.order_by(ExamEnrollment.created_at.desc()).all()

    # Deduplicate candidates across enrollments: group by normalized email or candidate_uid
    grouped = {}
    for enrollment, exam_title in results:
        dedup_key = ""
        if enrollment.candidate_email and enrollment.candidate_email.strip():
            dedup_key = enrollment.candidate_email.strip().lower()
        elif enrollment.candidate_uid and enrollment.candidate_uid.strip():
            dedup_key = enrollment.candidate_uid.strip().upper()
        else:
            dedup_key = enrollment.id

        e_title = exam_title or "General Assessment"
        if dedup_key not in grouped:
            grouped[dedup_key] = {
                "id": enrollment.id,
                "candidate_uid": enrollment.candidate_uid,
                "candidate_name": enrollment.candidate_name or f"Candidate {enrollment.candidate_uid}",
                "candidate_email": enrollment.candidate_email or "",
                "access_pin_plain": enrollment.access_pin_plain,
                "exam_id": enrollment.exam_id,
                "exam_title": e_title,
                "exam_titles": [e_title],
                "enrollment_ids": [enrollment.id],
                "status": enrollment.status or "active",
                "max_attempts": enrollment.max_attempts,
                "valid_from": enrollment.valid_from.isoformat() if enrollment.valid_from else None,
                "valid_until": enrollment.valid_until.isoformat() if enrollment.valid_until else None,
                "created_at": enrollment.created_at.isoformat() if enrollment.created_at else None
            }
        else:
            # Aggregate examinations and IDs
            cand = grouped[dedup_key]
            if e_title not in cand["exam_titles"]:
                cand["exam_titles"].append(e_title)
            if enrollment.id not in cand["enrollment_ids"]:
                cand["enrollment_ids"].append(enrollment.id)
            # Update display exam_title with multi-exam badge
            total_exams = len(cand["exam_titles"])
            cand["exam_title"] = f"{cand['exam_titles'][0]} (+{total_exams - 1} more)"

    candidates = list(grouped.values())

    return {
        "organization_id": org.id,
        "total": len(candidates),
        "candidates": candidates
    }

@router.post("/{org_id}/candidates")
def add_organization_candidate(
    org_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually enroll an individual student / candidate into the organization."""
    import random
    from datetime import datetime, timezone, timedelta
    from app.models import ExamEnrollment, Exam, ExamVersion
    org = _resolve_org_or_404(db, org_id)

    caller_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id
    ).first()
    if not caller_membership and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Pick exam or first active exam
    target_exam_id = payload.get("exam_id")
    target_exam = None
    if target_exam_id:
        target_exam = db.query(Exam).filter(Exam.id == target_exam_id, Exam.organization_id == org.id).first()
    if not target_exam:
        target_exam = db.query(Exam).filter(Exam.organization_id == org.id).first()

    exam_version_id = None
    if target_exam:
        latest_ver = db.query(ExamVersion).filter(ExamVersion.exam_id == target_exam.id).order_by(ExamVersion.version_number.desc()).first()
        if latest_ver:
            exam_version_id = latest_ver.id

    candidate_name = payload.get("candidate_name") or "New Student"
    candidate_email = payload.get("candidate_email") or ""
    candidate_uid = payload.get("candidate_uid") or f"LUN-{random.randint(100000, 999999)}"
    access_pin = payload.get("access_pin") or str(random.randint(1000, 9999))

    now = datetime.now(timezone.utc)
    enrollment = ExamEnrollment(
        organization_id=org.id,
        exam_id=target_exam.id if target_exam else None,
        exam_version_id=exam_version_id,
        candidate_uid=candidate_uid,
        access_pin_plain=access_pin,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        max_attempts=int(payload.get("max_attempts") or 3),
        valid_from=now,
        valid_until=now + timedelta(days=365),
        status="active"
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    return {
        "status": "success",
        "message": f"Candidate {candidate_name} ({candidate_uid}) enrolled successfully",
        "candidate": {
            "id": enrollment.id,
            "candidate_uid": enrollment.candidate_uid,
            "candidate_name": enrollment.candidate_name,
            "candidate_email": enrollment.candidate_email,
            "access_pin_plain": enrollment.access_pin_plain,
            "exam_id": enrollment.exam_id,
            "exam_title": target_exam.title if target_exam else "General Roster",
            "status": enrollment.status
        }
    }


def cascade_delete_enrollments(db: Session, enrollment_ids: List[str]):
    """Cleanly cascade child attempts, sessions, answers, and proctoring assets before deleting enrollments."""
    if not enrollment_ids:
        return
    from app.models import (
        CandidateSession, ExamAttempt, AttemptAnswer, ProctorSession,
        ProctorEvent, EvidenceAsset, ResultRevision
    )
    from app.core.mongo_sync import delete_documents_from_mongodb
    # 1. Delete CandidateSessions
    cs_ids = [r[0] for r in db.query(CandidateSession.id).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).all()]
    db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    delete_documents_from_mongodb("candidate_sessions", cs_ids)

    # 2. Find and delete ExamAttempts and their child records
    attempts = db.query(ExamAttempt).filter(ExamAttempt.enrollment_id.in_(enrollment_ids)).all()
    att_ids = [a.id for a in attempts]
    if att_ids:
        ans_ids = [r[0] for r in db.query(AttemptAnswer.id).filter(AttemptAnswer.attempt_id.in_(att_ids)).all()]
        ps_ids = [r[0] for r in db.query(ProctorSession.id).filter(ProctorSession.attempt_id.in_(att_ids)).all()]
        rr_ids = [r[0] for r in db.query(ResultRevision.id).filter(ResultRevision.attempt_id.in_(att_ids)).all()]
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(att_ids)).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id.in_(att_ids)).delete(synchronize_session=False)
        db.query(ResultRevision).filter(ResultRevision.attempt_id.in_(att_ids)).delete(synchronize_session=False)

        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(att_ids)).all()
        ev_ids = [ev.id for ev in events]
        ea_ids = []
        if ev_ids:
            ea_ids = [r[0] for r in db.query(EvidenceAsset.id).filter(EvidenceAsset.event_id.in_(ev_ids)).all()]
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id.in_(ev_ids)).delete(synchronize_session=False)
            db.query(ProctorEvent).filter(ProctorEvent.id.in_(ev_ids)).delete(synchronize_session=False)

        db.query(ExamAttempt).filter(ExamAttempt.id.in_(att_ids)).delete(synchronize_session=False)
        delete_documents_from_mongodb("attempt_answers", ans_ids)
        delete_documents_from_mongodb("proctor_sessions", ps_ids)
        delete_documents_from_mongodb("result_revisions", rr_ids)
        delete_documents_from_mongodb("evidence_assets", ea_ids)
        delete_documents_from_mongodb("proctor_events", ev_ids)
        delete_documents_from_mongodb("exam_attempts", att_ids)


@router.delete("/{org_id}/candidates/{enrollment_id}")
def delete_organization_candidate(
    org_id: str,
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke or delete an enrolled candidate seat, freeing capacity."""
    from app.models import ExamEnrollment
    from sqlalchemy import func
    org = _resolve_org_or_404(db, org_id)

    enrollment = db.query(ExamEnrollment).filter(
        (ExamEnrollment.id == enrollment_id) | (ExamEnrollment.candidate_uid == enrollment_id),
        ExamEnrollment.organization_id == org.id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Candidate enrollment not found")

    cand_uid = enrollment.candidate_uid
    cand_email = enrollment.candidate_email

    delete_q = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org.id)
    if cand_email and cand_email.strip():
        delete_q = delete_q.filter((ExamEnrollment.candidate_uid == cand_uid) | (ExamEnrollment.candidate_email == cand_email))
    else:
        delete_q = delete_q.filter(ExamEnrollment.candidate_uid == cand_uid)

    matching_enrollments = delete_q.all()
    matching_ids = [e.id for e in matching_enrollments]
    cascade_delete_enrollments(db, matching_ids)

    deleted_count = delete_q.delete(synchronize_session=False)
    db.commit()
    from app.core.mongo_sync import delete_documents_from_mongodb
    delete_documents_from_mongodb("exam_enrollments", matching_ids)

    candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
    return {
        "status": "success",
        "message": f"Candidate seat {cand_uid} removed successfully",
        "candidate_uid": cand_uid,
        "deleted_count": deleted_count,
        "candidates_count": candidates_count
    }

class BulkDeleteCandidatesRequest(BaseModel):
    candidate_ids: List[str]


@router.post("/{org_id}/candidates/bulk-delete")
def bulk_delete_organization_candidates(
    org_id: str,
    req: BulkDeleteCandidatesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke or delete multiple candidate seats in bulk, freeing candidate capacity."""
    from app.models import ExamEnrollment
    from sqlalchemy import func, or_
    org = _resolve_org_or_404(db, org_id)

    if not req.candidate_ids:
        candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
        return {"status": "success", "deleted_count": 0, "candidates_count": candidates_count, "message": "No candidates specified"}

    # Find enrollments matching IDs or candidate_uids
    enrollments = db.query(ExamEnrollment).filter(
        (ExamEnrollment.id.in_(req.candidate_ids)) | (ExamEnrollment.candidate_uid.in_(req.candidate_ids)),
        ExamEnrollment.organization_id == org.id
    ).all()

    if not enrollments:
        candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
        return {"status": "success", "deleted_count": 0, "candidates_count": candidates_count, "message": "No matching candidates found"}

    uids = list(set(e.candidate_uid for e in enrollments if e.candidate_uid))
    emails = list(set(e.candidate_email for e in enrollments if e.candidate_email and e.candidate_email.strip()))

    filters = []
    if uids:
        filters.append(ExamEnrollment.candidate_uid.in_(uids))
    if emails:
        filters.append(ExamEnrollment.candidate_email.in_(emails))
    if req.candidate_ids:
        filters.append(ExamEnrollment.id.in_(req.candidate_ids))

    matching_enrollments = db.query(ExamEnrollment).filter(
        ExamEnrollment.organization_id == org.id,
        or_(*filters)
    ).all()
    matching_ids = [e.id for e in matching_enrollments]
    cascade_delete_enrollments(db, matching_ids)

    deleted_count = db.query(ExamEnrollment).filter(
        ExamEnrollment.id.in_(matching_ids)
    ).delete(synchronize_session=False)

    db.commit()
    from app.core.mongo_sync import delete_documents_from_mongodb
    delete_documents_from_mongodb("exam_enrollments", matching_ids)

    candidates_count = db.query(func.count(func.distinct(ExamEnrollment.candidate_uid))).filter(ExamEnrollment.organization_id == org.id).scalar() or 0
    return {
        "status": "success",
        "message": f"Successfully revoked {len(uids) or deleted_count} candidate seat(s)",
        "deleted_count": deleted_count,
        "candidates_count": candidates_count
    }


class OrgBrandingRequest(BaseModel):
    brand_logo_url: Optional[str] = ""
    brand_primary_color: Optional[str] = "#2563eb"
    brand_tagline: Optional[str] = ""


@router.get("/{org_id}/branding")
def get_organization_branding(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = _resolve_org_or_404(db, org_id)
    props = {}
    if org.properties_json:
        try:
            props = json.loads(org.properties_json)
        except Exception:
            props = {}
    return {
        "organization_id": org.id,
        "org_name": org.name,
        "brand_logo_url": props.get("brand_logo_url", ""),
        "brand_primary_color": props.get("brand_primary_color", "#2563eb"),
        "brand_tagline": props.get("brand_tagline", ""),
    }


@router.put("/{org_id}/branding")
def update_organization_branding(
    org_id: str,
    req: OrgBrandingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = _resolve_org_or_404(db, org_id)
    props = {}
    if org.properties_json:
        try:
            props = json.loads(org.properties_json)
        except Exception:
            props = {}
    props["brand_logo_url"] = (req.brand_logo_url or "").strip()
    props["brand_primary_color"] = (req.brand_primary_color or "#2563eb").strip()
    props["brand_tagline"] = (req.brand_tagline or "").strip()
    org.properties_json = json.dumps(props)
    db.commit()
    return {
        "status": "updated",
        "brand_logo_url": props["brand_logo_url"],
        "brand_primary_color": props["brand_primary_color"],
        "brand_tagline": props["brand_tagline"],
    }

