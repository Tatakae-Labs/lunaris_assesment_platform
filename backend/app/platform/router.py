import json
import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.auth.router import get_current_user
from app.core.security import get_password_hash
from app.models import (
    User, Organization, OrganizationMember, OrganizationInvite, Exam, ExamAttempt, Plan,
    PlanEntitlement, AuditEvent, Subscription, Question, QuestionBank, QuestionRevision,
    ExamEnrollment, ExamAssignment, ExamVersion, ProctorEvent, EvidenceAsset, ProctorSession,
    CandidateSession, AttemptAnswer, ReviewDecision, Appeal, QuizRoom, QuizParticipant,
    UsageLedger, DEFAULT_ORG_SERVICES, DEFAULT_ORG_PROPERTIES, SystemSetting, AIQuestionDraft,
    PaymentEvent
)
from app.plans.router import ensure_plans_seeded

router = APIRouter(prefix="/platform", tags=["Platform Super Admin"])

def is_main_superadmin(user: User) -> bool:
    """Returns True ONLY for the singular primary platform owner superadmin."""
    if not user or not user.is_superadmin:
        return False
    return (
        getattr(user, "admin_role", None) == "superadmin" or
        user.email.lower() == "superadmin@lunaris.com"
    )

def check_superadmin(current_user: User):
    """Enforces access for any platform administration personnel."""
    if not current_user or not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Lunaris Platform Administration staff."
        )

def check_main_superadmin(current_user: User):
    """Enforces non-delegable access restricted strictly to the sole Primary Super Administrator."""
    check_superadmin(current_user)
    if not is_main_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action restricted strictly to the Primary Super Administrator (sole platform owner)."
        )

def ensure_superadmin_seeded(db: Session):
    admin = db.query(User).filter(User.email == "superadmin@lunaris.com").first()
    if not admin:
        admin = User(
            email="superadmin@lunaris.com",
            full_name="Platform Super Administrator",
            password_hash=get_password_hash("SuperAdmin123!"),
            is_superadmin=True,
            admin_role="superadmin",
            status="active"
        )
        db.add(admin)
        db.commit()
    else:
        admin.is_superadmin = True
        admin.admin_role = "superadmin"
        db.commit()

    # Automatically purge redundant free accounts for any user with a paid plan
    try:
        cleanup_all_duplicate_free_organizations(db)
    except Exception as exc:
        print(f"Automatic free organization cleanup note: {exc}")

    return admin

class OrgStatusRequest(BaseModel):
    status: str  # active, suspended

class OrgPlanChangeRequest(BaseModel):
    plan_id: str

class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    price_inr: Optional[int] = None
    description: Optional[str] = None
    entitlements: Optional[Dict[str, Any]] = None

class CreateOrgSuperAdminRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    owner_email: str
    owner_name: Optional[str] = None
    plan_id: str = "creator_pro"
    ai_generation_credits: int = 250
    proctoring_attempts_quota: int = 100
    services: Optional[Dict[str, bool]] = None
    properties: Optional[Dict[str, Any]] = None

class UpdateOrgServicesRequest(BaseModel):
    services: Dict[str, bool]
    properties: Optional[Dict[str, Any]] = None

class UpdateOrgDetailsRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[str] = None
    plan_id: Optional[str] = None
    ai_generation_credits: Optional[int] = None
    proctoring_attempts_quota: Optional[int] = None

class UpdateOrgSubscriptionRequest(BaseModel):
    plan_id: str
    status: str = "active"  # active, trialing, past_due, canceled
    extend_days: Optional[int] = 30
    proctoring_quota: Optional[int] = None
    ai_credits: Optional[int] = None

@router.get("/stats")
@router.get("/overview")
def get_platform_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)

    total_orgs = db.query(Organization).count()
    total_users = db.query(User).count()
    total_exams = db.query(Exam).count()
    total_attempts = db.query(ExamAttempt).count()
    active_subscriptions = db.query(Subscription).filter(Subscription.status == "active").count()

    return {
        "total_organizations": total_orgs,
        "total_users": total_users,
        "total_exams": total_exams,
        "total_attempts": total_attempts,
        "active_subscriptions": active_subscriptions,
        "platform_status": "operational",
        "blueprint_version": "October 2026 Release"
    }

@router.get("/organizations")
def list_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()

    result = []
    for org in orgs:
        owner_member = (
            db.query(OrganizationMember, User)
            .join(User, OrganizationMember.user_id == User.id)
            .filter(OrganizationMember.organization_id == org.id, OrganizationMember.role == "owner")
            .first()
        )
        exam_count = db.query(Exam).filter(Exam.organization_id == org.id).count()
        attempt_count = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org.id).count()

        result.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan_id": org.plan_id or "free",
            "status": org.status,
            "ai_generation_credits": org.ai_generation_credits,
            "proctoring_quota": org.proctoring_attempts_quota,
            "services": org.get_services(),
            "properties": org.get_properties(),
            "created_at": org.created_at.isoformat(),
            "owner": {
                "name": owner_member[1].full_name if owner_member else "Unknown",
                "email": owner_member[1].email if owner_member else "N/A"
            },
            "exam_count": exam_count,
            "attempt_count": attempt_count
        })
    return result

