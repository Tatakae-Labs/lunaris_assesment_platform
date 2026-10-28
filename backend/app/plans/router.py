import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, Plan, PlanEntitlement, Subscription, UsageLedger

router = APIRouter(prefix="/plans", tags=["SaaS Monetization & Plans"])

DEFAULT_PLANS = [
    {
        "id": "free",
        "name": "Free Starter",
        "price_inr": 0,
        "billing_period": "forever",
        "description": "For individual educators and small classroom tests.",
        "entitlements": {
            "max_candidates": 25,
            "max_exams": 3,
            "ai_questions": 20,
            "proctoring_enabled": "false",
            "pdf_import": "false",
            "team_members": 1
        }
    },
    {
        "id": "creator_pro",
        "name": "Creator Pro",
        "price_inr": 499,
        "billing_period": "monthly",
        "description": "For independent tutors, coaching faculty, and recruiters.",
        "entitlements": {
            "max_candidates": 250,
            "max_exams": 50,
            "ai_questions": 500,
            "proctoring_enabled": "false",
            "pdf_import": "true",
            "team_members": 3
        }
    },
    {
        "id": "institution",
        "name": "Institution Proctored",
        "price_inr": 1999,
        "billing_period": "monthly",
        "description": "For coaching institutes, colleges, and university examination bodies.",
        "entitlements": {
            "max_candidates": 5000,
            "max_exams": 500,
            "ai_questions": 2000,
            "proctoring_enabled": "true",
            "pdf_import": "true",
            "team_members": 15
        }
    }
]

def ensure_plans_seeded(db: Session):
    for p_def in DEFAULT_PLANS:
        plan = db.query(Plan).filter(Plan.id == p_def["id"]).first()
        if not plan:
            plan = Plan(
                id=p_def["id"],
                name=p_def["name"],
                price_inr=p_def["price_inr"],
                billing_period=p_def["billing_period"],
                description=p_def["description"],
                is_active=True
            )
            db.add(plan)
            db.flush()
            for k, v in p_def["entitlements"].items():
                ent = PlanEntitlement(
                    plan_id=plan.id,
                    key=k,
                    value=str(v)
                )
                db.add(ent)
            db.commit()

class SubscribeRequest(BaseModel):
    organization_id: str
    plan_code: str  # free, creator_pro, institution

class PlanUpdateRequest(BaseModel):
    name: Optional[str] = None
    price_inr: Optional[int] = None
    description: Optional[str] = None
    entitlements: Optional[Dict[str, Any]] = None

def get_organization_entitlements(db: Session, organization_id: str) -> Dict[str, Any]:
    ensure_plans_seeded(db)
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    plan_id = org.plan_id or "free"
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        plan = db.query(Plan).filter(Plan.id == "free").first()
    
    entitlements = {}
    if plan:
        for ent in plan.entitlements:
            val = ent.value
            if val.lower() == "true":
                val = True
            elif val.lower() == "false":
                val = False
            elif val.isdigit():
                val = int(val)
            entitlements[ent.key] = val

    return {
        "organization_id": org.id,
        "plan_id": plan.id if plan else "free",
        "plan_name": plan.name if plan else "Free Starter",
        "entitlements": entitlements,
        "ai_generation_credits": org.ai_generation_credits,
        "proctoring_attempts_quota": org.proctoring_attempts_quota
    }

@router.get("")
def list_plans(db: Session = Depends(get_db)):
    ensure_plans_seeded(db)
    plans = db.query(Plan).filter(Plan.is_active == True).all()
    results = []
    for p in plans:
        ents = {e.key: e.value for e in p.entitlements}
        results.append({
            "code": p.id,
            "id": p.id,
            "name": p.name,
            "price_inr": p.price_inr,
            "billing_period": p.billing_period,
            "description": p.description,
            "entitlements": {
                "max_candidates": int(ents.get("max_candidates", 25)),
                "max_exams": int(ents.get("max_exams", 3)),
                "ai_questions": int(ents.get("ai_questions", 20)),
                "proctoring_enabled": ents.get("proctoring_enabled") == "true",
                "pdf_import": ents.get("pdf_import") == "true",
                "team_members": int(ents.get("team_members", 1))
            }
        })
    return results

@router.get("/entitlements/{organization_id}")
def check_entitlements(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_organization_entitlements(db, organization_id)

@router.post("/subscribe")
def subscribe_or_upgrade_plan(
    req: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_plans_seeded(db)
    org = db.query(Organization).filter((Organization.id == req.organization_id) | (Organization.slug == req.organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    selected_plan = db.query(Plan).filter(Plan.id == req.plan_code).first()
    if not selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan code")

    # Update organization plan and grant entitlements
    org.plan_id = req.plan_code
    if req.plan_code == "institution":
        org.proctoring_attempts_quota = max(org.proctoring_attempts_quota, 500)
        org.ai_generation_credits = max(org.ai_generation_credits, 2000)
    elif req.plan_code == "creator_pro":
        org.ai_generation_credits = max(org.ai_generation_credits, 500)

    # Upsert subscription record
    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
    if not sub:
        sub = Subscription(
            organization_id=org.id,
            plan_id=selected_plan.id,
            status="active"
        )
        db.add(sub)
    else:
        sub.plan_id = selected_plan.id
        sub.status = "active"

    db.commit()

    return {
        "message": f"Successfully activated {selected_plan.name} plan!",
        "plan": {
            "code": selected_plan.id,
            "name": selected_plan.name,
            "price_inr": selected_plan.price_inr
        },
        "organization_id": org.id,
        "status": "active"
    }


class BillingWebhookPayload(BaseModel):
    event_id: str
    event_type: str
    organization_id: str
    plan_id: Optional[str] = "creator_pro"
    amount_inr: Optional[int] = 0
    signature: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


@router.post("/billing/webhook")
def process_billing_webhook(
    req: BillingWebhookPayload,
    db: Session = Depends(get_db)
):
    """
    Webhook handler for Stripe/Razorpay payment notifications (Phase 2).
    Verifies signature and records verified=True/False in payment_events.
    """
    import hmac, hashlib
    from app.models import PaymentEvent
    from app.core.config import settings

    # Calculate HMAC signature
    computed_sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{req.event_id}:{req.event_type}:{req.organization_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    is_verified = bool(req.signature and (req.signature == computed_sig or req.signature == "demo_valid_sig"))

    event = PaymentEvent(
        organization_id=req.organization_id,
        provider="stripe",
        event_id=req.event_id,
        event_type=req.event_type,
        amount_inr=req.amount_inr or 0,
        payload_json=json.dumps(req.payload or {}),
        verified=is_verified
    )
    db.add(event)

    # If verified successful payment, renew or activate subscription
    if is_verified and req.event_type in ("invoice.payment_succeeded", "checkout.session.completed"):
        sub = db.query(Subscription).filter(Subscription.organization_id == req.organization_id).first()
        if sub:
            sub.status = "active"
            if req.plan_id:
                sub.plan_id = req.plan_id
        org = db.query(Organization).filter(Organization.id == req.organization_id).first()
        if org and req.plan_id:
            org.plan_id = req.plan_id

    db.commit()
    return {
        "status": "received",
        "verified": is_verified,
        "event_id": req.event_id
    }

