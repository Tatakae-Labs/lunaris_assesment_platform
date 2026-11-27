import json
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import engine, Base, get_db
from app.models import User, Organization, OrganizationMember, Question, Exam, ExamVersion, ExamAssignment
from app.core.security import get_password_hash, get_current_user
from app.auth.router import router as auth_router
from app.organizations.router import router as org_router
from app.question_bank.router import router as question_router
from app.exams.router import router as exam_router
from app.attempts.router import router as attempt_router
from app.proctoring.router import router as proctor_router
from app.reports.router import router as reports_router
from app.quick_quiz.router import router as quick_quiz_router
from app.ai_generation.router import router as ai_router
from app.plans.router import router as plans_router, ensure_plans_seeded
from app.plans.razorpay_router import router as razorpay_router
from app.candidate.router import router as candidate_router
from app.platform.router import router as platform_router, ensure_superadmin_seeded
from app.coding.router import router as coding_router
from app.integrations.classroom_router import router as classroom_router
from app.templates.router import router as templates_router
from app.paper_studio.router import router as paper_studio_router

# Initialize tables and auto-migrate schema
try:
    Base.metadata.create_all(bind=engine)
    from app.core.database import auto_migrate_sqlite, checkpoint_sqlite, SessionLocal
    auto_migrate_sqlite(engine)
    checkpoint_sqlite(engine)
except Exception as _schema_exc:
    print(f"Startup database initialization warning: {_schema_exc}")
from app.core.database import SessionLocal

try:
    with SessionLocal() as _db_init:
        ensure_plans_seeded(_db_init)
        ensure_superadmin_seeded(_db_init)
except Exception as _seed_exc:
    print(f"Startup superadmin/plan seed note: {_seed_exc}")

# Initialize MongoDB Engine, Collections, Indexes, and Real-Time CDC Replication
from app.core.mongodb import init_mongodb_indexes
from app.core.mongo_sync import (
    attach_mongodb_sync_listeners,
    bulk_sync_sqlite_to_mongodb,
    hydrate_sqlite_from_mongodb,
)
init_mongodb_indexes()

try:
    with SessionLocal() as _db_sync:
        hydrate_sqlite_from_mongodb(_db_sync)
except Exception as _hydrate_exc:
    print(f"MongoDB startup hydration warning: {_hydrate_exc}")

attach_mongodb_sync_listeners()

try:
    with SessionLocal() as _db_sync:
        bulk_sync_sqlite_to_mongodb(_db_sync)
except Exception as _sync_exc:
    print(f"MongoDB startup bulk sync warning: {_sync_exc}")

app = FastAPI(
    title="Lunaris Assessment Platform API",
    description="Multi-Tenant Computer-Based Assessment & Proctored Examination Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://lunarisedu.tatakaelabs.tech",
        "https://tatakaelabs.tech",
        "https://lunarisbuild.vercel.app",
        "https://lunaris-assesment-platform.vercel.app",
    ],
    allow_origin_regex=r"^https?://([a-zA-Z0-9-]+\.)*(tatakaelabs\.tech|vercel\.app|localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount Modular Monolith Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