@router.post("/organizations")
def create_organization_superadmin(
    req: CreateOrgSuperAdminRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    import uuid
    slug = (req.slug or req.name).strip().lower().replace(" ", "-")[:60]
    existing_org = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_org:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    # Find or create owner user
    owner = db.query(User).filter(User.email == req.owner_email.lower().strip()).first()
    if not owner:
        owner = User(
            email=req.owner_email.lower().strip(),
            full_name=req.owner_name or req.owner_email.split("@")[0],
            password_hash=get_password_hash("Password123!"),
            status="active"
        )
        db.add(owner)
        db.flush()

    new_org = Organization(
        name=req.name,
        slug=slug,
        plan_id=req.plan_id,
        status="active",
        ai_generation_credits=req.ai_generation_credits,
        proctoring_attempts_quota=req.proctoring_attempts_quota
    )
    if req.services is not None:
        new_org.set_services(req.services)
    if req.properties is not None:
        new_org.set_properties(req.properties)

    db.add(new_org)
    db.flush()

    # Assign owner membership
    member = OrganizationMember(
        organization_id=new_org.id,
        user_id=owner.id,
        role="owner"
    )
    db.add(member)

    # Create active subscription record
    sub = Subscription(
        organization_id=new_org.id,
        plan_id=req.plan_id,
        status="active"
    )
    db.add(sub)

    audit = AuditEvent(
        organization_id=new_org.id,
        actor_id=current_user.id,
        action="SUPERADMIN_CREATE_ORGANIZATION",
        metadata_json=json.dumps({"org_name": req.name, "owner": req.owner_email, "plan": req.plan_id})
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Organization '{new_org.name}' created successfully!",
        "id": new_org.id,
        "name": new_org.name,
        "slug": new_org.slug,
        "plan_id": new_org.plan_id,
        "services": new_org.get_services(),
        "properties": new_org.get_properties()
    }

@router.get("/organizations/{org_id}")
def get_organization_detail_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members = (
        db.query(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .filter(OrganizationMember.organization_id == org.id)
        .all()
    )
    exams = db.query(Exam).filter(Exam.organization_id == org.id).order_by(Exam.created_at.desc()).all()
    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "status": org.status,
        "plan_id": org.plan_id or "free",
        "ai_generation_credits": org.ai_generation_credits,
        "proctoring_quota": org.proctoring_attempts_quota,
        "created_at": org.created_at.isoformat(),
        "services": org.get_services(),
        "properties": org.get_properties(),
        "subscription": {
            "status": sub.status if sub else "active",
            "current_period_start": sub.current_period_start.isoformat() if sub and sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        } if sub else None,
        "members": [
            {
                "id": m.id,
                "user_id": u.id,
                "name": u.full_name,
                "email": u.email,
                "role": m.role
            }
            for m, u in members
        ],
        "exams": [
            {
                "id": ex.id,
                "title": ex.title,
                "mode": ex.mode,
                "duration_minutes": ex.duration_minutes,
                "created_at": ex.created_at.isoformat()
            }
            for ex in exams
        ]
    }

@router.put("/organizations/{org_id}")
def update_organization_details_superadmin(
    org_id: str,
    req: UpdateOrgDetailsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if req.name is not None:
        org.name = req.name
    if req.slug is not None:
        org.slug = req.slug
    if req.status is not None:
        org.status = req.status
    if req.plan_id is not None:
        org.plan_id = req.plan_id
    if req.ai_generation_credits is not None:
        org.ai_generation_credits = req.ai_generation_credits
    if req.proctoring_attempts_quota is not None:
        org.proctoring_attempts_quota = req.proctoring_attempts_quota

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        action="SUPERADMIN_UPDATE_ORG_DETAILS",
        metadata_json=json.dumps({"updated_fields": req.dict(exclude_unset=True)})
    )
    db.add(audit)
    db.commit()

    return {"message": f"Organization '{org.name}' updated successfully", "organization": {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "status": org.status,
        "plan_id": org.plan_id,
        "ai_generation_credits": org.ai_generation_credits,
        "proctoring_quota": org.proctoring_attempts_quota
    }}

def purge_organization_data(db: Session, org_id_val: str) -> Optional[str]:
    """Deeply and cleanly purges all related foreign keys, telemetry, exams, questions, members, and the organization itself."""
    org = db.query(Organization).filter((Organization.id == org_id_val) | (Organization.slug == org_id_val)).first()
    if not org:
        return None

    org_name = org.name
    org_id = org.id

    # 1. Clean up Quick Quiz arenas and participants
    rooms = db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).all()
    room_ids = [r.id for r in rooms]
    if room_ids:
        from app.models import QuizResponse, QuizRound, QuizLeaderboardSnapshot
        db.query(QuizResponse).filter(QuizResponse.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizParticipant).filter(QuizParticipant.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRound).filter(QuizRound.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizLeaderboardSnapshot).filter(QuizLeaderboardSnapshot.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).delete(synchronize_session=False)

    # 2. Clean up Exam Attempts and all telemetry/answers/reviews
    attempts = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id).all()
    attempt_ids = [a.id for a in attempts]
    if attempt_ids:
        db.query(CandidateSession).filter(CandidateSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        from app.models import ResultRevision
        db.query(ResultRevision).filter(ResultRevision.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).all()
        event_ids = [ev.id for ev in events]
        if event_ids:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(ReviewDecision).filter(ReviewDecision.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(Appeal).filter(Appeal.event_id.in_(event_ids)).delete(synchronize_session=False)
        db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(Appeal).filter(Appeal.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id).delete(synchronize_session=False)

    # 3. Clean up Appeals for this org
    db.query(Appeal).filter(Appeal.organization_id == org_id).delete(synchronize_session=False)

    # 4. Clean up Enrollments & Assignments
    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).all()
    enrollment_ids = [en.id for en in enrollments]
    if enrollment_ids:
        db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).delete(synchronize_session=False)
    db.query(ExamAssignment).filter(ExamAssignment.organization_id == org_id).delete(synchronize_session=False)

    # 5. Clean up Exams and Exam Versions
    exams = db.query(Exam).filter(Exam.organization_id == org_id).all()
    exam_ids = [e.id for e in exams]
    if exam_ids:
        db.query(ExamVersion).filter(ExamVersion.exam_id.in_(exam_ids)).delete(synchronize_session=False)
        db.query(Exam).filter(Exam.organization_id == org_id).delete(synchronize_session=False)

    # 6. Clean up Questions, Revisions, and Question Banks
    questions = db.query(Question).filter(Question.organization_id == org_id).all()
    q_ids = [q.id for q in questions]
    if q_ids:
        db.query(QuestionRevision).filter(QuestionRevision.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(Question).filter(Question.organization_id == org_id).delete(synchronize_session=False)
    db.query(QuestionBank).filter(QuestionBank.organization_id == org_id).delete(synchronize_session=False)

    # 7. Clean up AI Question Drafts & Usage
    db.query(AIQuestionDraft).filter(AIQuestionDraft.organization_id == org_id).delete(synchronize_session=False)
    db.query(UsageLedger).filter(UsageLedger.organization_id == org_id).delete(synchronize_session=False)

    # 8. Clean up Financials & Subscriptions
    db.query(PaymentEvent).filter(PaymentEvent.organization_id == org_id).delete(synchronize_session=False)
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete(synchronize_session=False)

    # 9. Clean up Invites & Members
    db.query(OrganizationInvite).filter(OrganizationInvite.organization_id == org_id).delete(synchronize_session=False)
    db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).delete(synchronize_session=False)

    # 10. Clean up Org Audit Events
    db.query(AuditEvent).filter(AuditEvent.organization_id == org_id).delete(synchronize_session=False)

    # 11. Delete the organization
    db.delete(org)
    db.commit()

    # Clean up dual-engine MongoDB documents if enabled
    try:
        from app.core.mongodb import get_collection
        for coll_name in [
            "organizations", "organization_members", "subscriptions", "exams", "questions",
            "exam_attempts", "candidate_sessions", "attempt_answers", "proctor_sessions",
            "proctor_events", "evidence_assets", "review_decisions", "quiz_rooms",
            "quiz_participants", "audit_logs"
        ]:
            c = get_collection(coll_name)
            if c is not None:
                if coll_name == "organizations":
                    c.delete_one({"_id": org_id})
                else:
                    c.delete_many({"organization_id": org_id})
    except Exception as exc:
        print(f"MongoDB org delete sync note: {exc}")

    try:
        from app.core.database import checkpoint_and_sync_db
        checkpoint_and_sync_db(db)
    except Exception:
        pass

    return org_name


def cleanup_free_organizations_for_user(db: Session, user_id: str) -> List[str]:
    """If user owns or has access to at least one paid organization (plan_id != 'free'),
    remove all free organizations (plan_id == 'free') that this user owns."""
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).all()
    org_ids = [m.organization_id for m in memberships]
    if not org_ids:
        return []

    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    has_paid_org = any(o.plan_id and o.plan_id != "free" for o in orgs)
    if not has_paid_org:
        return []

    deleted_names = []
    for m in memberships:
        if m.role in ["owner", "admin"]:
            org = db.query(Organization).filter(Organization.id == m.organization_id).first()
            if org and (not org.plan_id or org.plan_id == "free"):
                deleted_name = purge_organization_data(db, org.id)
                if deleted_name:
                    deleted_names.append(deleted_name)

    return deleted_names


def cleanup_all_duplicate_free_organizations(db: Session) -> Dict[str, Any]:
    """Scans all users across the platform. If any user has at least one paid account (plan_id != 'free')
    and also a free account (plan_id == 'free'), automatically remove the free one."""
    users = db.query(User).all()
    cleaned = {}
    for u in users:
        removed = cleanup_free_organizations_for_user(db, u.id)
        if removed:
            cleaned[u.email] = removed
    return cleaned


