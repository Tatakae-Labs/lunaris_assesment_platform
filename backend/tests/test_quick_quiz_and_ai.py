import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import get_superadmin_token

client = TestClient(app)

def test_quick_quiz_room_and_leaderboard():
    # 1. First seed the demo to have questions and exam available
    sa_token = get_superadmin_token(client)
    seed_res = client.post("/api/v1/seed/jee-demo", headers={"Authorization": f"Bearer {sa_token}"})
    assert seed_res.status_code == 200
    seed_data = seed_res.json()
    exam_id = seed_data["exam_id"]

    # 2. Host a Quick Quiz Room
    create_room_res = client.post(f"/api/v1/quick-quiz/create-room?exam_id={exam_id}&per_question_time=15")
    assert create_room_res.status_code == 200
    room_data = create_room_res.json()
    room_code = room_data["room_code"]
    assert len(room_code) == 6

    # 3. Join the room as a student
    join_res = client.post(f"/api/v1/quick-quiz/rooms/{room_code}/join", json={
        "nickname": "Topper_Rohan",
        "email": "rohan@lunaris.org"
    })
    assert join_res.status_code == 200
    session_data = join_res.json()
    assert session_data["room_code"] == room_code
    assert len(session_data["questions"]) > 0

    q1 = session_data["questions"][0]
    session_id = session_data["session_id"]
    correct_opt_id = q1["options"][0]["id"]  # Choose an option

    # 4. Submit an answer with speed (took 3 seconds out of 15)
    ans_res = client.post(f"/api/v1/quick-quiz/rooms/{room_code}/answer", json={
        "session_id": session_id,
        "question_id": q1["id"],
        "selected_option_id": correct_opt_id,
        "time_spent_seconds": 3.0
    })
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert "points_awarded" in ans_data
    assert "current_total_score" in ans_data

    # 5. Fetch live leaderboard
    lb_res = client.get(f"/api/v1/quick-quiz/rooms/{room_code}/leaderboard")
    assert lb_res.status_code == 200
    lb_data = lb_res.json()
    assert "leaderboard" in lb_data
    assert len(lb_data["leaderboard"]) >= 1
    assert lb_data["leaderboard"][0]["nickname"] == "Topper_Rohan"


def test_ai_question_synthesis_and_approval():
    # Seed demo to populate organization and faculty
    sa_token = get_superadmin_token(client)
    seed_res = client.post("/api/v1/seed/jee-demo", headers={"Authorization": f"Bearer {sa_token}"})
    assert seed_res.status_code == 200

    # Login as faculty
    login_res = client.post("/api/v1/auth/login", json={
        "email": "faculty@allen.ac.in",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Synthesize questions via AI generator
    gen_res = client.post("/api/v1/ai/generate-questions", json={
        "organization_id": "allen-kota-mock",
        "topic": "Electromagnetic Induction & Faraday's Laws",
        "subject": "Physics",
        "difficulty": "medium",
        "count": 2,
        "include_numerical": True
    }, headers=headers)
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["drafts_count"] >= 2
    draft_id = gen_data["drafts"][0]["id"]

    # 2. List drafts
    drafts_res = client.get("/api/v1/ai/drafts?organization_id=allen-kota-mock")
    assert drafts_res.status_code == 200
    assert any(d["id"] == draft_id for d in drafts_res.json())

    # 3. Approve draft into active question bank
    approve_res = client.post(f"/api/v1/ai/drafts/{draft_id}/approve", headers=headers)
    assert approve_res.status_code == 200
    assert "question_id" in approve_res.json()


def test_plans_and_entitlements():
    # Seed demo to populate organization and faculty
    sa_token2 = get_superadmin_token(client)
    seed_res = client.post("/api/v1/seed/jee-demo", headers={"Authorization": f"Bearer {sa_token2}"})
    assert seed_res.status_code == 200

    # 1. List available commercial plans
    plans_res = client.get("/api/v1/plans")
    assert plans_res.status_code == 200
    plans = plans_res.json()
    assert len(plans) == 3
    plan_codes = [p["code"] for p in plans]
    assert "free" in plan_codes
    assert "creator_pro" in plan_codes
    assert "institution" in plan_codes

    # 2. Login as faculty
    login_res = client.post("/api/v1/auth/login", json={
        "email": "faculty@allen.ac.in",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Subscribe to creator_pro plan
    sub_res = client.post("/api/v1/plans/subscribe", json={
        "organization_id": "allen-kota-mock",
        "plan_code": "creator_pro"
    }, headers=headers)
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] == "active"
    assert sub_data["plan"]["code"] == "creator_pro"
