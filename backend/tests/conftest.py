import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def register_and_get_token(client, email, password, name, org_name=None):
    """Helper: register a user and return the auth token."""
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": name,
        "organization_name": org_name or f"{name} Academy"
    })
    assert res.status_code == 200, f"Register failed: {res.text}"
    return res.json()["access_token"]


def get_superadmin_token(client):
    """
    Bootstrap a superadmin for tests that exercise admin-only endpoints.
    1. Register via HTTP (uses the test DB override correctly).
    2. Promote to superadmin directly via TestingSessionLocal (same in-memory engine).
    3. Log in to get a session-backed token.
    """
    email = "superadmin@test.lunaris"
    password = "TestAdmin123!"

    # Register via HTTP (this uses the test DB override correctly)
    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Test Super Admin",
        "organization_name": "Platform Operations"
    })
    # May already be registered if called in a prior step in the same test
    if reg_res.status_code not in (200, 400):
        raise AssertionError(f"Superadmin registration failed: {reg_res.text}")

    # Promote to superadmin in the in-memory test DB (same engine as the override)
    from app.models import User
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user and not user.is_superadmin:
            user.is_superadmin = True
            db.commit()
    finally:
        db.close()

    # Log in to get a session-backed token
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200, f"Superadmin login failed: {login_res.text}"
    return login_res.json()["access_token"]