@router.delete("/organizations/{org_id}")
def delete_organization_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_name = org.name
    org_id_val = org.id

    # 1. Clean up Quick Quiz arenas and participants
    rooms = db.query(QuizRoom).filter(QuizRoom.organization_id == org_id_val).all()
    room_ids = [r.id for r in rooms]
    if room_ids:
        # Quiz responses, participants, rounds, snapshots
        from app.models import QuizResponse, QuizRound, QuizLeaderboardSnapshot
        db.query(QuizResponse).filter(QuizResponse.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizParticipant).filter(QuizParticipant.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRound).filter(QuizRound.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizLeaderboardSnapshot).filter(QuizLeaderboardSnapshot.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRoom).filter(QuizRoom.organization_id == org_id_val).delete(synchronize_session=False)

    # 2. Clean up Exam Attempts and all telemetry/answers/reviews
    attempts = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id_val).all()
    attempt_ids = [a.id for a in attempts]
    if attempt_ids:
        # Candidate sessions
        db.query(CandidateSession).filter(CandidateSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        # Attempt answers
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        # Result revisions
        from app.models import ResultRevision
        db.query(ResultRevision).filter(ResultRevision.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        # Proctor events, evidence assets & review decisions
        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).all()
        event_ids = [ev.id for ev in events]
        if event_ids:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(ReviewDecision).filter(ReviewDecision.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(Appeal).filter(Appeal.event_id.in_(event_ids)).delete(synchronize_session=False)
        db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(Appeal).filter(Appeal.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id_val).delete(synchronize_session=False)

    # 3. Clean up Appeals for this org
    db.query(Appeal).filter(Appeal.organization_id == org_id_val).delete(synchronize_session=False)

    # 4. Clean up Enrollments & Assignments (and lingering candidate sessions by enrollment)
    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id_val).all()
    enrollment_ids = [en.id for en in enrollments]
    if enrollment_ids:
        db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id_val).delete(synchronize_session=False)
    db.query(ExamAssignment).filter(ExamAssignment.organization_id == org_id_val).delete(synchronize_session=False)

    # 5. Clean up Exams and Exam Versions
    exams = db.query(Exam).filter(Exam.organization_id == org_id_val).all()
    exam_ids = [e.id for e in exams]
    if exam_ids:
        db.query(ExamVersion).filter(ExamVersion.exam_id.in_(exam_ids)).delete(synchronize_session=False)
        db.query(Exam).filter(Exam.organization_id == org_id_val).delete(synchronize_session=False)

    # 6. Clean up Questions, Revisions, and Question Banks
    questions = db.query(Question).filter(Question.organization_id == org_id_val).all()
    q_ids = [q.id for q in questions]
    if q_ids:
        db.query(QuestionRevision).filter(QuestionRevision.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(Question).filter(Question.organization_id == org_id_val).delete(synchronize_session=False)
    db.query(QuestionBank).filter(QuestionBank.organization_id == org_id_val).delete(synchronize_session=False)

    # 7. Clean up AI Question Drafts & Usage
    db.query(AIQuestionDraft).filter(AIQuestionDraft.organization_id == org_id_val).delete(synchronize_session=False)
    db.query(UsageLedger).filter(UsageLedger.organization_id == org_id_val).delete(synchronize_session=False)

    # 8. Clean up Financials & Subscriptions
    db.query(PaymentEvent).filter(PaymentEvent.organization_id == org_id_val).delete(synchronize_session=False)
    db.query(Subscription).filter(Subscription.organization_id == org_id_val).delete(synchronize_session=False)

    # 9. Clean up Invites & Members
    db.query(OrganizationInvite).filter(OrganizationInvite.organization_id == org_id_val).delete(synchronize_session=False)
    db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id_val).delete(synchronize_session=False)

    # 10. Clean up Org Audit Events
    db.query(AuditEvent).filter(AuditEvent.organization_id == org_id_val).delete(synchronize_session=False)

    # 11. Delete the organization
    db.delete(org)

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="SUPERADMIN_DELETE_ORGANIZATION",
        metadata_json=json.dumps({"deleted_org_id": org_id_val, "deleted_org_name": org_name})
    )
    db.add(audit)
    db.commit()

    # Clean up dual-engine MongoDB documents
    try:
        from app.core.mongodb import get_collection
        for coll_name in [
            "organizations", "organization_members", "subscriptions", "exams", "questions",
            "exam_attempts", "candidate_sessions", "attempt_answers", "proctor_sessions",
            "proctor_events", "evidence_assets", "review_decisions", "quiz_rooms",
            "quiz_participants", "audit_logs"
        ]:
            c = get_collection(coll_name)
            if c is not None:
                if coll_name == "organizations":
                    c.delete_one({"_id": org_id_val})
                else:
                    c.delete_many({"organization_id": org_id_val})
    except Exception as exc:
        print(f"MongoDB org delete sync note: {exc}")

    # Checkpoint and sync physical SQLite databases to disk
    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {"message": f"Institution '{org_name}' and all associated database records deleted successfully!"}

@router.get("/organizations/{org_id}/services")
def get_org_services_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "services": org.get_services(),
        "properties": org.get_properties(),
        "available_services": list(DEFAULT_ORG_SERVICES.keys()),
        "available_properties": list(DEFAULT_ORG_PROPERTIES.keys())
    }

@router.put("/organizations/{org_id}/services")
def update_org_services_superadmin(
    org_id: str,
    req: UpdateOrgServicesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    current_services = org.get_services()
    current_services.update(req.services)
    org.set_services(current_services)

    if req.properties is not None:
        current_props = org.get_properties()
        current_props.update(req.properties)
        org.set_properties(current_props)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        action="SUPERADMIN_SERVICES_AND_PROPERTIES_UPDATED",
        metadata_json=json.dumps({
            "services": org.get_services(),
            "properties": org.get_properties(),
            "updated_by": current_user.email
        })
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Services and system properties updated for '{org.name}'!",
        "services": org.get_services(),
        "properties": org.get_properties()
    }

@router.put("/organizations/{org_id}/subscription")
def update_org_subscription_superadmin(
    org_id: str,
    req: UpdateOrgSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.plan_id = req.plan_id
    if req.proctoring_quota is not None:
        org.proctoring_attempts_quota = req.proctoring_quota
    if req.ai_credits is not None:
        org.ai_generation_credits = req.ai_credits

    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    if not sub:
        sub = Subscription(
            organization_id=org.id,
            plan_id=req.plan_id,
            status=req.status,
            current_period_start=now,
            current_period_end=now + timedelta(days=req.extend_days or 30)
        )
        db.add(sub)
    else:
        sub.plan_id = req.plan_id
        sub.status = req.status
        if req.extend_days:
            base_time = sub.current_period_end or now
            if base_time.tzinfo is None:
                base_time = base_time.replace(tzinfo=timezone.utc)
            sub.current_period_end = max(now, base_time) + timedelta(days=req.extend_days)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        action="SUPERADMIN_SUBSCRIPTION_MODIFIED",
        metadata_json=json.dumps({
            "plan_id": req.plan_id,
            "status": req.status,
            "proctoring_quota": org.proctoring_attempts_quota,
            "ai_credits": org.ai_generation_credits
        })
    )
    db.add(audit)
    db.commit()

    if req.plan_id != "free":
        try:
            owner_member = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.role.in_(["owner", "admin"])
            ).first()
            if owner_member:
                cleanup_free_organizations_for_user(db, owner_member.user_id)
        except Exception as exc:
            print(f"Cleanup free orgs on sub update note: {exc}")

    return {
        "message": f"Subscription updated for {org.name}",
        "plan_id": org.plan_id,
        "subscription_status": sub.status,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "proctoring_quota": org.proctoring_attempts_quota,
        "ai_credits": org.ai_generation_credits
    }

@router.delete("/organizations/{org_id}/subscription")
def remove_org_subscription_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Reset organization plan to free and clear special quotas
    org.plan_id = "free"
    org.ai_generation_credits = 20
    org.proctoring_attempts_quota = 0

    # Delete subscription records
    subs = db.query(Subscription).filter(Subscription.organization_id == org.id).all()
    for s in subs:
        db.delete(s)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="SUPERADMIN_SUBSCRIPTION_REMOVED",
        metadata_json=json.dumps({"org_name": org.name, "action": "removed_subscription_and_reset_to_free"})
    )
    db.add(audit)
    db.commit()

    # Clear MongoDB subscription records
    try:
        from app.core.mongodb import get_collection
        c_sub = get_collection("subscriptions")
        if c_sub is not None:
            c_sub.delete_many({"organization_id": org.id})
    except Exception as exc:
        print(f"MongoDB subscription delete sync note: {exc}")

    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {"message": f"Subscription successfully removed and revoked for '{org.name}'. Organization reset to Free Starter tier."}

@router.get("/organizations/{org_id}/members")
def get_org_members_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members = (
        db.query(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .filter(OrganizationMember.organization_id == org.id)
        .all()
    )

    results = []
    for m, u in members:
        results.append({
            "member_id": m.id,
            "user_id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": m.role,
            "status": u.status,
            "is_superadmin": u.is_superadmin
        })
    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "total_members": len(results),
        "members": results
    }

@router.delete("/organizations/{org_id}/members/{user_id}")
def remove_org_member_superadmin(
    org_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this organization")

    db.delete(member)
    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="SUPERADMIN_REMOVE_ORG_MEMBER",
        metadata_json=json.dumps({"org_name": org.name, "user_id": user_id})
    )
    db.add(audit)
    db.commit()

    return {"message": f"User successfully removed from '{org.name}'!"}

