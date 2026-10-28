"""
Lunaris Entitlement & Quota Enforcement Engine (Phase 2).
Provides centralized checks across subscriptions, plan limits, and usage ledgers.
"""
from datetime import datetime, timezone
from typing import Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Organization, Plan, PlanEntitlement, Subscription, UsageLedger, Exam, ExamEnrollment

def check_subscription_active(db: Session, organization_id: str) -> Tuple[bool, str]:
    """Check if organization subscription is active or within grace period."""
    sub = db.query(Subscription).filter(Subscription.organization_id == organization_id).first()
    if not sub:
        return True, "free_default"
    
    now = datetime.now(timezone.utc)
    if sub.status == "active" or sub.status == "trialing":
        return True, sub.status
    
    # Grace period check
    if sub.grace_period_end:
        gp = sub.grace_period_end
        if gp.tzinfo is None:
            gp = gp.replace(tzinfo=timezone.utc)
        if now < gp:
            return True, "grace_period"

    return False, sub.status


def get_plan_limits(db: Session, organization_id: str) -> Dict[str, Any]:
    """Resolve active plan limits from PlanEntitlement table."""
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        return {}
    
    plan_id = org.plan_id or "free"
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        plan = db.query(Plan).filter(Plan.id == "free").first()
    
    limits = {
        "max_candidates": 25,
        "max_exams": 3,
        "ai_questions": 20,
        "proctoring_enabled": False,
        "pdf_import": False,
        "team_members": 1,
    }
    if plan:
        for ent in plan.entitlements:
            val = ent.value
            if val.lower() == "true":
                limits[ent.key] = True
            elif val.lower() == "false":
                limits[ent.key] = False
            elif val.isdigit():
                limits[ent.key] = int(val)
            else:
                limits[ent.key] = val
    return limits


def check_entitlement(
    db: Session,
    organization_id: str,
    metric: str,
    requested: int = 1
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates if an operation is allowed within subscription and plan quotas.
    Returns: (is_allowed, reason_or_status, details)
    """
    is_active, sub_status = check_subscription_active(db, organization_id)
    if not is_active:
        return False, f"Subscription is currently {sub_status}. Please renew.", {}

    limits = get_plan_limits(db, organization_id)

    if metric == "max_exams":
        exam_count = db.query(func.count(Exam.id)).filter(Exam.organization_id == organization_id).scalar() or 0
        limit = limits.get("max_exams", 3)
        if exam_count + requested > limit:
            return False, f"Plan limit reached: maximum {limit} exams allowed.", {"current": exam_count, "limit": limit}

    elif metric == "max_candidates":
        cand_count = db.query(func.count(ExamEnrollment.id)).filter(ExamEnrollment.organization_id == organization_id).scalar() or 0
        limit = limits.get("max_candidates", 25)
        if cand_count + requested > limit:
            return False, f"Plan limit reached: maximum {limit} candidate enrollments allowed.", {"current": cand_count, "limit": limit}

    elif metric == "ai_questions":
        used = db.query(func.coalesce(func.sum(UsageLedger.quantity), 0)).filter(
            UsageLedger.organization_id == organization_id,
            UsageLedger.metric == "ai_questions"
        ).scalar() or 0
        limit = limits.get("ai_questions", 20)
        if used + requested > limit:
            return False, f"AI synthesis quota reached ({used}/{limit} items). Please upgrade.", {"current": used, "limit": limit}

    elif metric == "proctoring_enabled":
        if not limits.get("proctoring_enabled", False):
            return False, "AI Proctoring is not enabled on your current plan. Upgrade to Institution plan.", {"limit": False}

    return True, "permitted", limits


def record_usage(
    db: Session,
    organization_id: str,
    metric: str,
    quantity: int = 1,
    reference_id: Optional[str] = None
) -> UsageLedger:
    """Records consumed usage into the immutable usage ledger."""
    entry = UsageLedger(
        organization_id=organization_id,
        metric=metric,
        quantity=quantity,
        reference_id=reference_id
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
    return entry
