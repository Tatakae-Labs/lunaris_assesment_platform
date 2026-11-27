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
    "details_json": "details",
    "sections_json": "sections",
    "rules_json": "rules",
    "sections_data_json": "sections_data",
    "sets_data_json": "sets_data"
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


_listeners_attached = False
_hydrating_from_mongo = False

def _sync_insert_handler(mapper, connection, target):
    """Event hook executed after a model instance is inserted."""
    if _hydrating_from_mongo:
        return
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
    if _hydrating_from_mongo:
        return
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
    if _hydrating_from_mongo:
        return
    try:
        table_name = getattr(target, "__tablename__", None)
        doc_id = getattr(target, "id", None)
        if table_name and doc_id:
            delete_document(table_name, str(doc_id))
    except Exception as exc:
        print(f"MongoDB real-time delete sync error for {target}: {exc}")


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


# Backwards compatibility alias
bulk_sync_sql_to_mongodb = bulk_sync_sqlite_to_mongodb


def _deserialize_doc_for_model(model_cls: Any, doc: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts and converts MongoDB document fields matching the SQLAlchemy model columns."""
    from sqlalchemy import DateTime
    mapper = inspect(model_cls).mapper
    kwargs = {}
    for col in mapper.columns:
        key = col.key
        if key not in doc:
            continue
        val = doc[key]
        if isinstance(col.type, DateTime) and isinstance(val, str):
            try:
                val = datetime.fromisoformat(val)
            except Exception:
                val = None
        kwargs[key] = val
    return kwargs


def hydrate_sqlite_from_mongodb(db: Session) -> Dict[str, int]:
    """
    Pulls persisted documents from MongoDB into local SQLite on serverless cold start
    so stateless containers share all users, organizations, exams, and payments.
    """
    global _hydrating_from_mongo
    db_mongo = get_mongodb()
    if db_mongo is None:
        return {}

    entities = [
        (models.Plan, "plans"),
        (models.Organization, "organizations"),
        (models.User, "users"),
        (models.OrganizationMember, "organization_members"),
        (models.Subscription, "subscriptions"),
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
    ]

    summary = {}
    _hydrating_from_mongo = True
    try:
        for model_cls, coll_name in entities:
            try:
                coll = db_mongo[coll_name]
                docs = list(coll.find({}))
                count = 0
                for doc in docs:
                    kwargs = _deserialize_doc_for_model(model_cls, doc)
                    if kwargs.get("id"):
                        db.merge(model_cls(**kwargs))
                        count += 1
                if count:
                    db.commit()
                summary[coll_name] = count
            except Exception as exc:
                db.rollback()
                summary[coll_name] = f"error: {exc}"
    finally:
        _hydrating_from_mongo = False

    print(f"[OK] Hydrated local DB from MongoDB: {summary}")
    return summary


def hydrate_user_context_from_mongodb(db: Session, user_id: str):
    """
    On-demand fallback when a warm serverless container receives a valid JWT
    for a user created on another container: fetches the user & their orgs from MongoDB.
    """
    global _hydrating_from_mongo
    db_mongo = get_mongodb()
    if db_mongo is None:
        return None

    _hydrating_from_mongo = True
    try:
        user_doc = db_mongo.users.find_one({"_id": str(user_id)}) or db_mongo.users.find_one({"id": str(user_id)})
        if not user_doc:
            return None

        user_kwargs = _deserialize_doc_for_model(models.User, user_doc)
        user_obj = db.merge(models.User(**user_kwargs))

        # Pull memberships & organizations for this user
        memberships = list(db_mongo.organization_members.find({"user_id": str(user_id)}))
        org_ids = []
        for m_doc in memberships:
            m_kwargs = _deserialize_doc_for_model(models.OrganizationMember, m_doc)
            if m_kwargs.get("id"):
                db.merge(models.OrganizationMember(**m_kwargs))
            if m_kwargs.get("organization_id"):
                org_ids.append(m_kwargs["organization_id"])

        for oid in set(org_ids):
            org_doc = db_mongo.organizations.find_one({"_id": str(oid)}) or db_mongo.organizations.find_one({"id": str(oid)})
            if org_doc:
                db.merge(models.Organization(**_deserialize_doc_for_model(models.Organization, org_doc)))
            for sub_doc in db_mongo.subscriptions.find({"organization_id": str(oid)}):
                db.merge(models.Subscription(**_deserialize_doc_for_model(models.Subscription, sub_doc)))
            for pay_doc in db_mongo.payment_events.find({"organization_id": str(oid)}):
                db.merge(models.PaymentEvent(**_deserialize_doc_for_model(models.PaymentEvent, pay_doc)))
            for exam_doc in db_mongo.exams.find({"organization_id": str(oid)}):
                db.merge(models.Exam(**_deserialize_doc_for_model(models.Exam, exam_doc)))

        db.commit()
        return user_obj
    except Exception as exc:
        db.rollback()
        print(f"On-demand MongoDB user hydration error: {exc}")
        return None
    finally:
        _hydrating_from_mongo = False


def hydrate_candidate_session_from_mongodb(db: Session, token: str):
    """
    On-demand fallback when a warm serverless container receives a valid candidate
    session_token created on another container: pulls CandidateSession, Enrollment,
    Exam, Versions, Questions, and Attempts from MongoDB.
    """
    global _hydrating_from_mongo
    db_mongo = get_mongodb()
    if db_mongo is None:
        return None

    _hydrating_from_mongo = True
    try:
        sess_doc = db_mongo.candidate_sessions.find_one({"session_token": str(token), "is_active": True})
        if not sess_doc:
            return None

        sess_obj = db.merge(models.CandidateSession(**_deserialize_doc_for_model(models.CandidateSession, sess_doc)))

        enrollment_id = sess_doc.get("enrollment_id")
        if enrollment_id:
            enr_doc = db_mongo.exam_enrollments.find_one({"_id": str(enrollment_id)}) or db_mongo.exam_enrollments.find_one({"id": str(enrollment_id)})
            if enr_doc:
                db.merge(models.ExamEnrollment(**_deserialize_doc_for_model(models.ExamEnrollment, enr_doc)))
                exam_id = enr_doc.get("exam_id")
                org_id = enr_doc.get("organization_id")
                if exam_id:
                    exam_doc = db_mongo.exams.find_one({"_id": str(exam_id)}) or db_mongo.exams.find_one({"id": str(exam_id)})
                    if exam_doc:
                        db.merge(models.Exam(**_deserialize_doc_for_model(models.Exam, exam_doc)))
                        org_id = org_id or exam_doc.get("organization_id")
                    for ver_doc in db_mongo.exam_versions.find({"exam_id": str(exam_id)}):
                        db.merge(models.ExamVersion(**_deserialize_doc_for_model(models.ExamVersion, ver_doc)))
                if org_id:
                    org_doc = db_mongo.organizations.find_one({"_id": str(org_id)}) or db_mongo.organizations.find_one({"id": str(org_id)})
                    if org_doc:
                        db.merge(models.Organization(**_deserialize_doc_for_model(models.Organization, org_doc)))
                    for q_doc in db_mongo.questions.find({"organization_id": str(org_id)}):
                        db.merge(models.Question(**_deserialize_doc_for_model(models.Question, q_doc)))
                for att_doc in db_mongo.exam_attempts.find({"enrollment_id": str(enrollment_id)}):
                    db.merge(models.ExamAttempt(**_deserialize_doc_for_model(models.ExamAttempt, att_doc)))
                    att_id = att_doc.get("id") or att_doc.get("_id")
                    if att_id:
                        for ans_doc in db_mongo.attempt_answers.find({"attempt_id": str(att_id)}):
                            db.merge(models.AttemptAnswer(**_deserialize_doc_for_model(models.AttemptAnswer, ans_doc)))

        db.commit()
        return sess_obj
    except Exception as exc:
        db.rollback()
        print(f"On-demand MongoDB candidate session hydration error: {exc}")
        return None
    finally:
        _hydrating_from_mongo = False


def hydrate_exam_access_from_mongodb(db: Session, exam_slug: str, candidate_uid: str):
    """
    Pulls matching Exam, ExamVersion, and ExamEnrollment from MongoDB when a student
    verifies access on a different serverless container than the instructor used.
    """
    global _hydrating_from_mongo
    db_mongo = get_mongodb()
    if db_mongo is None:
        return

    _hydrating_from_mongo = True
    try:
        uid_clean = (candidate_uid or "").strip().upper()
        enr_docs = list(db_mongo.exam_enrollments.find({"candidate_uid": uid_clean}))
        exam_ids = set()
        org_ids = set()
        for enr_doc in enr_docs:
            db.merge(models.ExamEnrollment(**_deserialize_doc_for_model(models.ExamEnrollment, enr_doc)))
            if enr_doc.get("exam_id"):
                exam_ids.add(enr_doc["exam_id"])
            if enr_doc.get("organization_id"):
                org_ids.add(enr_doc["organization_id"])

        slug_str = (exam_slug or "").strip()
        for exam_doc in db_mongo.exams.find({"$or": [{"_id": slug_str}, {"id": slug_str}, {"room_code": slug_str}]}):
            db.merge(models.Exam(**_deserialize_doc_for_model(models.Exam, exam_doc)))
            eid = exam_doc.get("id") or exam_doc.get("_id")
            if eid:
                exam_ids.add(eid)
            if exam_doc.get("organization_id"):
                org_ids.add(exam_doc["organization_id"])

        for eid in exam_ids:
            exam_doc = db_mongo.exams.find_one({"_id": str(eid)}) or db_mongo.exams.find_one({"id": str(eid)})
            if exam_doc:
                db.merge(models.Exam(**_deserialize_doc_for_model(models.Exam, exam_doc)))
            for ver_doc in db_mongo.exam_versions.find({"exam_id": str(eid)}):
                db.merge(models.ExamVersion(**_deserialize_doc_for_model(models.ExamVersion, ver_doc)))

        for oid in org_ids:
            org_doc = db_mongo.organizations.find_one({"_id": str(oid)}) or db_mongo.organizations.find_one({"id": str(oid)})
            if org_doc:
                db.merge(models.Organization(**_deserialize_doc_for_model(models.Organization, org_doc)))

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"On-demand MongoDB exam access hydration error: {exc}")
    finally:
        _hydrating_from_mongo = False
