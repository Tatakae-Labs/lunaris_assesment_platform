import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import razorpay
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Organization, Plan, Subscription, PaymentEvent

router = APIRouter(tags=["Razorpay Checkout"])


class CreateOrderRequest(BaseModel):
    amount: int  # Amount in paise (minimum 100)
    currency: str = "INR"
    receipt: Optional[str] = None
    organization_id: Optional[str] = None
    plan_id: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    organization_id: Optional[str] = None
    plan_id: Optional[str] = None
    amount_inr: Optional[int] = None


def _get_razorpay_credentials():
    key_id = (settings.RAZORPAY_KEY_ID or "").strip()
    key_secret = (settings.RAZORPAY_KEY_SECRET or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Razorpay API credentials are not configured.",
        )
    return key_id, key_secret


def _create_order_impl(req: CreateOrderRequest):
    if req.amount is None or req.amount < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum order amount is 100 paise (INR 1.00).",
        )

    key_id, key_secret = _get_razorpay_credentials()
    receipt = req.receipt or f"lun_{uuid.uuid4().hex[:12]}"

    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        order_payload = {
            "amount": req.amount,
            "currency": (req.currency or "INR").upper(),
            "receipt": receipt[:40],
        }
        if req.organization_id or req.plan_id:
            order_payload["notes"] = {
                "organization_id": req.organization_id or "",
                "plan_id": req.plan_id or "",
            }
        order = client.order.create(data=order_payload)
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "receipt": order.get("receipt", receipt),
        }
    except razorpay.errors.BadRequestError as exc:
        msg = str(exc)
        if "Authentication failed" in msg or "401" in msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
    except Exception as exc:
        msg = str(exc)
        if "Authentication failed" in msg or "401" in msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Razorpay order: {msg}",
        )


def _verify_payment_impl(req: VerifyPaymentRequest, db: Session):
    if not req.razorpay_order_id or not req.razorpay_payment_id or not req.razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
        )

    _, key_secret = _get_razorpay_credentials()

    # Verify HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, req.razorpay_signature.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature. Verification failed.",
        )

    # Activate organization subscription & record payment event if org + plan supplied
    if req.organization_id and req.plan_id:
        org = db.query(Organization).filter(Organization.id == req.organization_id).first()
        plan = db.query(Plan).filter((Plan.id == req.plan_id) | (Plan.code == req.plan_id)).first()
        if org and plan:
            now = datetime.now(timezone.utc)
            org.plan_id = plan.code

            sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
            if sub:
                sub.plan_id = plan.code
                sub.status = "active"
                sub.current_period_start = now
                sub.current_period_end = now + timedelta(days=30)
            else:
                sub = Subscription(
                    organization_id=org.id,
                    plan_id=plan.code,
                    status="active",
                    current_period_start=now,
                    current_period_end=now + timedelta(days=30),
                )
                db.add(sub)

            existing_payment = (
                db.query(PaymentEvent)
                .filter(PaymentEvent.utr_number == req.razorpay_payment_id)
                .first()
            )
            if not existing_payment:
                payment_event = PaymentEvent(
                    organization_id=org.id,
                    plan_id=plan.code,
                    amount_inr=req.amount_inr if req.amount_inr is not None else plan.price_inr,
                    utr_number=req.razorpay_payment_id,
                    payer_vpa="razorpay_web_checkout",
                    status="approved",
                    admin_note=f"Razorpay verified order {req.razorpay_order_id}",
                )
                db.add(payment_event)
            db.commit()

    return {
        "status": "success",
        "verified": True,
        "order_id": req.razorpay_order_id,
        "payment_id": req.razorpay_payment_id,
    }


@router.post("/api/create-order")
def create_order_root(req: CreateOrderRequest):
    return _create_order_impl(req)


@router.post("/api/v1/plans/razorpay/create-order")
def create_order_v1(req: CreateOrderRequest):
    return _create_order_impl(req)


@router.post("/api/verify-payment")
def verify_payment_root(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    return _verify_payment_impl(req, db)


@router.post("/api/v1/plans/razorpay/verify-payment")
def verify_payment_v1(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    return _verify_payment_impl(req, db)
