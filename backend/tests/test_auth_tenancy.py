import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import get_superadmin_token, register_and_get_token

client = TestClient(app)


def test_api_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "Lunaris Assessment Platform API"


def test_health_endpoints():
    """Readiness and liveness probes return 200."""
    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code == 200
    data = client.get("/health").json()
    assert data["database"] == "connected"


def test_register_and_login_session():
    """Register creates a UserSession; login also creates a UserSession; logout revokes it."""
    # Register
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "test.session@lunaris.org",
        "password": "Password123!",
        "full_name": "Session Test User",
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /me should work with session-backed token
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "test.session@lunaris.org"

    # Logout should revoke the session
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # /me should now return 401
    me_after = client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401


def test_seed_demo_and_attempt_flow():
    # 1. Bootstrap superadmin and seed JEE Demo
    sa_token = get_superadmin_token(client)
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    seed_res = client.post("/api/v1/seed/jee-demo", headers=sa_headers)
    assert seed_res.status_code == 200, f"Seed failed: {seed_res.text}"
    data = seed_res.json()
    token = data["candidate_invite_token"]

    # 2. Login as candidate (seed creates the user)
    login_res = client.post("/api/v1/auth/login", json={
        "email": "candidate@lunaris.org",
        "password": "Candidate123!"
    })
    assert login_res.status_code == 200
    auth_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # 3. Start Exam Attempt
    start_res = client.post("/api/v1/attempts", json={"invite_token": token}, headers=headers)
    assert start_res.status_code == 200
    attempt_id = start_res.json()["attempt_id"]
    assert start_res.json()["status"] == "in_progress"

    # 4. Get Candidate Paper (ensure no answer keys leaked)
    paper_res = client.get(f"/api/v1/attempts/{attempt_id}/paper", headers=headers)
    assert paper_res.status_code == 200
    paper_data = paper_res.json()
    assert len(paper_data["questions"]) == 6

    # Verify no correct_option_id or numerical_answer in candidate paper
    for q in paper_data["questions"]:
        assert "correct_option_id" not in q["content"]
        assert "numerical_answer" not in q["content"]

    # 5. Autosave an answer (q1)
    q1 = paper_data["questions"][0]
    opt_a_id = q1["content"]["options"][0]["id"]
    save_res = client.put(
        f"/api/v1/attempts/{attempt_id}/answers/{q1['id']}",
        json={"answer": {"selected_options": [opt_a_id], "state": "answered"}, "revision": 1},
        headers=headers
    )
    assert save_res.status_code == 200
    assert save_res.json()["status"] == "saved"

    # 6. Submit Attempt
    sub_res = client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers)
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] == "submitted"
    assert sub_data["score_total"] >= 4.0
    assert sub_data["correct_count"] >= 1
