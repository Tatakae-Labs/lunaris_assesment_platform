"""
Lunaris Real-Time SQLite <-> MongoDB Synchronization Engine.
Captures all SQLAlchemy ORM lifecycle events (inserts, updates, deletes)
and replicates documents into MongoDB collections in real time.
Also provides bulk migration utilities to hydrate MongoDB on initial startup.
"""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.core.mongodb import upsert_document, delete_document, get_mongodb, get_collection
from app.core.database import Base
from app import models

# JSON fields that should be deserialized into native MongoDB BSON structures
JSON_ATTRIBUTES = {
    "content_json": "content",
    "settings_json": "settings",
    "score_details_json": "score_details",
    "metadata_json": "metadata",
    "answer_json": "answer",
    "snapshot_json": "snapshot",
    "details_json": "details"
}


def model_to_dict(instance: Any) -> Dict[str, Any]:
    """Converts a SQLAlchemy model instance into a clean JSON/BSON-compatible dictionary."""
    data = {}
    try:
        ins = inspect(instance)
        for col in ins.mapper.column_attrs:
            key = col.key
            val = getattr(instance, key, None)
            if isinstance(val, datetime):
                data[key] = val.isoformat()
            else:
                data[key] = val

            # Also provide parsed JSON version for MongoDB document queries
            if key in JSON_ATTRIBUTES and isinstance(val, str) and val.strip():
                try:
                    data[JSON_ATTRIBUTES[key]] = json.loads(val)
                except Exception:
                    pass
    except Exception as exc:
        data = {"id": getattr(instance, "id", None), "sync_error": str(exc)}

    return data


def _sync_insert_handler(mapper, connection, target):
    """Event hook executed after a model instance is inserted."""
    try:
        table_name = getattr(target, "__tablename__", None)
        doc_id = getattr(target, "id", None)
        if table_name and doc_id:
            doc = model_to_dict(target)
            upsert_document(table_name, str(doc_id), doc)
    except Exception as exc:
        print(f"MongoDB real-time insert sync error for {target}: {exc}")


def _sync_update_handler(mapper, connection, target):
    """Event hook executed after a model instance is updated."""
    try:
        table_name = getattr(target, "__tablename__", None)
        doc_id = getattr(target, "id", None)
        if table_name and doc_id:
            doc = model_to_dict(target)
            upsert_document(table_name, str(doc_id), doc)
    except Exception as exc:
        print(f"MongoDB real-time update sync error for {target}: {exc}")


def _sync_delete_handler(mapper, connection, target):
    """Event hook executed after a model instance is deleted."""
    try:
        table_name = getattr(target, "__tablename__", None)
        doc_id = getattr(target, "id", None)
        if table_name and doc_id:
            delete_document(table_name, str(doc_id))
    except Exception as exc:
        print(f"MongoDB real-time delete sync error for {target}: {exc}")


_listeners_attached = False

def attach_mongodb_sync_listeners():
    """Attaches after_insert, after_update, and after_delete hooks to all SQLAlchemy models."""
    global _listeners_attached
    if _listeners_attached:
        return

    # Track all declarative models in Lunaris
    model_classes = [
        models.Organization,
        models.User,
        models.OrganizationMember,
        models.QuestionBank,
        models.Question,
        models.QuestionRevision,
        models.Exam,
        models.ExamVersion,
        models.ExamAssignment,
        models.ExamEnrollment,
        models.CandidateSession,
        models.ExamAttempt,
        models.AttemptAnswer,
        models.ProctorSession,
        models.ProctorEvent,
        models.EvidenceAsset,
        models.ReviewDecision,
        models.AuditEvent,
        models.QuizRoom,
        models.QuizParticipant,
        models.QuizRound,
        models.QuizLeaderboardSnapshot,
        models.QuizResponse,
        models.Plan,
        models.PlanEntitlement,
        models.Subscription,
        models.PaymentEvent,
        models.UsageLedger
    ]

    for cls in model_classes:
        event.listen(cls, "after_insert", _sync_insert_handler)
        event.listen(cls, "after_update", _sync_update_handler)
        event.listen(cls, "after_delete", _sync_delete_handler)

    _listeners_attached = True
    print("[OK] MongoDB real-time CDC sync listeners attached to all Lunaris entities.")


def bulk_sync_sqlite_to_mongodb(db: Session) -> Dict[str, int]:
    """
    Hydrates MongoDB collections with all existing data from SQLite.
    Runs idempotently on startup.
    """
    db_mongo = get_mongodb()
    if db_mongo is None:
        print("MongoDB is offline; skipping initial bulk sync.")
        return {}

    summary = {}
    entities = [
        (models.Organization, "organizations"),
        (models.User, "users"),
        (models.OrganizationMember, "organization_members"),
        (models.QuestionBank, "question_banks"),
        (models.Question, "questions"),
        (models.QuestionRevision, "question_revisions"),
        (models.Exam, "exams"),
        (models.ExamVersion, "exam_versions"),
        (models.ExamAssignment, "exam_assignments"),
        (models.ExamEnrollment, "exam_enrollments"),
        (models.CandidateSession, "candidate_sessions"),
        (models.ExamAttempt, "exam_attempts"),
        (models.AttemptAnswer, "attempt_answers"),
        (models.ProctorSession, "proctor_sessions"),
        (models.ProctorEvent, "proctor_events"),
        (models.EvidenceAsset, "evidence_assets"),
        (models.ReviewDecision, "review_decisions"),
        (models.AuditEvent, "audit_logs"),
        (models.QuizRoom, "quiz_rooms"),
        (models.QuizParticipant, "quiz_participants"),
        (models.Plan, "plans"),
        (models.Subscription, "subscriptions")
    ]

    for model_cls, coll_name in entities:
        try:
            items = db.query(model_cls).all()
            coll = db_mongo[coll_name]
            count = 0
            for item in items:
                doc_id = str(getattr(item, "id", None))
                if doc_id:
                    doc = model_to_dict(item)
                    doc["_id"] = doc_id
                    # Clean up any stale documents that hold the same unique keys under different IDs
                    if coll_name == "users" and doc.get("email"):
                        stale = coll.find_one({"email": doc["email"]})
                        if stale and stale.get("_id") != doc_id:
                            coll.delete_one({"_id": stale["_id"]})
                    elif coll_name == "organizations" and doc.get("slug"):
                        stale = coll.find_one({"slug": doc["slug"]})
                        if stale and stale.get("_id") != doc_id:
                            coll.delete_one({"_id": stale["_id"]})
                    coll.replace_one({"_id": doc_id}, doc, upsert=True)
                    count += 1
            summary[coll_name] = count
        except Exception as exc:
            summary[coll_name] = f"error: {exc}"

    print(f"[OK] MongoDB initial bulk sync completed: {summary}")
    return summary
