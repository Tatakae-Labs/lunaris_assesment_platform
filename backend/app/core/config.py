import os
import shutil
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List, Optional

_INSECURE_DEFAULT_KEY = "lunaris_super_secret_jwt_key_development_2026"

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ROOT_DIR = os.path.dirname(_BACKEND_DIR)
_DEFAULT_DB_PATH = os.path.join(_ROOT_DIR, "lunaris.db").replace("\\", "/")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lunaris Assessment Platform"
    ENVIRONMENT: str = "development"
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ALGORITHM: str = "HS256"
    # Staff JWT session expiry (minutes)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    # Candidate exam session expiry (minutes) — scoped and short-lived
    CANDIDATE_SESSION_EXPIRE_MINUTES: int = 300

    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB_PATH}"
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "lunaris"
    MONGODB_ENABLED: bool = True
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_DIR: str = "./storage_assets"

    PROCTORING_SNAPSHOT_INTERVAL_SEC: int = 10
    VOICE_DETECTION_ENABLED: bool = True
    BROWSER_LOCKDOWN_ENABLED: bool = True
    EVIDENCE_RETENTION_DAYS: int = 90
    GROQ_API_KEY: Optional[str] = None
    LLM_MODEL: str = "llama-3.3-70b-versatile"

    # Rate limiting: requests per window per IP
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_CANDIDATE: str = "60/minute"
    RATE_LIMIT_API: str = "200/minute"

    # Allow the demo seed endpoint in development only
    ENABLE_DEMO_SEED: bool = False

    # SMTP / Mailer Service Configuration (All secrets configured via .env)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "notifications@lunaris.com"
    SMTP_FROM_NAME: str = "Lunaris Assessment Platform"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # Google OAuth 2.0 & Google Classroom Configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"),
        extra="ignore"
    )

    @model_validator(mode="after")
    def normalize_sqlite_url(self) -> "Settings":
        if self.DATABASE_URL.startswith("sqlite"):
            # If running on Vercel or AWS Lambda serverless runtime, redirect SQLite to /tmp so it is writable
            is_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
            if is_serverless:
                tmp_db = "/tmp/lunaris.db"
                if not os.path.exists(tmp_db):
                    for cand in [_DEFAULT_DB_PATH, os.path.join(_BACKEND_DIR, "lunaris.db"), os.path.join(_ROOT_DIR, "lunaris.db")]:
                        if os.path.exists(cand):
                            try:
                                shutil.copy2(cand, tmp_db)
                                break
                            except Exception:
                                pass
                self.DATABASE_URL = f"sqlite:///{tmp_db}"
            elif "./lunaris.db" in self.DATABASE_URL or self.DATABASE_URL.endswith("lunaris.db"):
                abs_path = _DEFAULT_DB_PATH
                self.DATABASE_URL = f"sqlite:///{abs_path}"
        return self

    @model_validator(mode="after")
    def warn_insecure_secret(self) -> "Settings":
        if self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
            # Generate a secure fallback key so serverless cold starts never throw a fatal ValueError
            self.SECRET_KEY = secrets.token_urlsafe(64)
            import warnings
            warnings.warn(
                "SECRET_KEY was not explicitly provided in environment. Automatically generated an ephemeral 64-char key.",
                stacklevel=2
            )
        return self

settings = Settings()

