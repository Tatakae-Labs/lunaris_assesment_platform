import uuid
from sqlalchemy import create_engine, event, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

connect_args = {"check_same_thread": False, "timeout": 60} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
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
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            with engine_instance.connect() as conn:
                conn.execute(text("PRAGMA busy_timeout=60000"))
                conn.execute(text("PRAGMA journal_mode=WAL"))
                conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
                conn.commit()
        except Exception:
            pass


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
        ]

        with engine_instance.connect() as conn:
            for table, col, col_def in column_patches:
                if table in table_names:
                    cols = [c["name"] for c in inspector.get_columns(table)]
                    if col not in cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
            conn.commit()
    except Exception as exc:
        print(f"Schema auto-migration notice: {exc}")
