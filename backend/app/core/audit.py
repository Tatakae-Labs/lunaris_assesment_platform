import json
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models import AuditEvent

def log_audit_event(
    db: Session,
    action: str,
    organization_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditEvent:
    """Helper to record immutable audit events for security and compliance."""
    event = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(event)
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Mirror to local MongoDB audit collection
    try:
        from app.core.mongodb import get_mongodb
        mongo_db = get_mongodb()
        if mongo_db is not None:
            mongo_db.audit_logs.insert_one({
                "organization_id": organization_id,
                "actor_id": actor_id,
                "actor_email": actor_email,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "ip_address": ip_address,
                "metadata": metadata or {},
            })
    except Exception:
        pass

    return event

