import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, Exam, ExamAttempt, Plan, PlanEntitlement, AuditEvent, Subscription
from app.plans.router import ensure_plans_seeded

router = APIRouter(prefix="/platform", tags=["Platform Super Admin"])

def check_superadmin(current_user: User):
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Lunaris Platform Super Administrators"
        )

class OrgStatusRequest(BaseModel):
    status: str  # active, suspended

class OrgPlanChangeRequest(BaseModel):
    plan_id: str

class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    price_inr: Optional[int] = None
    description: Optional[str] = None
    entitlements: Optional[Dict[str, Any]] = None

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
            "created_at": org.created_at.isoformat(),
            "owner": {
                "name": owner_member[1].full_name if owner_member else "Unknown",
                "email": owner_member[1].email if owner_member else "N/A"
            },
            "exam_count": exam_count,
            "attempt_count": attempt_count
        })
    return result

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

@router.put("/plans/{plan_id}")
def update_plan(
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
    if req.description is not None:
        plan.description = req.description

    if req.entitlements:
        for k, v in req.entitlements.items():
            ent = db.query(PlanEntitlement).filter(PlanEntitlement.plan_id == plan.id, PlanEntitlement.key == k).first()
            if ent:
                ent.value = str(v)
            else:
                db.add(PlanEntitlement(plan_id=plan.id, key=k, value=str(v)))

    db.commit()
    return {"message": f"Plan {plan.name} updated successfully!"}

@router.get("/audit-logs")
def get_audit_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_superadmin(current_user)
    logs = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(100).all()

    return [
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

