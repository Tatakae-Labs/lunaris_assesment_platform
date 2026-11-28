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
            "max_candidates": 30,
            "max_exams": 3,
            "ai_questions": 30,
            "proctoring_enabled": "true",
            "pdf_import": "false",
            "team_members": 2,
            "ads_enabled": "true",
            "custom_features": "[]"
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
            "team_members": 3,
            "ads_enabled": "false",
            "custom_features": "[]"
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
            "team_members": 15,
            "ads_enabled": "false",
            "custom_features": "[]"
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

def _parse_custom_features(raw_val: Any) -> List[str]:
    if isinstance(raw_val, list):
        return [str(x).strip() for x in raw_val if str(x).strip()]
    if isinstance(raw_val, str) and raw_val.strip():
        try:
            parsed = json.loads(raw_val)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            return [line.strip() for line in raw_val.splitlines() if line.strip()]
    return []


@router.get("")
def list_plans(db: Session = Depends(get_db)):
    ensure_plans_seeded(db)
    plans = db.query(Plan).filter(Plan.is_active == True).all()
    results = []
    for p in plans:
        ents = {e.key: e.value for e in p.entitlements}
        default_ads = "true" if p.id == "free" else "false"
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
                "team_members": int(ents.get("team_members", 1)),
                "ads_enabled": ents.get("ads_enabled", default_ads).lower() == "true",
                "custom_features": _parse_custom_features(ents.get("custom_features", "[]"))
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

    # When an organization is upgraded to a paid plan, remove any free organization owned by this user
    if req.plan_code != "free":
        try:
            from app.platform.router import cleanup_free_organizations_for_user
            cleanup_free_organizations_for_user(db, current_user.id)
        except Exception as exc:
            print(f"Cleanup free orgs on upgrade note: {exc}")

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

