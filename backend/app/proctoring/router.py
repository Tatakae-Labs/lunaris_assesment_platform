import os
import json
import time
import base64
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db, generate_uuid
from app.auth.router import get_current_user
from app.models import User, Organization, OrganizationMember, ExamAttempt, ProctorEvent, EvidenceAsset, ReviewDecision
from app.evidence.storage import StorageService
from app.proctoring.stream_hub import stream_hub

router = APIRouter(prefix="/proctor", tags=["Remote Proctoring"])

class ProctorEventIngestRequest(BaseModel):
    event_type: str  # tab_switch, fullscreen_exit, audio_spike, multiple_faces, face_missing, prohibited_object
    severity: str = "advisory"  # advisory, suspicious, high
    metadata: Optional[Dict[str, Any]] = None
    snapshot_base64: Optional[str] = None

class ReviewDecisionRequest(BaseModel):
    decision: str  # dismissed, confirmed_violation, inconclusive
    reason: Optional[str] = None

@router.post("/attempts/{attempt_id}/events")
def ingest_proctor_event(
    attempt_id: str,
    req: ProctorEventIngestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.id == attempt_id,
        ExamAttempt.candidate_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    event = ProctorEvent(
        attempt_id=attempt.id,
        event_type=req.event_type,
        severity=req.severity,
        metadata_json=json.dumps(req.metadata or {}),
        occurred_at=datetime.now(timezone.utc)
    )
    db.add(event)
    db.flush()

    if req.snapshot_base64:
        storage_key = StorageService.save_base64_snapshot(req.snapshot_base64, prefix=f"evt_{event.id[:8]}")
        if storage_key:
            asset = EvidenceAsset(
                event_id=event.id,
                storage_key=storage_key,
                mime_type="image/jpeg"
            )
            db.add(asset)

    db.commit()
    return {"status": "logged", "event_id": event.id, "severity": event.severity}

@router.get("/sessions")
def list_proctor_sessions(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    target_org_id = org.id if org else organization_id

    # Verify user has proctor/admin/owner role
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == target_org_id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role.in_(["owner", "admin", "proctor"])
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Insufficient proctoring permissions")

    attempts = (
        db.query(ExamAttempt)
        .outerjoin(User, ExamAttempt.candidate_id == User.id)
        .filter(ExamAttempt.organization_id == target_org_id)
        .order_by(ExamAttempt.started_at.desc())
        .limit(50)
        .all()
    )

    if not attempts:
        return []

    attempt_ids = [att.id for att in attempts]
    from sqlalchemy import func, case

    # Batch query incident counts across all attempts in a single query
    counts_rows = (
        db.query(
            ProctorEvent.attempt_id,
            func.count(ProctorEvent.id).label("total_incidents"),
            func.sum(case((ProctorEvent.severity.in_(["suspicious", "high"]), 1), else_=0)).label("critical_incidents")
        )
        .filter(
            ProctorEvent.attempt_id.in_(attempt_ids),
            ProctorEvent.event_type != "cctv_frame"
        )
        .group_by(ProctorEvent.attempt_id)
        .all()
    )
    counts_map = {r[0]: (r[1] or 0, r[2] or 0) for r in counts_rows}

    # Batch query latest proctor events
    latest_events = (
        db.query(ProctorEvent)
        .filter(
            ProctorEvent.attempt_id.in_(attempt_ids),
            ProctorEvent.event_type != "cctv_frame"
        )
        .order_by(ProctorEvent.occurred_at.desc())
        .all()
    )
    latest_event_map = {}
    for ev in latest_events:
        if ev.attempt_id not in latest_event_map:
            latest_event_map[ev.attempt_id] = ev

    # Batch query latest evidence assets
    latest_evidences = (
        db.query(EvidenceAsset, ProctorEvent.attempt_id)
        .join(ProctorEvent, EvidenceAsset.event_id == ProctorEvent.id)
        .filter(ProctorEvent.attempt_id.in_(attempt_ids))
        .order_by(ProctorEvent.occurred_at.desc())
        .all()
    )
    latest_evidence_map = {}
    for asset, att_id in latest_evidences:
        if att_id not in latest_evidence_map:
            latest_evidence_map[att_id] = asset

    # Batch check MongoDB live_frames for cross-container live CCTV status
    mongo_live_map = {}
    try:
        from app.core.mongodb import get_collection
        live_coll = get_collection("live_frames")
        if live_coll is not None:
            for doc in live_coll.find({"_id": {"$in": attempt_ids}}, {"_id": 1, "updated_at": 1}):
                mongo_live_map[doc["_id"]] = doc.get("updated_at", 0)
    except Exception:
        pass

    results = []
    for att in attempts:
        event_count, high_severity_count = counts_map.get(att.id, (0, 0))
        latest_event = latest_event_map.get(att.id)
        latest_evidence = latest_evidence_map.get(att.id)

        is_camera_live = False
        latest_frame_time = None
        mongo_ts = mongo_live_map.get(att.id, 0)
        if stream_hub.is_stream_live(att.id):
            is_camera_live = True
            last_t = stream_hub.get_last_frame_time(att.id)
            if last_t > 0:
                latest_frame_time = datetime.fromtimestamp(last_t, tz=timezone.utc).isoformat()
        elif mongo_ts and (time.time() - mongo_ts) < 20:
            is_camera_live = True
            latest_frame_time = datetime.fromtimestamp(mongo_ts, tz=timezone.utc).isoformat()
        elif latest_evidence and latest_evidence.created_at:
            latest_frame_time = latest_evidence.created_at.isoformat()
            # If a frame was received within the last 60 seconds and attempt is in progress
            frame_age = (datetime.now(timezone.utc) - (latest_evidence.created_at.replace(tzinfo=timezone.utc) if latest_evidence.created_at.tzinfo is None else latest_evidence.created_at)).total_seconds()
            if frame_age < 60 and att.status == "in_progress":
                is_camera_live = True

        results.append({
            "attempt_id": att.id,
            "candidate_name": att.candidate_name or (att.candidate.full_name if att.candidate else "Enrolled Candidate"),
            "candidate_email": att.candidate_identifier or (att.candidate.email if att.candidate else "UID Access"),
            "status": att.status,
            "started_at": att.started_at.isoformat() if att.started_at else None,
            "deadline_at": att.deadline_at.isoformat() if att.deadline_at else None,
            "total_incidents": event_count,
            "critical_incidents": high_severity_count,
            "latest_event_type": latest_event.event_type if latest_event else None,
            "latest_event_time": latest_event.occurred_at.isoformat() if latest_event else None,
            "latest_snapshot_id": latest_evidence.id if latest_evidence else None,
            "latest_frame_time": latest_frame_time,
            "camera_live": is_camera_live,
            "live_stream_url": f"/api/v1/proctor/attempts/{att.id}/live-stream"
        })

    return results

@router.get("/attempts/{attempt_id}/live-stream")
async def stream_candidate_live_video(
    attempt_id: str,
    db: Session = Depends(get_db)
):
    """
    Continuous real-time Motion-JPEG live video stream for CCTV surveillance wall.
    Provides ~15-20 FPS continuous video streaming directly to any <img> or <video> element.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if os.environ.get("VERCEL"):
        return get_attempt_latest_frame(attempt_id, db)

    return StreamingResponse(
        stream_hub.generate_mjpeg_stream(attempt_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive"
        }
    )

@router.websocket("/ws/stream/{attempt_id}")
async def proctor_live_stream_websocket(
    websocket: WebSocket,
    attempt_id: str,
    role: str = "proctor"
):
    """
    Real-time sub-50ms WebSocket video frame streaming (720p 30fps) and WebRTC signaling exchange.
    role: 'candidate' (publishes webcam video frames) | 'proctor' (receives live CCTV stream)
    """
    await websocket.accept()

    # Resolve candidate session token to attempt_id if necessary
    target_ids = [attempt_id]
    try:
        from app.core.database import SessionLocal
        from app.models import CandidateSession
        db = SessionLocal()
        sess = db.query(CandidateSession).filter(CandidateSession.session_token == attempt_id).first()
        if sess and sess.attempt_id and sess.attempt_id != attempt_id:
            target_ids.append(sess.attempt_id)
        db.close()
    except Exception:
        pass

    if role == "candidate":
        for tid in target_ids:
            stream_hub.register_candidate_ws(tid, websocket)
        try:
            while True:
                message = await websocket.receive()
                frame_bytes = None
                if "bytes" in message and message["bytes"]:
                    frame_bytes = message["bytes"]
                elif "text" in message and message["text"]:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")
                    if msg_type == "frame" and data.get("frame_base64"):
                        raw_b64 = data["frame_base64"]
                        if "," in raw_b64:
                            raw_b64 = raw_b64.split(",")[1]
                        frame_bytes = base64.b64decode(raw_b64)
                    elif msg_type == "webrtc_signal":
                        for tid in target_ids:
                            await stream_hub.relay_webrtc_signal(tid, "candidate", data.get("payload", {}))

                if frame_bytes:
                    for tid in target_ids:
                        stream_hub.update_frame(tid, frame_bytes)
        except WebSocketDisconnect:
            for tid in target_ids:
                stream_hub.remove_candidate_ws(tid)
        except Exception:
            for tid in target_ids:
                stream_hub.remove_candidate_ws(tid)
    else:
        stream_hub.add_proctor_subscriber(attempt_id, websocket)
        try:
            init_frame = stream_hub.get_latest_frame(attempt_id)
            if init_frame:
                await websocket.send_bytes(init_frame)

            while True:
                message = await websocket.receive()
                if "text" in message and message["text"]:
                    data = json.loads(message["text"])
                    if data.get("type") == "webrtc_signal":
                        await stream_hub.relay_webrtc_signal(attempt_id, "proctor", data.get("payload", {}))
        except WebSocketDisconnect:
            stream_hub.remove_proctor_subscriber(attempt_id, websocket)
        except Exception:
            stream_hub.remove_proctor_subscriber(attempt_id, websocket)

@router.get("/attempts/{attempt_id}/latest-frame")
def get_attempt_latest_frame(
    attempt_id: str,
    db: Session = Depends(get_db)
):
    """Returns the latest CCTV webcam snapshot image directly for streaming feeds."""
    # First check live in-memory frame buffer
    live_frame = stream_hub.get_latest_frame(attempt_id)
    if live_frame:
        return Response(
            content=live_frame,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )

    # Next check MongoDB live_frames (for stateless serverless containers)
    try:
        from app.core.mongodb import get_collection
        live_coll = get_collection("live_frames")
        if live_coll is not None:
            doc = live_coll.find_one({"_id": attempt_id})
            if doc and doc.get("frame_b64"):
                frame_bytes = base64.b64decode(doc["frame_b64"])
                return Response(
                    content=frame_bytes,
                    media_type="image/jpeg",
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
                )
    except Exception:
        pass

    latest_evidence = (
        db.query(EvidenceAsset)
        .join(ProctorEvent, EvidenceAsset.event_id == ProctorEvent.id)
        .filter(ProctorEvent.attempt_id == attempt_id)
        .order_by(ProctorEvent.occurred_at.desc())
        .first()
    )
    if not latest_evidence:
        raise HTTPException(status_code=404, detail="No camera frames recorded for this attempt")

    image_bytes = StorageService.get_snapshot_bytes(latest_evidence.storage_key)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="Frame data expired or unavailable")

    return Response(
        content=image_bytes,
        media_type=latest_evidence.mime_type or "image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

class ProctorWarningRequest(BaseModel):
    warning_type: str = "general_warning"
    message: str

@router.post("/attempts/{attempt_id}/send-warning")
def send_proctor_warning_to_candidate(
    attempt_id: str,
    req: ProctorWarningRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows proctors to send real-time intervention warnings directly to candidate screen."""
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    warning_event = ProctorEvent(
        attempt_id=attempt.id,
        event_type="proctor_warning_issued",
        severity="high",
        metadata_json=json.dumps({
            "reviewer_id": current_user.id,
            "reviewer_name": current_user.full_name or "Official Proctor",
            "warning_type": req.warning_type,
            "message": req.message
        }),
        occurred_at=datetime.now(timezone.utc)
    )
    db.add(warning_event)
    db.commit()
    return {"status": "dispatched", "message": req.message}

@router.get("/attempts/{attempt_id}/timeline")
def get_attempt_incident_timeline(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    events = db.query(ProctorEvent).filter(
        ProctorEvent.attempt_id == attempt.id,
        ProctorEvent.event_type != "cctv_frame"
    ).order_by(ProctorEvent.occurred_at.asc()).all()

    timeline = []
    for ev in events:
        evidence = db.query(EvidenceAsset).filter(EvidenceAsset.event_id == ev.id).first()
        review = db.query(ReviewDecision).filter(ReviewDecision.event_id == ev.id).first()

        timeline.append({
            "event_id": ev.id,
            "event_type": ev.event_type,
            "severity": ev.severity,
            "metadata": json.loads(ev.metadata_json) if ev.metadata_json else {},
            "occurred_at": ev.occurred_at.isoformat(),
            "has_evidence": evidence is not None,
            "evidence_asset_id": evidence.id if evidence else None,
            "review": {
                "decision": review.decision,
                "reason": review.reason,
                "reviewed_at": review.reviewed_at.isoformat()
            } if review else None
        })

    return {"attempt_id": attempt.id, "timeline": timeline}

@router.get("/evidence/{asset_id}")
def get_evidence_image(
    asset_id: str,
    db: Session = Depends(get_db)
):
    asset = db.query(EvidenceAsset).filter(EvidenceAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Evidence asset not found")

    image_bytes = StorageService.get_snapshot_bytes(asset.storage_key)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="Evidence file missing or expired")

    return Response(content=image_bytes, media_type=asset.mime_type)

@router.post("/events/{event_id}/review")
def review_event(
    event_id: str,
    req: ReviewDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(ProctorEvent).filter(ProctorEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing_review = db.query(ReviewDecision).filter(ReviewDecision.event_id == event.id).first()
    if existing_review:
        existing_review.decision = req.decision
        existing_review.reason = req.reason
        existing_review.reviewer_id = current_user.id
        existing_review.reviewed_at = datetime.now(timezone.utc)
    else:
        new_review = ReviewDecision(
            event_id=event.id,
            reviewer_id=current_user.id,
            decision=req.decision,
            reason=req.reason
        )
        db.add(new_review)

    db.commit()
    return {"message": "Review recorded successfully", "decision": req.decision}


class CreateAppealRequest(BaseModel):
    attempt_id: str
    event_id: Optional[str] = None
    candidate_identifier: Optional[str] = None
    reason: str


class ResolveAppealRequest(BaseModel):
    decision: str  # accepted, rejected
    reviewer_notes: Optional[str] = None


@router.post("/appeals")
def create_appeal(
    req: CreateAppealRequest,
    db: Session = Depends(get_db)
):
    """Candidate submits an appeal against a suspicious/flagged proctoring event (Phase 5)."""
    from app.models import Appeal
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == req.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    appeal = Appeal(
        organization_id=attempt.organization_id,
        attempt_id=attempt.id,
        event_id=req.event_id,
        candidate_identifier=req.candidate_identifier or attempt.candidate_identifier or "Candidate",
        reason=req.reason,
        status="pending"
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return {"status": "submitted", "appeal_id": appeal.id, "message": "Appeal recorded for proctor review"}


@router.get("/appeals")
def list_appeals(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Proctors view pending and resolved appeals for their organization."""
    from app.models import Appeal
    org = db.query(Organization).filter((Organization.id == organization_id) | (Organization.slug == organization_id)).first()
    target_org_id = org.id if org else organization_id

    appeals = db.query(Appeal).filter(Appeal.organization_id == target_org_id).order_by(Appeal.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "attempt_id": a.attempt_id,
            "event_id": a.event_id,
            "candidate_identifier": a.candidate_identifier,
            "reason": a.reason,
            "status": a.status,
            "reviewer_notes": a.reviewer_notes,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None
        }
        for a in appeals
    ]


@router.put("/appeals/{appeal_id}/resolve")
def resolve_appeal(
    appeal_id: str,
    req: ResolveAppealRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Proctor/Administrator accepts or rejects candidate appeal."""
    from app.models import Appeal
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    appeal.status = req.decision
    appeal.reviewer_notes = req.reviewer_notes
    appeal.resolved_by = current_user.id
    appeal.resolved_at = datetime.now(timezone.utc)

    # If appeal is accepted and linked to an event, mark review as dismissed
    if req.decision == "accepted" and appeal.event_id:
        rev = db.query(ReviewDecision).filter(ReviewDecision.event_id == appeal.event_id).first()
        if rev:
            rev.decision = "dismissed"
            rev.reason = f"Appeal accepted: {req.reviewer_notes}"
        else:
            db.add(ReviewDecision(
                event_id=appeal.event_id,
                reviewer_id=current_user.id,
                decision="dismissed",
                reason=f"Appeal accepted: {req.reviewer_notes}"
            ))

    db.commit()
    return {"message": f"Appeal marked as {req.decision}", "appeal_id": appeal.id, "status": appeal.status}