app.include_router(question_router, prefix="/api/v1")
app.include_router(exam_router, prefix="/api/v1")
app.include_router(attempt_router, prefix="/api/v1")
app.include_router(proctor_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(quick_quiz_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(plans_router, prefix="/api/v1")
app.include_router(razorpay_router)
app.include_router(candidate_router, prefix="/api/v1")
app.include_router(platform_router, prefix="/api/v1")
app.include_router(coding_router, prefix="/api/v1")
app.include_router(classroom_router, prefix="/api/v1")
app.include_router(templates_router, prefix="/api/v1")
app.include_router(paper_studio_router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "service": "Lunaris Assessment Platform API",
        "version": "1.0.0",
        "status": "online",
    }

@app.get("/health/live")
def liveness():
    """Liveness probe — returns 200 if the process is running."""
    return {"status": "alive"}

@app.get("/health/ready")
def readiness(db: Session = Depends(get_db)):
    """Readiness probe — verifies DB and MongoDB connectivity and collection stats."""
    from app.core.mongodb import ping_mongodb, get_mongodb_stats
    mongo_ok = ping_mongodb()
    mongo_stats = get_mongodb_stats() if mongo_ok else {}
    try:
        db.execute(__import__('sqlalchemy').text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "mongodb": {
                "status": "connected" if mongo_ok else "offline",
                "database": mongo_stats.get("database", "lunaris"),
                "latency_ms": mongo_stats.get("latency_ms"),
                "total_documents": mongo_stats.get("total_documents", 0),
                "collections_count": mongo_stats.get("collections_count", 0)
            }
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {exc}"
        )

# Legacy health alias
@app.get("/health")
def health(db: Session = Depends(get_db)):
    from app.core.mongodb import ping_mongodb, get_mongodb_stats
    mongo_ok = ping_mongodb()
    mongo_stats = get_mongodb_stats() if mongo_ok else {}
    try:
        db.execute(__import__('sqlalchemy').text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "mongodb": {
                "status": "connected" if mongo_ok else "offline",
                "database": mongo_stats.get("database", "lunaris"),
                "latency_ms": mongo_stats.get("latency_ms"),
                "total_documents": mongo_stats.get("total_documents", 0),
                "collections_count": mongo_stats.get("collections_count", 0),
                "collections": mongo_stats.get("collections", {})
            }
        }
    except Exception:
        return {"status": "degraded", "database": "disconnected"}

@app.post("/api/v1/seed/demo-exam")
def seed_demo_assessment_exam(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Seeds a ready-to-take institutional assessment exam. Requires superadmin + ENABLE_DEMO_SEED=True."""
    if not settings.ENABLE_DEMO_SEED:
        raise HTTPException(status_code=403, detail="Demo seed is disabled in this environment")
    if not current_user.is_superadmin and not current_user.email.startswith("superadmin"):
        raise HTTPException(status_code=403, detail="Superadmin access required")
    # Check if demo org already exists
    org = db.query(Organization).filter(Organization.slug == "polaris-tech-mock").first()
    if not org:
        org = Organization(name="Polaris Institute of Technology", slug="polaris-tech-mock")
        db.add(org)
        db.flush()

    # Create Demo Admin/Author
    admin_user = db.query(User).filter(User.email == "faculty@polaris.edu").first()
    if not admin_user:
        admin_user = User(
            email="faculty@polaris.edu",
            password_hash=get_password_hash("Password123!"),
            full_name="Prof. Sharma (Dean of Academics)"
        )
        db.add(admin_user)
        db.flush()

        member = OrganizationMember(organization_id=org.id, user_id=admin_user.id, role="owner")
        db.add(member)

    # Create Demo Candidate
    candidate = db.query(User).filter(User.email == "candidate@lunaris.org").first()
    if not candidate:
        candidate = User(
            email="candidate@lunaris.org",
            password_hash=get_password_hash("Candidate123!"),
            full_name="Aarav Sharma (AIR Aspirant)"
        )
        db.add(candidate)
        db.flush()

        cand_member = OrganizationMember(organization_id=org.id, user_id=candidate.id, role="candidate")
        db.add(cand_member)

    # Check if Exam already exists
    exam = db.query(Exam).filter(Exam.organization_id == org.id, Exam.title == "Comprehensive Midterm Assessment (Paper 1)").first()
    if not exam:
        # Seed Questions (Physics, Chemistry, Mathematics)
        q_data = [
            # Physics Single MCQ
            {
                "subject": "Physics",
                "type": "single_mcq",
                "content": {
                    "text": "A particle moves in a circle of radius R with constant speed v. What is the magnitude of average acceleration during half a revolution?",
                    "options": [
                        {"id": "p1_a", "text": "2v² / (πR)"},
                        {"id": "p1_b", "text": "v² / R"},
                        {"id": "p1_c", "text": "πv² / (2R)"},
                        {"id": "p1_d", "text": "Zero"}
                    ],
                    "correct_option_id": "p1_a"
                }
            },
            # Physics NVQ
            {
                "subject": "Physics",
                "type": "numerical",
                "content": {
                    "text": "A block of mass 2 kg is placed on a rough horizontal surface with coefficient of friction μ = 0.2. Find the minimum force (in Newtons) required to slide the block along the surface (g = 9.8 m/s²). Round to 2 decimals.",
                    "numerical_answer": 3.92,
                    "tolerance": 0.05
                }
            },
            # Chemistry Single MCQ
            {
                "subject": "Chemistry",
                "type": "single_mcq",
                "content": {
                    "text": "Which among the following orbitals has the highest number of radial nodes?",
                    "options": [
                        {"id": "c1_a", "text": "4p"},
                        {"id": "c1_b", "text": "5s"},
                        {"id": "c1_c", "text": "3d"},
                        {"id": "c1_d", "text": "6f"}
                    ],
                    "correct_option_id": "c1_b"
                }
            },
            # Chemistry NVQ
            {
                "subject": "Chemistry",
                "type": "numerical",
                "content": {
                    "text": "Calculate the pH of a 0.001 M aqueous solution of strong monoprotic acid HCl at 25°C.",
                    "numerical_answer": 3.0,
                    "tolerance": 0.01
                }
            },
            # Mathematics Single MCQ
            {
                "subject": "Mathematics",
                "type": "single_mcq",
                "content": {
                    "text": "Evaluate the limit: lim(x -> 0) [sin(5x) / tan(2x)].",
                    "options": [
                        {"id": "m1_a", "text": "5/2"},
                        {"id": "m1_b", "text": "2/5"},
                        {"id": "m1_c", "text": "1"},
                        {"id": "m1_d", "text": "Does not exist"}
                    ],
                    "correct_option_id": "m1_a"
                }
            },
            # Mathematics NVQ
            {
                "subject": "Mathematics",
                "type": "numerical",
                "content": {
                    "text": "If ∫[0 to 2] (3x² + 2x) dx = K, find the value of integer K.",
                    "numerical_answer": 12.0,
                    "tolerance": 0.01
                }
            }
        ]

        saved_questions = []
        for item in q_data:
            q = Question(
                organization_id=org.id,
                subject=item["subject"],
                question_type=item["type"],
                content_json=json.dumps(item["content"])
            )
            db.add(q)
            db.flush()
            saved_questions.append({
                "id": q.id,
                "subject": q.subject,
                "type": q.question_type,
                "points_positive": 4.0,
                "points_negative": -1.0,
                "content": item["content"]
            })

        exam = Exam(
            organization_id=org.id,
            title="Comprehensive Midterm Assessment (Paper 1)",
            description="Specialized institutional assessment format: Physics, Chemistry & Mathematics. 180 Minutes.",
            duration_minutes=180,
            status="published",
            created_by=admin_user.id
        )
        db.add(exam)
        db.flush()

        version = ExamVersion(
            exam_id=exam.id,
            version_number=1,
            title=exam.title,
            duration_minutes=180,
            settings_json=json.dumps({"pattern": "JEE_MAIN", "marking": {"correct": 4, "incorrect": -1}}),
            snapshot_json=json.dumps(saved_questions)
        )
        db.add(version)
        db.flush()
    else:
        version = db.query(ExamVersion).filter(ExamVersion.exam_id == exam.id).first()
        saved_questions = json.loads(version.snapshot_json)

    # Ensure SaaS plans are seeded
    ensure_plans_seeded(db)

    # Create SuperAdmin user for Platform Admin portal
    superadmin = db.query(User).filter(User.email == "superadmin@lunaris.com").first()
    if not superadmin:
        superadmin = User(
            email="superadmin@lunaris.com",
            password_hash=get_password_hash("SuperAdmin123!"),
            full_name="Platform Super Administrator",
            is_superadmin=True
        )
        db.add(superadmin)
        db.flush()

    # Assign Candidate with invite token (legacy)
    from datetime import datetime, timezone, timedelta
    from app.models import ExamEnrollment
    now = datetime.now(timezone.utc)
    assignment = db.query(ExamAssignment).filter(ExamAssignment.invite_token == "demo-assessment-token-2026").first()
    if not assignment:
        assignment = ExamAssignment(
            organization_id=org.id,
            exam_version_id=version.id,
            candidate_id=candidate.id,
            invite_token="demo-assessment-token-2026",
            opens_at=now - timedelta(hours=1),
            closes_at=now + timedelta(days=30)
        )
        db.add(assignment)

    # Seed Candidate Enrollment with exam-specific UID and PIN (no permanent account required!)
    enrollment = db.query(ExamEnrollment).filter(
        ExamEnrollment.exam_id == exam.id,
        ExamEnrollment.candidate_uid == "LUN-AIR-2026"
    ).first()
    if not enrollment:
        enrollment = ExamEnrollment(
            organization_id=org.id,
            exam_id=exam.id,
            exam_version_id=version.id,
            candidate_uid="LUN-AIR-2026",
            access_pin_plain="2026",
            candidate_name="Aarav Sharma (AIR Aspirant)",
            candidate_email="candidate@lunaris.org",
            max_attempts=3,
            valid_from=now - timedelta(hours=1),
            valid_until=now + timedelta(days=30),
            status="active"
        )
        db.add(enrollment)

    db.commit()

    return {
        "message": "Demo Institutional Exam created successfully with UID enrollment!",
        "organization_id": org.id,
        "organization_slug": org.slug,
        "admin_credentials": {"email": "faculty@polaris.edu", "password": "Password123!"},
        "superadmin_credentials": {"email": "superadmin@lunaris.com", "password": "SuperAdmin123!"},
        "candidate_credentials": {"email": "candidate@lunaris.org", "password": "Candidate123!"},
        "candidate_uid": "LUN-AIR-2026",
        "candidate_pin": "2026",
        "candidate_invite_token": "demo-assessment-token-2026",
        "exam_id": exam.id,
        "exam_title": exam.title,
        "total_questions": len(saved_questions)
    }