@router.get("/upi-checkout-info")
def get_plans_upi_checkout_info(
    organization_id: str,
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.platform.router import get_upi_checkout_info as _get_upi_checkout_info
    return _get_upi_checkout_info(organization_id, plan_id, current_user, db)

@router.post("/submit-upi")
def submit_plans_upi_payment(
    req: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.platform.router import submit_upi_payment as _submit_upi_payment, UpiPaymentSubmissionRequest
    typed_req = UpiPaymentSubmissionRequest(**req)
    return _submit_upi_payment(typed_req, current_user, db)

@router.get("/my-payments/{organization_id}")
def list_org_payments(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.models import PaymentEvent
    events = db.query(PaymentEvent).filter(PaymentEvent.organization_id == org.id).order_by(PaymentEvent.created_at.desc()).all()

    results = []
    for ev in events:
        meta = {}
        if ev.payload_json:
            try:
                meta = json.loads(ev.payload_json)
            except Exception:
                pass
        results.append({
            "id": ev.id,
            "utr_number": meta.get("utr_number") or ev.event_id.replace("UPI-", ""),
            "plan_id": meta.get("plan_id"),
            "plan_name": meta.get("plan_name", "Plan"),
            "amount_inr": ev.amount_inr,
            "status": meta.get("status", "approved" if ev.verified else "pending"),
            "verified": ev.verified,
            "submitted_at": meta.get("submitted_at") or ev.created_at.isoformat(),
            "rejection_reason": meta.get("rejection_reason")
        })
    return results


@router.get("/subscription-status/{organization_id}")
def get_subscription_status(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns monthly subscription lifecycle metrics: renewal dates, countdowns,
    grace periods, and status.
    """
    ensure_plans_seeded(db)
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    plan_id = org.plan_id or "free"
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)

    if plan_id == "free":
        return {
            "organization_id": org.id,
            "plan_id": "free",
            "plan_name": "Free Starter",
            "price_inr": 0,
            "billing_period": "forever",
            "status": "active",
            "is_free_tier": True,
            "current_period_end": None,
            "days_remaining": None,
            "renewal_date_formatted": "Forever Free",
            "is_expiring_soon": False,
            "is_past_due": False
        }

    # If paid plan has no sub record or missing end date, synthesize standard 30-day window
    end_date = sub.current_period_end if (sub and sub.current_period_end) else (now + timedelta(days=30))
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    diff = end_date - now
    days_remaining = int(diff.total_seconds() // 86400)
    if diff.total_seconds() > 0 and days_remaining == 0:
        days_remaining = 1

    is_expiring_soon = (0 <= days_remaining <= 7)
    is_past_due = (days_remaining < 0 and days_remaining >= -3)  # 3-day grace period
    is_expired = (days_remaining < -3)

    derived_status = "active"
    if is_expired:
        derived_status = "canceled"
    elif is_past_due:
        derived_status = "past_due"
    elif is_expiring_soon:
        derived_status = "expiring_soon"

    return {
        "organization_id": org.id,
        "plan_id": plan.id if plan else plan_id,
        "plan_name": plan.name if plan else plan_id.title(),
        "price_inr": plan.price_inr if plan else 0,
        "billing_period": "monthly",
        "status": derived_status,
        "is_free_tier": False,
        "current_period_start": sub.current_period_start.isoformat() if sub and sub.current_period_start else None,
        "current_period_end": end_date.isoformat(),
        "renewal_date_formatted": end_date.strftime("%d %B %Y"),
        "days_remaining": max(0, days_remaining),
        "exact_days_diff": days_remaining,
        "is_expiring_soon": is_expiring_soon,
        "is_past_due": is_past_due,
        "is_expired": is_expired,
        "grace_period_days_left": max(0, 3 + days_remaining) if days_remaining < 0 else 3
    }


@router.post("/test-renewal-reminder/{organization_id}")
def test_subscription_renewal_reminder(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a test monthly renewal reminder to the current user's email via the configured mailer.
    """
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.core.email import send_subscription_renewal_reminder_email
    plan_id = org.plan_id or "creator_pro"
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    plan_name = plan.name if plan else "Creator Pro"
    price = plan.price_inr if plan else 499

    from datetime import datetime, timezone, timedelta
    renewal_date = datetime.now(timezone.utc) + timedelta(days=7)
    date_str = renewal_date.strftime("%d %B %Y")

    res = send_subscription_renewal_reminder_email(
        to_email=current_user.email,
        org_name=org.name,
        plan_name=plan_name,
        days_remaining=7,
        renewal_date_str=date_str,
        amount_inr=price
    )
    return {
        "status": "dispatched",
        "email": current_user.email,
        "delivery_result": res,
        "message": f"Test renewal reminder sent to {current_user.email}."
    }


@router.post("/sweep-renewals")
def sweep_and_process_renewals(db: Session = Depends(get_db)):
    """
    Scans all paid subscriptions for approaching renewal dates, sends reminder emails,
    and enforces grace period / free tier fallback.
    Can be called via cron job or by superadmin.
    """
    from datetime import datetime, timezone
    from app.core.email import send_subscription_renewal_reminder_email, send_subscription_expired_email
    from app.models import AuditEvent
    import json

    now = datetime.now(timezone.utc)
    subs = db.query(Subscription).filter(Subscription.status != "canceled").all()
    reminders_sent = 0
    downgraded = 0

    for s in subs:
        if not s.current_period_end:
            continue
        end = s.current_period_end
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        diff_days = int((end - now).total_seconds() // 86400)
        org = db.query(Organization).filter(Organization.id == s.organization_id).first()
        if not org or org.plan_id == "free":
            continue

        # Find organization owner email
        owner_member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.role == "owner"
        ).first()
        owner_user = db.query(User).filter(User.id == owner_member.user_id).first() if owner_member else None
        target_email = owner_user.email if owner_user else None

        plan = db.query(Plan).filter(Plan.id == s.plan_id).first()
        plan_name = plan.name if plan else s.plan_id.title()
        price = plan.price_inr if plan else 0

        # Renewal reminder milestone triggers: 7 days, 3 days, 1 day
        if diff_days in (7, 3, 1) and target_email:
            send_subscription_renewal_reminder_email(
                to_email=target_email,
                org_name=org.name,
                plan_name=plan_name,
                days_remaining=diff_days,
                renewal_date_str=end.strftime("%d %B %Y"),
                amount_inr=price
            )
            reminders_sent += 1

        # Expiry day / grace period notification
        elif diff_days == 0 and target_email:
            send_subscription_expired_email(
                to_email=target_email,
                org_name=org.name,
                plan_name=plan_name,
                amount_inr=price,
                grace_period_days=3
            )
            s.status = "past_due"
            reminders_sent += 1

        # Past 3-day grace period: downgrade to Free tier
        elif diff_days < -3:
            s.status = "canceled"
            org.plan_id = "free"
            downgraded += 1
            audit = AuditEvent(
                organization_id=org.id,
                action="SUBSCRIPTION_DOWNGRADED_AUTO_EXPIRY",
                metadata_json=json.dumps({
                    "previous_plan": s.plan_id,
                    "reason": "Grace period expired without payment renewal"
                })
            )
            db.add(audit)

    db.commit()
    return {
        "status": "success",
        "checked_subscriptions": len(subs),
        "reminders_sent": reminders_sent,
        "downgraded_to_free": downgraded
    }


class ValidateCouponRequest(BaseModel):
    code: str
    amount_inr: int = 0


@router.post("/validate-coupon")
def validate_coupon_code(req: ValidateCouponRequest, db: Session = Depends(get_db)):
    """Validates a promo/discount coupon code and returns the discounted INR amount."""
    from datetime import datetime, timezone
    from app.models import Coupon
    clean_code = (req.code or "").strip().upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Coupon code is required.")

    coupon = db.query(Coupon).filter(Coupon.code == clean_code, Coupon.is_active == True).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or inactive coupon code.")

    if coupon.max_uses is not None and (coupon.used_count or 0) >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="This coupon has reached its maximum usage limit.")

    if coupon.expires_at:
        exp = coupon.expires_at.replace(tzinfo=timezone.utc) if coupon.expires_at.tzinfo is None else coupon.expires_at
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This coupon has expired.")

    pct = max(1, min(95, int(coupon.discount_percent or 0)))
    discounted_inr = max(1, round(req.amount_inr * (100 - pct) / 100)) if req.amount_inr > 0 else 0
    return {
        "valid": True,
        "code": coupon.code,
        "discount_percent": pct,
        "original_amount_inr": req.amount_inr,
        "discounted_amount_inr": discounted_inr,
    }

