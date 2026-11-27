import os
import shutil
import uuid
from sqlalchemy import create_engine, event, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except Exception:
    pass

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif _db_url.startswith("postgresql://") and not _db_url.startswith("postgresql+"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif _db_url.startswith("mysql://"):
    _db_url = _db_url.replace("mysql://", "mysql+pymysql://", 1)

if _db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 60}
    engine = create_engine(_db_url, connect_args=connect_args, pool_pre_ping=True)
else:
    engine = create_engine(
        _db_url,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=10,
        max_overflow=20
    )

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        # Set busy_timeout first so any lock contention waits up to 60s
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_uuid() -> str:
    return str(uuid.uuid4())

def checkpoint_sqlite(engine_instance):
    """Cleanly checkpoints WAL file on startup or recovery to prevent lock file conflicts."""
    checkpoint_and_sync_db(engine_instance)

def checkpoint_and_sync_db(db_or_engine=None):
    """
    1. Executes PRAGMA wal_checkpoint(TRUNCATE) so changes on the active SQLite database
       are flushed completely from WAL memory/journal into the .db file on disk.
    2. Mirror-syncs root lunaris.db and backend/lunaris.db so regardless of where a tool or user
       inspects the database file, both are guaranteed to be 100% identical and updated.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    try:
        from app.core.config import _ROOT_DIR, _BACKEND_DIR
        root_db = os.path.join(_ROOT_DIR, "lunaris.db")
        backend_db = os.path.join(_BACKEND_DIR, "lunaris.db")
        
        target_engine = db_or_engine.get_bind() if hasattr(db_or_engine, "get_bind") else (db_or_engine or engine)
        with target_engine.connect() as conn:
            conn.execute(text("PRAGMA busy_timeout=60000"))
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
            conn.commit()

        # Check which database is the active one in DATABASE_URL
        active_db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        if active_db_path.startswith("/tmp"):
            # Serverless environment (e.g. Vercel) - do not attempt to write back to read-only app directories
            return
        if os.path.exists(active_db_path):
            if os.path.abspath(active_db_path) == os.path.abspath(root_db) and os.path.exists(root_db):
                shutil.copy2(root_db, backend_db)
            elif os.path.abspath(active_db_path) == os.path.abspath(backend_db) and os.path.exists(backend_db):
                shutil.copy2(backend_db, root_db)
            else:
                # Fallback: copy whichever exists and is newest
                if os.path.exists(backend_db) and (not os.path.exists(root_db) or os.path.getmtime(backend_db) >= os.path.getmtime(root_db)):
                    shutil.copy2(backend_db, root_db)
                elif os.path.exists(root_db):
                    shutil.copy2(root_db, backend_db)
    except Exception as e:
        print(f"checkpoint_and_sync_db note: {e}")


def auto_migrate_sqlite(engine_instance):
    """Auto-migrates any missing columns for SQLite development databases."""
    try:
        from sqlalchemy import text, inspect
        inspector = inspect(engine_instance)
        table_names = inspector.get_table_names()
        
        column_patches = [
            ("exams", "results_released", "BOOLEAN DEFAULT 0"),
            ("exam_versions", "results_released", "BOOLEAN DEFAULT 0"),
            ("subscriptions", "trial_end", "TIMESTAMP"),
            ("subscriptions", "grace_period_end", "TIMESTAMP"),
            ("attempt_answers", "sequence_number", "INTEGER DEFAULT 1"),
            ("exam_enrollments", "access_pin_hash", "VARCHAR(255)"),
            ("organizations", "features_json", "TEXT DEFAULT '{}'"),
            ("organizations", "properties_json", "TEXT DEFAULT '{}'"),
            ("users", "admin_role", "VARCHAR(50) DEFAULT 'platform_admin'"),
            ("users", "google_id", "VARCHAR(100)"),
            ("users", "google_picture", "VARCHAR(500)"),
            ("users", "google_access_token", "TEXT"),
            ("users", "google_refresh_token", "TEXT"),
            ("exams", "classroom_course_id", "VARCHAR(100)"),
            ("exams", "classroom_coursework_id", "VARCHAR(100)"),
            ("exams", "classroom_alternate_link", "VARCHAR(500)"),
            ("exam_versions", "classroom_course_id", "VARCHAR(100)"),
            ("exam_versions", "classroom_coursework_id", "VARCHAR(100)"),
            ("exam_versions", "classroom_alternate_link", "VARCHAR(500)"),
            ("exam_attempts", "classroom_submission_id", "VARCHAR(100)"),
            ("exam_attempts", "classroom_turned_in", "BOOLEAN DEFAULT 0"),
            ("exam_attempts", "classroom_turned_in_at", "TIMESTAMP"),
            ("questions", "chapter", "VARCHAR(100)"),
            ("questions", "topic", "VARCHAR(100)"),
            ("questions", "difficulty", "VARCHAR(50) DEFAULT 'medium'"),
            ("questions", "marks", "FLOAT DEFAULT 4.0"),
            ("questions", "negative_marks", "FLOAT DEFAULT 1.0"),
            ("questions", "source", "VARCHAR(50) DEFAULT 'manual'"),
            ("questions", "approval_status", "VARCHAR(50) DEFAULT 'approved'"),
        ]

        with engine_instance.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(100) PRIMARY KEY, value_json TEXT NOT NULL, updated_at TIMESTAMP)"))
            for table, col, col_def in column_patches:
                if table in table_names:
                    cols = [c["name"] for c in inspector.get_columns(table)]
                    if col not in cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
            conn.commit()
    except Exception as exc:
        print(f"Schema auto-migration notice: {exc}")