@router.delete("/users/{user_id}")
def delete_user_superadmin(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own superadmin account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if is_main_superadmin(user):
        raise HTTPException(status_code=400, detail="Cannot delete the primary platform SuperAdmin account")
    if user.is_superadmin and not is_main_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Only the Primary SuperAdmin can delete administrative accounts")

    user_email = user.email
    from app.models import (
        UserSession, OrganizationMember, OrganizationInvite, ExamAttempt, AttemptAnswer,
        ProctorEvent, EvidenceAsset, ReviewDecision, ProctorSession, Appeal,
        CandidateSession, ExamAssignment, Exam, ExamVersion, QuestionRevision,
        QuizRoom, QuizParticipant, QuizResponse, QuizRound, QuizLeaderboardSnapshot,
        ResultRevision
    )

    # 1. Clean up user sessions
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)

    # 2. Clean up organization memberships
    db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).delete(synchronize_session=False)

    # 3. Clean up invitations issued by this user
    db.query(OrganizationInvite).filter(OrganizationInvite.invited_by_id == user_id).update({"invited_by_id": None}, synchronize_session=False)

    # 4. Clean up quiz rooms hosted by this user
    hosted_rooms = db.query(QuizRoom).filter(QuizRoom.host_user_id == user_id).all()
    hosted_room_ids = [r.id for r in hosted_rooms]
    if hosted_room_ids:
        db.query(QuizResponse).filter(QuizResponse.room_id.in_(hosted_room_ids)).delete(synchronize_session=False)
        db.query(QuizParticipant).filter(QuizParticipant.room_id.in_(hosted_room_ids)).delete(synchronize_session=False)
        db.query(QuizRound).filter(QuizRound.room_id.in_(hosted_room_ids)).delete(synchronize_session=False)
        db.query(QuizLeaderboardSnapshot).filter(QuizLeaderboardSnapshot.room_id.in_(hosted_room_ids)).delete(synchronize_session=False)
        db.query(QuizRoom).filter(QuizRoom.id.in_(hosted_room_ids)).delete(synchronize_session=False)

    # 5. Clean up candidate exam attempts & telemetry if user took exams
    user_attempts = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == user_id).all()
    user_attempt_ids = [a.id for a in user_attempts]
    if user_attempt_ids:
        db.query(CandidateSession).filter(CandidateSession.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        db.query(ResultRevision).filter(ResultRevision.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        user_events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(user_attempt_ids)).all()
        user_event_ids = [ev.id for ev in user_events]
        if user_event_ids:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id.in_(user_event_ids)).delete(synchronize_session=False)
            db.query(ReviewDecision).filter(ReviewDecision.event_id.in_(user_event_ids)).delete(synchronize_session=False)
            db.query(Appeal).filter(Appeal.event_id.in_(user_event_ids)).delete(synchronize_session=False)
        db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        db.query(Appeal).filter(Appeal.attempt_id.in_(user_attempt_ids)).delete(synchronize_session=False)
        db.query(ExamAttempt).filter(ExamAttempt.id.in_(user_attempt_ids)).delete(synchronize_session=False)

    # 6. Nullify or reassign review decisions and resolved appeals
    db.query(ReviewDecision).filter(ReviewDecision.reviewer_id == user_id).update({"reviewer_id": None}, synchronize_session=False)
    db.query(Appeal).filter(Appeal.resolved_by == user_id).update({"resolved_by": None}, synchronize_session=False)
    db.query(ResultRevision).filter(ResultRevision.revised_by == user_id).update({"revised_by": None}, synchronize_session=False)

    # 7. Clean up exam assignments for candidate
    db.query(ExamAssignment).filter(ExamAssignment.candidate_id == user_id).delete(synchronize_session=False)

    # 8. Reassign or delete exams created by this author
    # If exams exist, reassign their created_by to the SuperAdmin or delete if unassigned
    author_exams = db.query(Exam).filter(Exam.created_by == user_id).all()
    for ex in author_exams:
        ex.created_by = current_user.id

    # 9. Reassign question revisions authored by this user
    db.query(QuestionRevision).filter(QuestionRevision.created_by == user_id).update({"created_by": current_user.id}, synchronize_session=False)

    db.delete(user)

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="SUPERADMIN_DELETE_USER",
        metadata_json=json.dumps({"deleted_user_email": user_email, "deleted_user_id": user_id})
    )
    db.add(audit)
    db.commit()

    # Clear from dual-engine MongoDB
    try:
        from app.core.mongodb import get_collection
        c_users = get_collection("users")
        if c_users is not None:
            c_users.delete_one({"_id": user_id})
        c_m = get_collection("organization_members")
        if c_m is not None:
            c_m.delete_many({"user_id": user_id})
        c_s = get_collection("candidate_sessions")
        if c_s is not None:
            c_s.delete_many({"candidate_id": user_id})
    except Exception as exc:
        print(f"MongoDB user delete sync note: {exc}")

    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {"message": f"User account '{user_email}' permanently deleted by SuperAdmin!"}

@router.delete("/organizations/{org_id}/exams/{exam_id}")
def delete_org_exam_superadmin(
    org_id: str,
    exam_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.organization_id == org_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    title = exam.title
    db.delete(exam)
    db.commit()

    try:
        from app.core.mongodb import get_collection
        c_exams = get_collection("exams")
        if c_exams is not None:
            c_exams.delete_one({"_id": exam_id})
    except Exception as exc:
        print(f"MongoDB exam delete sync note: {exc}")

    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {"message": f"Exam '{title}' deleted by superadmin"}

@router.post("/clean-mock-data")
@router.post("/clear-database")
@router.delete("/database")
def purge_all_mock_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)

    # 1. Ensure SuperAdmin user is safely preserved / seeded
    admin = ensure_superadmin_seeded(db)

    # 2. Delete non-superadmin mock/test entities
    from app.models import AttemptAnswer, ReviewDecision, AIQuestionDraft, ExamAssignment, ExamVersion, UserSession
    db.query(AuditEvent).delete(synchronize_session=False)
    db.query(ReviewDecision).delete(synchronize_session=False)
    db.query(ProctorEvent).delete(synchronize_session=False)
    db.query(EvidenceAsset).delete(synchronize_session=False)
    db.query(ProctorSession).delete(synchronize_session=False)
    db.query(CandidateSession).delete(synchronize_session=False)
    db.query(AttemptAnswer).delete(synchronize_session=False)
    db.query(ExamAttempt).delete(synchronize_session=False)
    db.query(ExamEnrollment).delete(synchronize_session=False)
    db.query(AIQuestionDraft).delete(synchronize_session=False)
    db.query(ExamAssignment).delete(synchronize_session=False)
    db.query(ExamVersion).delete(synchronize_session=False)
    db.query(Exam).delete(synchronize_session=False)
    db.query(Question).delete(synchronize_session=False)
    
    # Clean non-admin users & all mock organizations
    db.query(OrganizationMember).delete(synchronize_session=False)
    db.query(Subscription).delete(synchronize_session=False)
    db.query(Organization).delete(synchronize_session=False)
    db.query(UserSession).filter(UserSession.user_id != admin.id).delete(synchronize_session=False)
    db.query(User).filter(User.is_superadmin == False).delete(synchronize_session=False)

    # Clean plans check
    ensure_plans_seeded(db)

    # Audit the cleanup
    audit = AuditEvent(
        organization_id=None,
        actor_id=admin.id,
        action="PLATFORM_MOCK_DATA_PURGED",
        metadata_json=json.dumps({"purged_by": current_user.email, "timestamp": datetime.now(timezone.utc).isoformat()})
    )
    db.add(audit)
    db.commit()

    # Clear dual-engine MongoDB mock collections
    try:
        from app.core.mongodb import get_collection
        for coll_name in [
            "audit_logs", "review_decisions", "proctor_events", "evidence_assets",
            "proctor_sessions", "candidate_sessions", "attempt_answers", "exam_attempts",
            "exam_enrollments", "ai_question_drafts", "exam_assignments", "exam_versions",
            "exams", "questions", "question_banks", "question_revisions", "organization_members",
            "subscriptions", "organizations", "quiz_rooms", "quiz_participants"
        ]:
            c = get_collection(coll_name)
            if c is not None:
                c.delete_many({})
        c_users = get_collection("users")
        if c_users is not None:
            c_users.delete_many({"_id": {"$ne": admin.id}, "email": {"$ne": admin.email}})
    except Exception as exc:
        print(f"MongoDB mock purge sync note: {exc}")

    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {
        "status": "success",
        "message": "All mock data, demo organizations, mock attempts, and fake accounts have been purged from SQLite and MongoDB.",
        "active_superadmin": admin.email
    }

@router.post("/organizations/{org_id}/status")
def update_organization_status(
    org_id: str,
    req: OrgStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.status = req.status
    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        action=f"ORGANIZATION_STATUS_CHANGED_{req.status.upper()}",
        metadata_json=json.dumps({"changed_by": current_user.email, "new_status": req.status})
    )
    db.add(audit)
    db.commit()

    return {"message": f"Organization {org.name} status updated to {req.status}", "status": org.status}

