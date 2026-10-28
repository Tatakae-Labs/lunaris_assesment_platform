"""
Lunaris MongoDB Connection & Document Management Engine.
Connects to MongoDB instance (mongodb://localhost:27017/lunaris).
Provides document storage, entity syncing, high-throughput proctoring telemetry,
and real-time MongoDB collections across the entire platform.
"""
import time
from typing import Optional, Dict, Any, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.collection import Collection
from app.core.config import settings

_mongo_client: Optional[MongoClient] = None

# Platform Collections
COLLECTIONS = [
    "organizations",
    "users",
    "organization_members",
    "question_banks",
    "questions",
    "question_revisions",
    "exams",
    "exam_versions",
    "exam_enrollments",
    "exam_attempts",
    "attempt_answers",
    "proctor_events",
    "proctor_telemetry",
    "evidence_assets",
    "review_decisions",
    "audit_logs",
    "quiz_rooms",
    "quiz_participants",
    "quiz_responses",
    "plans",
    "usage_ledger",
    "candidate_sessions"
]


def get_mongo_client() -> Optional[MongoClient]:
    """Returns singleton MongoDB client with fail-fast timeouts."""
    global _mongo_client
    if _mongo_client is None:
        try:
            _mongo_client = MongoClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000
            )
            # Test connectivity
            _mongo_client.admin.command("ping")
        except Exception as exc:
            print(f"MongoDB connection notice: {exc}")
            _mongo_client = None
    return _mongo_client


def get_mongodb() -> Optional[Database]:
    """Returns the Lunaris database instance in MongoDB."""
    client = get_mongo_client()
    if client:
        return client[settings.MONGODB_DB_NAME]
    return None


def get_collection(collection_name: str) -> Optional[Collection]:
    """Returns a specific collection from MongoDB."""
    db = get_mongodb()
    if db is not None:
        return db[collection_name]
    return None


def ping_mongodb() -> bool:
    """Verifies that the MongoDB instance is reachable and healthy."""
    try:
        client = get_mongo_client()
        if client:
            client.admin.command("ping")
            return True
    except Exception:
        pass
    return False


def upsert_document(collection_name: str, doc_id: str, doc: Dict[str, Any]) -> bool:
    """Upserts a document into MongoDB with _id = doc_id."""
    coll = get_collection(collection_name)
    if coll is None:
        return False
    try:
        doc_copy = dict(doc)
        doc_copy["_id"] = str(doc_id)
        doc_copy["updated_at_mongo"] = time.time()
        coll.replace_one({"_id": str(doc_id)}, doc_copy, upsert=True)
        return True
    except Exception as exc:
        print(f"MongoDB upsert error in {collection_name} ({doc_id}): {exc}")
        return False


def delete_document(collection_name: str, doc_id: str) -> bool:
    """Deletes a document from MongoDB by _id."""
    coll = get_collection(collection_name)
    if coll is None:
        return False
    try:
        coll.delete_one({"_id": str(doc_id)})
        return True
    except Exception as exc:
        print(f"MongoDB delete error in {collection_name} ({doc_id}): {exc}")
        return False


def find_document(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    """Finds a single document by _id."""
    coll = get_collection(collection_name)
    if coll is None:
        return None
    try:
        return coll.find_one({"_id": str(doc_id)})
    except Exception:
        return None


def init_mongodb_indexes():
    """Ensures optimal query indexes on all core MongoDB collections."""
    db = get_mongodb()
    if db is None:
        return

    try:
        # Users & Orgs
        db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)
        db.organizations.create_index([("slug", ASCENDING)], unique=True, sparse=True)
        db.organization_members.create_index([("organization_id", ASCENDING), ("user_id", ASCENDING)])

        # Exams & Questions
        db.exams.create_index([("organization_id", ASCENDING)])
        db.exams.create_index([("mode", ASCENDING)])
        db.exams.create_index([("room_code", ASCENDING)], sparse=True)
        db.questions.create_index([("organization_id", ASCENDING)])
        db.questions.create_index([("subject", ASCENDING)])

        # Enrollments & Attempts
        db.exam_enrollments.create_index([("exam_id", ASCENDING), ("candidate_uid", ASCENDING)])
        db.exam_enrollments.create_index([("candidate_uid", ASCENDING)])
        db.exam_attempts.create_index([("enrollment_id", ASCENDING)])
        db.exam_attempts.create_index([("status", ASCENDING)])
        db.attempt_answers.create_index([("attempt_id", ASCENDING), ("question_id", ASCENDING)])

        # Proctor Telemetry & Events (TTL / indexed for rapid lookup)
        db.proctor_telemetry.create_index([("attempt_id", ASCENDING)])
        db.proctor_telemetry.create_index([("occurred_at", DESCENDING)])
        db.proctor_events.create_index([("attempt_id", ASCENDING)])

        # Quick Quiz
        db.quiz_rooms.create_index([("room_code", ASCENDING)], unique=True, sparse=True)
        db.quiz_participants.create_index([("room_id", ASCENDING)])

        # Audit Logs
        db.audit_logs.create_index([("organization_id", ASCENDING)])
        db.audit_logs.create_index([("action", ASCENDING)])
    except Exception as exc:
        print(f"MongoDB index initialization notice: {exc}")


def get_mongodb_stats() -> Dict[str, Any]:
    """Returns detailed statistics and collection counts for Lunaris MongoDB."""
    db = get_mongodb()
    if db is None:
        return {
            "status": "offline",
            "url": settings.MONGODB_URL,
            "database": settings.MONGODB_DB_NAME,
            "collections": {}
        }

    stats = {}
    total_docs = 0
    start = time.time()
    try:
        db.command("ping")
        latency_ms = round((time.time() - start) * 1000, 2)
        coll_names = db.list_collection_names()

        for cname in sorted(coll_names):
            if cname.startswith("system."):
                continue
            count = db[cname].count_documents({})
            stats[cname] = count
            total_docs += count

        return {
            "status": "connected",
            "url": settings.MONGODB_URL,
            "database": settings.MONGODB_DB_NAME,
            "latency_ms": latency_ms,
            "total_documents": total_docs,
            "collections_count": len(stats),
            "collections": stats
        }
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
            "url": settings.MONGODB_URL,
            "database": settings.MONGODB_DB_NAME
        }