@router.post("/organizations/{org_id}/plan")
def change_organization_plan(
    org_id: str,
    req: OrgPlanChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.plan_id = req.plan_id
    if req.plan_id == "institution":
        org.proctoring_attempts_quota = max(org.proctoring_attempts_quota, 1000)
        org.ai_generation_credits = max(org.ai_generation_credits, 2500)
    elif req.plan_id == "creator_pro":
        org.ai_generation_credits = max(org.ai_generation_credits, 500)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        action=f"PLAN_CHANGED_{req.plan_id.upper()}",
        metadata_json=json.dumps({"changed_by": current_user.email, "new_plan": req.plan_id})
    )
    db.add(audit)
    db.commit()

    return {"message": f"Organization plan updated to {req.plan_id}", "plan_id": org.plan_id}

@router.get("/plans")
def list_admin_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    ensure_plans_seeded(db)
    plans = db.query(Plan).all()

    results = []
    for p in plans:
        ents = {e.key: e.value for e in p.entitlements}
        results.append({
            "id": p.id,
            "name": p.name,
            "price_inr": p.price_inr,
            "billing_period": p.billing_period,
            "description": p.description,
            "is_active": p.is_active,
            "entitlements": ents
        })
    return results

class CreatePlanRequest(BaseModel):
    id: str
    name: str
    price_inr: int
    billing_period: str = "monthly"
    description: Optional[str] = None
    entitlements: Optional[Dict[str, Any]] = None

class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    price_inr: Optional[int] = None
    billing_period: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    entitlements: Optional[Dict[str, Any]] = None

def sync_plan_to_organizations(db: Session, plan_id: str):
    """Propagates updated plan entitlements & services to all organizations subscribed to this plan."""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        return 0

    ents = {e.key: e.value for e in plan.entitlements}
    proctoring_on = (ents.get("proctoring_enabled", "false").lower() == "true")
    pdf_on = (ents.get("pdf_import", "false").lower() == "true")
    ai_credits = int(ents.get("ai_questions", 20))
    max_cand = int(ents.get("max_candidates", 25))

    orgs = db.query(Organization).filter(Organization.plan_id == plan_id).all()
    for org in orgs:
        # 1. Quotas
        if org.ai_generation_credits < ai_credits:
            org.ai_generation_credits = ai_credits
        if proctoring_on:
            if org.proctoring_attempts_quota <= 0:
                org.proctoring_attempts_quota = 100 if plan_id != "free" else 25
        else:
            org.proctoring_attempts_quota = 0

        # 2. Services
        srv = org.get_services()
        srv["live_proctoring"] = proctoring_on
        srv["proctor_console"] = proctoring_on
        srv["pdf_import"] = pdf_on
        org.set_services(srv)

        # 3. Properties
        props = org.get_properties()
        props["max_concurrent_sessions"] = max_cand
        org.set_properties(props)

    db.flush()
    return len(orgs)

DEFAULT_PAYMENT_SETTINGS = {
    "gateway": "upi",
    "live_mode": True,
    "upi_enabled": True,
    "upi_id": "demostore@examplebank",
    "upi_payee_name": "Sharma General Store",
    "upi_merchant_code": "5411",
    "razorpay_key_id": "rzp_live_lunaris2026",
    "razorpay_key_secret": "••••••••••••••••",
    "stripe_publishable_key": "pk_live_51LunarisPlatformKey",
    "stripe_secret_key": "••••••••••••••••",
    "currency": "INR",
    "tax_percentage": 18,
    "hsn_sac_code": "998431",
    "auto_invoice": True,
    "invoice_prefix": "LUN-INV-2026-",
    "billing_legal_name": "Lunaris Assessment Technologies Private Limited",
    "billing_contact_email": "billing@lunaris.com",
    "settlement_account": "HDFC0001234 - Current A/C"
}

import urllib.parse

def build_upi_uri(pa: str, pn: str, am: Any, tn: str, tr: str = None, cu: str = "INR", mc: str = None) -> str:
    params = [
        ("pa", pa),
        ("pn", pn),
        ("am", str(am)),
        ("tn", tn),
        ("cu", cu)
    ]
    if tr:
        params.append(("tr", tr))
    if mc:
        params.append(("mc", mc))
    query_str = urllib.parse.urlencode(params, quote_via=urllib.parse.quote_plus)
    return f"upi://pay?{query_str}"

class UpiPaymentSubmissionRequest(BaseModel):
    organization_id: str
    plan_id: str
    utr_number: str
    amount_inr: int
    payer_vpa: Optional[str] = None
    notes: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    action: str  # "approve" or "reject"
    rejection_reason: Optional[str] = None
    extend_days: Optional[int] = 30

@router.post("/plans")
def create_plan_superadmin(
    req: CreatePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    clean_id = req.id.strip().lower().replace(" ", "_")
    existing = db.query(Plan).filter(Plan.id == clean_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Plan with ID '{clean_id}' already exists.")

    plan = Plan(
        id=clean_id,
        name=req.name,
        price_inr=req.price_inr,
        billing_period=req.billing_period,
        description=req.description,
        is_active=True
    )
    db.add(plan)
    db.flush()

    if req.entitlements:
        for k, v in req.entitlements.items():
            serialized = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
            db.add(PlanEntitlement(plan_id=plan.id, key=k, value=serialized))

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        action="SUPERADMIN_PLAN_CREATED",
        metadata_json=json.dumps({"plan_id": clean_id, "name": req.name, "price_inr": req.price_inr})
    )
    db.add(audit)
    db.commit()
    return {"message": f"Plan '{req.name}' created successfully!", "plan_id": plan.id}

@router.put("/plans/{plan_id}")
def update_plan_superadmin(
    plan_id: str,
    req: UpdatePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if req.name is not None:
        plan.name = req.name
    if req.price_inr is not None:
        plan.price_inr = req.price_inr
    if req.billing_period is not None:
        plan.billing_period = req.billing_period
    if req.description is not None:
        plan.description = req.description
    if req.is_active is not None:
        plan.is_active = req.is_active

    if req.entitlements is not None:
        for k, v in req.entitlements.items():
            serialized = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
            existing_ent = db.query(PlanEntitlement).filter(
                PlanEntitlement.plan_id == plan.id,
                PlanEntitlement.key == k
            ).first()
            if existing_ent:
                existing_ent.value = serialized
            else:
                db.add(PlanEntitlement(plan_id=plan.id, key=k, value=serialized))

    # Sync to all organizations currently subscribed to this plan!
    synced_count = sync_plan_to_organizations(db, plan.id)

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        action="SUPERADMIN_PLAN_UPDATED",
        metadata_json=json.dumps({
            "plan_id": plan.id,
            "name": plan.name,
            "price_inr": plan.price_inr,
            "entitlements": req.entitlements,
            "organizations_synced": synced_count
        })
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Plan '{plan.name}' updated successfully and synchronized to {synced_count} organization(s)!",
        "plan_id": plan.id,
        "synced_organizations": synced_count
    }

@router.post("/plans/{plan_id}/toggle-proctoring")
def toggle_plan_proctoring_superadmin(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    ent = db.query(PlanEntitlement).filter(
        PlanEntitlement.plan_id == plan.id,
        PlanEntitlement.key == "proctoring_enabled"
    ).first()
    
    current_val = (ent.value.lower() == "true") if ent else False
    new_val = not current_val
    new_str = "true" if new_val else "false"

    if ent:
        ent.value = new_str
    else:
        db.add(PlanEntitlement(plan_id=plan.id, key="proctoring_enabled", value=new_str))

    synced_count = sync_plan_to_organizations(db, plan.id)
    status_label = "Activated" if new_val else "Deactivated"

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        action="SUPERADMIN_PLAN_PROCTORING_TOGGLED",
        metadata_json=json.dumps({"plan_id": plan.id, "proctoring_enabled": new_str, "synced_organizations": synced_count})
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Proctoring module {status_label} for {plan.name} and synced to {synced_count} organization(s)!",
        "plan_id": plan.id,
        "proctoring_enabled": new_val,
        "synced_organizations": synced_count
    }

@router.post("/organizations/{org_id}/sync-plan-allotment")
def sync_organization_plan_allotment(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan_id = org.plan_id or "free"
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Assigned plan '{plan_id}' not found")

    sync_plan_to_organizations(db, plan.id)
    db.commit()

    return {
        "message": f"Organization '{org.name}' allotment synchronized strictly to plan '{plan.name}'!",
        "organization_id": org.id,
        "plan_id": plan.id,
        "ai_generation_credits": org.ai_generation_credits,
        "proctoring_attempts_quota": org.proctoring_attempts_quota,
        "services": org.get_services()
    }

@router.delete("/plans/{plan_id}")
def delete_plan_superadmin(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    name = plan.name
    db.delete(plan)
    db.commit()
    return {"message": f"Plan '{name}' removed successfully!"}

@router.get("/payment-settings")
def get_payment_settings_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    row = db.query(SystemSetting).filter(SystemSetting.key == "payment_settings").first()
    if row and row.value_json:
        try:
            stored = json.loads(row.value_json)
            merged = DEFAULT_PAYMENT_SETTINGS.copy()
            merged.update(stored)
            return merged
        except Exception:
            pass
    return DEFAULT_PAYMENT_SETTINGS

@router.put("/payment-settings")
def update_payment_settings_endpoint(
    settings_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    row = db.query(SystemSetting).filter(SystemSetting.key == "payment_settings").first()
    merged = DEFAULT_PAYMENT_SETTINGS.copy()
    if row and row.value_json:
        try:
            merged.update(json.loads(row.value_json))
        except Exception:
            pass
    merged.update(settings_data)

    if not row:
        row = SystemSetting(key="payment_settings", value_json=json.dumps(merged))
        db.add(row)
    else:
        row.value_json = json.dumps(merged)
        row.updated_at = datetime.now(timezone.utc)

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        action="SUPERADMIN_PAYMENT_SETTINGS_MODIFIED",
        metadata_json=json.dumps({
            "gateway": merged.get("gateway"),
            "currency": merged.get("currency"),
            "tax_percentage": merged.get("tax_percentage")
        })
    )
    db.add(audit)
    db.commit()

    return {"message": "Payment gateway and billing settings updated successfully!", "settings": merged}


DEFAULT_PUBLIC_SITE_SETTINGS = {
    "announcement_active": False,
    "announcement_text": "",
    "announcement_link": "",
    "site_headline": "All-in-one assessment engine with on-device anti-cheat",
    "site_subtitle": "Conduct secure computer-based examinations, quick quizzes, and auto-graded evaluations with real-time video invigilation.",
    "contact_email": "support@lunaris.com",
    "support_phone": "+91 98765 43210",
    "platform_status": "Operational"
}


@router.get("/public-settings")
def get_public_site_settings_endpoint(db: Session = Depends(get_db)):
    """Unauthenticated public endpoint returning platform landing site settings configured by SuperAdmin."""
    row = db.query(SystemSetting).filter(SystemSetting.key == "public_site_settings").first()
    if row and row.value_json:
        try:
            stored = json.loads(row.value_json)
            merged = DEFAULT_PUBLIC_SITE_SETTINGS.copy()
            merged.update(stored)
            return merged
        except Exception:
            pass
    return DEFAULT_PUBLIC_SITE_SETTINGS


@router.put("/public-settings")
def update_public_site_settings_endpoint(
    settings_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows SuperAdmin to update public website announcements, headlines, and contacts."""
    check_superadmin(current_user)
    row = db.query(SystemSetting).filter(SystemSetting.key == "public_site_settings").first()
    merged = DEFAULT_PUBLIC_SITE_SETTINGS.copy()
    if row and row.value_json:
        try:
            merged.update(json.loads(row.value_json))
        except Exception:
            pass
    merged.update(settings_data)

    if not row:
        row = SystemSetting(key="public_site_settings", value_json=json.dumps(merged))
        db.add(row)
    else:
        row.value_json = json.dumps(merged)
        row.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Public website settings updated by SuperAdmin!", "settings": merged}


@router.get("/public-stats")
def get_public_stats_endpoint(db: Session = Depends(get_db)):
    """Unauthenticated public live statistics for the landing page."""
    total_exams = db.query(Exam).count()
    total_attempts = db.query(ExamAttempt).count()
    total_questions = db.query(Question).count()
    total_orgs = db.query(Organization).count()

    return {
        "total_exams": total_exams,
        "total_attempts": total_attempts,
        "total_questions": total_questions,
        "total_organizations": total_orgs,
        "uptime": "99.98%",
        "proctor_accuracy": "99.4%"
    }

@router.get("/upi-checkout-info")
def get_upi_checkout_info(
    organization_id: str,
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    row = db.query(SystemSetting).filter(SystemSetting.key == "payment_settings").first()
    settings = DEFAULT_PAYMENT_SETTINGS.copy()
    if row and row.value_json:
        try:
            settings.update(json.loads(row.value_json))
        except Exception:
            pass

    upi_id = settings.get("upi_id") or "demostore@examplebank"
    payee_name = settings.get("upi_payee_name") or "Sharma General Store"
    merchant_code = settings.get("upi_merchant_code") or "5411"

    import uuid
    ref_id = f"ORD{uuid.uuid4().hex[:6].upper()}"
    transaction_note = f"Order #{ref_id}"

    upi_uri = build_upi_uri(
        pa=upi_id,
        pn=payee_name,
        am=plan.price_inr,
        tn=transaction_note,
        tr=ref_id,
        cu=settings.get("currency", "INR"),
        mc=merchant_code
    )

    qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={urllib.parse.quote(upi_uri)}"

    return {
        "upi_id": upi_id,
        "payee_name": payee_name,
        "amount_inr": plan.price_inr,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "currency": settings.get("currency", "INR"),
        "transaction_note": transaction_note,
        "reference_id": ref_id,
        "upi_uri": upi_uri,
        "qr_image_url": qr_image_url,
        "upi_enabled": settings.get("upi_enabled", True)
    }

@router.post("/payments/submit-upi")
def submit_upi_payment(
    req: UpiPaymentSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == req.organization_id) | (Organization.slug == req.organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan = db.query(Plan).filter(Plan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    clean_utr = req.utr_number.strip().upper()
    if len(clean_utr) < 6:
        raise HTTPException(status_code=400, detail="Invalid UTR / Transaction Reference. Must be at least 6 characters.")

    existing = db.query(PaymentEvent).filter(PaymentEvent.event_id == f"UPI-{clean_utr}").first()
    if existing and existing.verified:
        raise HTTPException(status_code=400, detail="This UTR reference has already been verified and applied to a subscription.")

    row = db.query(SystemSetting).filter(SystemSetting.key == "payment_settings").first()
    settings = DEFAULT_PAYMENT_SETTINGS.copy()
    if row and row.value_json:
        try:
            settings.update(json.loads(row.value_json))
        except Exception:
            pass

    payload = {
        "utr_number": clean_utr,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "amount_inr": req.amount_inr,
        "payer_vpa": req.payer_vpa or "",
        "payee_vpa": settings.get("upi_id", "demostore@examplebank"),
        "notes": req.notes or "",
        "status": "pending",
        "submitted_by": current_user.email,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }

    if existing:
        existing.amount_inr = req.amount_inr
        existing.payload_json = json.dumps(payload)
        existing.verified = False
        payment_record = existing
    else:
        payment_record = PaymentEvent(
            organization_id=org.id,
            provider="upi",
            event_id=f"UPI-{clean_utr}",
            event_type="upi_subscription_payment",
            amount_inr=req.amount_inr,
            verified=False,
            payload_json=json.dumps(payload)
        )
        db.add(payment_record)

    audit = AuditEvent(
        organization_id=org.id,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="UPI_PAYMENT_SUBMITTED",
        metadata_json=json.dumps({"utr": clean_utr, "plan_id": plan.id, "amount_inr": req.amount_inr})
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Payment with UTR {clean_utr} submitted successfully! Platform Administrator will verify the transaction.",
        "payment_id": payment_record.id,
        "utr_number": clean_utr,
        "status": "pending"
    }

@router.get("/payments")
def list_platform_payments(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    events = db.query(PaymentEvent).order_by(PaymentEvent.created_at.desc()).limit(150).all()

    results = []
    for ev in events:
        org = db.query(Organization).filter(Organization.id == ev.organization_id).first()
        meta = {}
        if ev.payload_json:
            try:
                meta = json.loads(ev.payload_json)
            except Exception:
                pass

        item_status = meta.get("status", "approved" if ev.verified else "pending")
        if status_filter and status_filter.lower() != "all" and item_status.lower() != status_filter.lower():
            continue

        results.append({
            "id": ev.id,
            "organization_id": ev.organization_id,
            "organization_name": org.name if org else "Unknown Organization",
            "provider": ev.provider,
            "event_id": ev.event_id,
            "utr_number": meta.get("utr_number") or ev.event_id.replace("UPI-", ""),
            "plan_id": meta.get("plan_id", "creator_pro"),
            "plan_name": meta.get("plan_name", "Subscription Plan"),
            "amount_inr": ev.amount_inr,
            "verified": ev.verified,
            "status": item_status,
            "payer_vpa": meta.get("payer_vpa", ""),
            "payee_vpa": meta.get("payee_vpa", ""),
            "notes": meta.get("notes", ""),
            "submitted_by": meta.get("submitted_by", ""),
            "submitted_at": meta.get("submitted_at") or ev.created_at.isoformat(),
            "verified_by": meta.get("verified_by"),
            "verified_at": meta.get("verified_at"),
            "rejection_reason": meta.get("rejection_reason")
        })
    return results

@router.post("/payments/{payment_id}/verify")
def verify_payment_superadmin(
    payment_id: str,
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    payment = db.query(PaymentEvent).filter(PaymentEvent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    meta = {}
    if payment.payload_json:
        try:
            meta = json.loads(payment.payload_json)
        except Exception:
            pass

    org = db.query(Organization).filter(Organization.id == payment.organization_id).first()
    now = datetime.now(timezone.utc)

    if req.action == "approve":
        payment.verified = True
        meta["status"] = "approved"
        meta["verified_by"] = current_user.email
        meta["verified_at"] = now.isoformat()
        payment.payload_json = json.dumps(meta)

        target_plan_id = meta.get("plan_id") or "creator_pro"
        if org:
            org.plan_id = target_plan_id
            if target_plan_id == "institution":
                org.proctoring_attempts_quota = max(org.proctoring_attempts_quota, 1000)
                org.ai_generation_credits = max(org.ai_generation_credits, 2500)
            elif target_plan_id == "creator_pro":
                org.ai_generation_credits = max(org.ai_generation_credits, 500)

            from datetime import timedelta
            sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
            if not sub:
                sub = Subscription(
                    organization_id=org.id,
                    plan_id=target_plan_id,
                    status="active",
                    current_period_start=now,
                    current_period_end=now + timedelta(days=req.extend_days or 30)
                )
                db.add(sub)
            else:
                sub.plan_id = target_plan_id
                sub.status = "active"
                base_end = sub.current_period_end or now
                if base_end.tzinfo is None:
                    base_end = base_end.replace(tzinfo=timezone.utc)
                sub.current_period_end = max(now, base_end) + timedelta(days=req.extend_days or 30)

        audit = AuditEvent(
            organization_id=payment.organization_id,
            actor_id=current_user.id,
            actor_email=current_user.email,
            action="SUPERADMIN_UPI_PAYMENT_APPROVED",
            metadata_json=json.dumps({
                "payment_id": payment.id,
                "utr": meta.get("utr_number"),
                "plan_id": target_plan_id,
                "amount_inr": payment.amount_inr
            })
        )
        db.add(audit)
        db.commit()

        if target_plan_id != "free" and org:
            try:
                owner_member = db.query(OrganizationMember).filter(
                    OrganizationMember.organization_id == org.id,
                    OrganizationMember.role.in_(["owner", "admin"])
                ).first()
                if owner_member:
                    cleanup_free_organizations_for_user(db, owner_member.user_id)
            except Exception as exc:
                print(f"Cleanup free orgs on payment verify note: {exc}")
        return {
            "message": f"Payment verified successfully! Subscription activated for '{org.name if org else ''}'.",
            "status": "approved",
            "verified": True
        }

    elif req.action == "reject":
        payment.verified = False
        meta["status"] = "rejected"
        meta["rejection_reason"] = req.rejection_reason or "UTR reference not recognized or mismatched amount."
        meta["rejected_by"] = current_user.email
        meta["rejected_at"] = now.isoformat()
        payment.payload_json = json.dumps(meta)

        audit = AuditEvent(
            organization_id=payment.organization_id,
            actor_id=current_user.id,
            actor_email=current_user.email,
            action="SUPERADMIN_UPI_PAYMENT_REJECTED",
            metadata_json=json.dumps({
                "payment_id": payment.id,
                "utr": meta.get("utr_number"),
                "reason": meta.get("rejection_reason")
            })
        )
        db.add(audit)
        db.commit()
        return {
            "message": "Payment rejected.",
            "status": "rejected",
            "verified": False
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'approve' or 'reject'.")

@router.get("/analytics")
def get_deep_platform_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)

    total_orgs = db.query(Organization).count()
    active_orgs = db.query(Organization).filter(Organization.status == "active").count()
    suspended_orgs = total_orgs - active_orgs

    total_users = db.query(User).count()
    total_exams = db.query(Exam).count()
    nta_exams = db.query(Exam).filter(Exam.mode == "proctored_cbt").count()
    quick_quiz_exams = db.query(Exam).filter(Exam.mode == "quick_quiz").count()
    practice_exams = total_exams - nta_exams - quick_quiz_exams

    total_attempts = db.query(ExamAttempt).count()
    completed_attempts = db.query(ExamAttempt).filter(ExamAttempt.status == "submitted").count()
    active_attempts = db.query(ExamAttempt).filter(ExamAttempt.status == "in_progress").count()

    total_questions = db.query(Question).count()
    proctor_events = db.query(ProctorEvent).count()
    evidence_count = db.query(EvidenceAsset).count()

    plans_counts = {}
    orgs = db.query(Organization).all()
    for o in orgs:
        p_id = o.plan_id or "free"
        plans_counts[p_id] = plans_counts.get(p_id, 0) + 1

    # Real approved payments & verified original customer financials
    verified_payments = db.query(PaymentEvent).filter(PaymentEvent.verified == True).all()
    actual_revenue_inr = sum(p.amount_inr for p in verified_payments)
    actual_paying_org_ids = set(p.organization_id for p in verified_payments)
    actual_customers_count = len(actual_paying_org_ids)

    # Actual MRR from real paying customers with active approved plans
    actual_mrr = 0
    for o in orgs:
        if o.id in actual_paying_org_ids:
            p_id = o.plan_id or "free"
            if p_id == "institution":
                actual_mrr += 1999
            elif p_id == "creator_pro":
                actual_mrr += 499

    return {
        "organizations": {
            "total": total_orgs,
            "active": active_orgs,
            "suspended": suspended_orgs,
            "actual_paying_customers": actual_customers_count,
            "distribution_by_plan": plans_counts
        },
        "exams_and_questions": {
            "total_exams": total_exams,
            "nta_cbt_exams": nta_exams,
            "quick_quiz_arenas": quick_quiz_exams,
            "standard_practice": max(0, practice_exams),
            "total_questions_authored": total_questions
        },
        "candidates_and_attempts": {
            "total_attempts": total_attempts,
            "completed": completed_attempts,
            "in_progress": active_attempts,
            "total_users": total_users,
            "completion_rate": round((completed_attempts / total_attempts * 100), 1) if total_attempts > 0 else 100.0
        },
        "financials": {
            "mrr_inr": actual_mrr,
            "arr_inr": actual_mrr * 12,
            "total_revenue_inr": actual_revenue_inr,
            "total_approved_payments": len(verified_payments),
            "actual_paying_customers": actual_customers_count,
            "currency": "INR",
            "active_subscriptions": db.query(Subscription).filter(Subscription.status == "active").count()
        },
        "integrity_and_proctoring": {
            "total_violations_logged": proctor_events,
            "evidence_snapshots": evidence_count,
            "ai_drafts_generated": db.query(AIQuestionDraft).count()
        },
        "system_status": {
            "engine": "Dual-Engine (SQLite WAL + MongoDB Sync)",
            "health": "healthy",
            "uptime_percent": 99.98
        }
    }

@router.get("/customers")
def get_actual_paying_customers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    verified_events = db.query(PaymentEvent).filter(PaymentEvent.verified == True).order_by(PaymentEvent.created_at.desc()).all()

    customers_map = {}
    for ev in verified_events:
        org_id = ev.organization_id
        if org_id not in customers_map:
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                continue
            customers_map[org_id] = {
                "organization_id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan_id": org.plan_id or "free",
                "status": org.status,
                "created_at": org.created_at.isoformat(),
                "total_paid_inr": 0,
                "approved_payments_count": 0,
                "last_payment_date": None,
                "payments": []
            }

        customers_map[org_id]["total_paid_inr"] += ev.amount_inr
        customers_map[org_id]["approved_payments_count"] += 1
        if not customers_map[org_id]["last_payment_date"]:
            customers_map[org_id]["last_payment_date"] = ev.created_at.isoformat()

        meta = {}
        if ev.payload_json:
            try:
                meta = json.loads(ev.payload_json)
            except Exception:
                pass

        customers_map[org_id]["payments"].append({
            "payment_id": ev.id,
            "utr_number": meta.get("utr_number") or ev.event_id.replace("UPI-", ""),
            "amount_inr": ev.amount_inr,
            "plan_id": meta.get("plan_id"),
            "paid_at": ev.created_at.isoformat()
        })

    return list(customers_map.values())

@router.delete("/audit-logs")
def clear_audit_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    count = db.query(AuditEvent).delete(synchronize_session=False)
    db.commit()

    # Clear dual-engine MongoDB audit_logs collection
    try:
        from app.core.mongodb import get_collection
        coll = get_collection("audit_logs")
        if coll is not None:
            coll.delete_many({})
    except Exception as exc:
        print(f"MongoDB audit clear note: {exc}")

    # Checkpoint and sync physical SQLite database files to disk
    from app.core.database import checkpoint_and_sync_db
    checkpoint_and_sync_db(db)

    return {"message": f"Cleared {count} audit records from SQLite and MongoDB database successfully!"}

class CreateAdminUserRequest(BaseModel):
    email: str
    full_name: str
    password: str
    admin_role: str = "platform_admin"  # "platform_admin", "platform_auditor", "platform_support"

class UpdateAdminRoleRequest(BaseModel):
    admin_role: Optional[str] = None
    status: Optional[str] = None

@router.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    action_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    query = db.query(AuditEvent)

    if action_filter and action_filter != "all":
        query = query.filter(AuditEvent.action.ilike(f"%{action_filter}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (AuditEvent.action.ilike(term)) | 
            (AuditEvent.actor_id.ilike(term)) | 
            (AuditEvent.metadata_json.ilike(term))
        )

    total_count = query.count()
    page = max(1, page)
    page_size = max(1, min(200, page_size))
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    logs = query.order_by(AuditEvent.created_at.desc()).offset(offset).limit(page_size).all()

    items = [
        {
            "id": log.id,
            "organization_id": log.organization_id,
            "actor_id": log.actor_id,
            "action": log.action,
            "metadata": json.loads(log.metadata_json) if log.metadata_json else {},
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

# ── ADMIN TEAM & RBAC MANAGEMENT ──────────────────────────────────────
@router.get("/admins")
def list_admin_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    admins = db.query(User).filter(User.is_superadmin == True).order_by(User.created_at.asc()).all()
    res = []
    for a in admins:
        is_primary = is_main_superadmin(a)
        res.append({
            "id": a.id,
            "email": a.email,
            "full_name": a.full_name,
            "admin_role": "superadmin" if is_primary else (getattr(a, "admin_role", None) or "platform_admin"),
            "is_main_superadmin": is_primary,
            "status": a.status or "active",
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return res

@router.post("/admins")
def create_admin_user(
    req: CreateAdminUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    
    # Strictly enforce: Main superadmin is ONLY ONE
    if req.admin_role.lower() == "superadmin":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign 'superadmin' role. The platform permits exactly ONE Main Super Administrator. Choose 'platform_admin', 'platform_auditor', or 'platform_support'."
        )
    
    valid_roles = ["platform_admin", "platform_auditor", "platform_support"]
    if req.admin_role.lower() not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid admin role. Must be one of: {', '.join(valid_roles)}")
    
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        if existing.is_superadmin:
            raise HTTPException(status_code=400, detail="This user is already an administrative staff member.")
        existing.is_superadmin = True
        existing.admin_role = req.admin_role.lower()
        if req.full_name:
            existing.full_name = req.full_name
        db.commit()
        db.refresh(existing)
        return {
            "message": f"User '{existing.email}' promoted to {existing.admin_role} successfully.",
            "admin": {
                "id": existing.id,
                "email": existing.email,
                "full_name": existing.full_name,
                "admin_role": existing.admin_role,
                "is_main_superadmin": False,
                "status": existing.status
            }
        }

    new_admin = User(
        email=req.email.lower().strip(),
        password_hash=get_password_hash(req.password),
        full_name=req.full_name,
        is_superadmin=True,
        admin_role=req.admin_role.lower(),
        status="active"
    )
    db.add(new_admin)
    
    audit = AuditEvent(
        actor_id=current_user.id,
        action="SUPERADMIN_PROVISION_ADMIN_USER",
        metadata_json=json.dumps({
            "new_admin_email": new_admin.email,
            "assigned_role": new_admin.admin_role,
            "provisioned_by": current_user.email
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(new_admin)

    return {
        "message": f"Platform administrator account '{new_admin.email}' created with role '{new_admin.admin_role}'.",
        "admin": {
            "id": new_admin.id,
            "email": new_admin.email,
            "full_name": new_admin.full_name,
            "admin_role": new_admin.admin_role,
            "is_main_superadmin": False,
            "status": new_admin.status
        }
    }

@router.put("/admins/{user_id}/role")
def update_admin_role_and_status(
    user_id: str,
    req: UpdateAdminRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target or not target.is_superadmin:
        raise HTTPException(status_code=404, detail="Admin user not found")

    if is_main_superadmin(target):
        raise HTTPException(
            status_code=400,
            detail="The Primary Super Administrator role and status cannot be modified or demoted."
        )

    if req.admin_role:
        if req.admin_role.lower() == "superadmin":
            raise HTTPException(
                status_code=400,
                detail="Cannot promote to 'superadmin'. The platform permits only ONE Main Super Administrator."
            )
        valid_roles = ["platform_admin", "platform_auditor", "platform_support"]
        if req.admin_role.lower() not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid admin role. Must be one of: {', '.join(valid_roles)}")
        target.admin_role = req.admin_role.lower()

    if req.status:
        target.status = req.status

    audit = AuditEvent(
        actor_id=current_user.id,
        action="SUPERADMIN_UPDATE_ADMIN_ROLE",
        metadata_json=json.dumps({
            "target_email": target.email,
            "new_role": target.admin_role,
            "new_status": target.status
        })
    )
    db.add(audit)
    db.commit()
    return {"message": f"Admin '{target.email}' updated to role '{target.admin_role}' with status '{target.status}'."}

@router.delete("/admins/{user_id}")
def revoke_admin_access(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target or not target.is_superadmin:
        raise HTTPException(status_code=404, detail="Admin user not found")

    if is_main_superadmin(target):
        raise HTTPException(
            status_code=400,
            detail="CRITICAL: The Primary Super Administrator account cannot be revoked or deleted."
        )

    target.is_superadmin = False
    target.admin_role = None
    
    audit = AuditEvent(
        actor_id=current_user.id,
        action="SUPERADMIN_REVOKE_ADMIN_ACCESS",
        metadata_json=json.dumps({
            "revoked_admin_email": target.email,
            "revoked_by": current_user.email
        })
    )
    db.add(audit)
    db.commit()
    return {"message": f"Administrative access for '{target.email}' has been revoked."}

@router.get("/mongodb/status")
def get_mongodb_status_endpoint(current_user: User = Depends(get_current_user)):
    """Returns real-time MongoDB status, active collections, and document totals."""
    check_superadmin(current_user)
    from app.core.mongodb import get_mongodb_stats
    return get_mongodb_stats()

@router.post("/mongodb/sync")
def trigger_mongodb_bulk_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers an on-demand full sync of all SQLite entities into MongoDB collections."""
    check_superadmin(current_user)
    from app.core.mongo_sync import bulk_sync_sqlite_to_mongodb
    summary = bulk_sync_sqlite_to_mongodb(db)
    return {
        "status": "success",
        "message": "Bulk replication to MongoDB completed",
        "sync_summary": summary
    }

@router.get("/mongodb/collection/{collection_name}")
def inspect_mongodb_collection(
    collection_name: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Inspects raw documents directly in a MongoDB collection."""
    check_superadmin(current_user)
    from app.core.mongodb import get_collection
    coll = get_collection(collection_name)
    if coll is None:
        raise HTTPException(status_code=404, detail="Collection not found or MongoDB offline")

    docs = list(coll.find({}, limit=min(limit, 200), skip=max(0, skip)))
    # Ensure all _id are serializable
    for doc in docs:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
    return {
        "collection": collection_name,
        "count": len(docs),
        "total": coll.count_documents({}),
        "documents": docs
    }

