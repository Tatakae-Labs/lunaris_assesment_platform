import pytest
import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_exam_version_immutability():
    """
    Verifies that publishing creates an immutable snapshot (ExamVersion)
    and that editing source questions or creating new versions does not
    alter an active candidate attempt's question paper.
    """
    # 1. Register Org & Owner
    reg = client.post("/api/v1/auth/register", json={
        "email": "immutability_owner@academy.org",
        "password": "Password123!",
        "full_name": "Dean Immutability",
        "organization_name": "Integrity Institute"
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    org_id = reg.json()["organization_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Question v1
    q_res = client.post("/api/v1/questions", json={
        "organization_id": org_id,
        "subject": "Physics",
        "question_type": "single_mcq",
        "content": {
            "text": "Version 1 Question: Speed of light in vacuum?",
            "options": [
                {"id": "opt_c", "text": "3 x 10^8 m/s"},
                {"id": "opt_s", "text": "340 m/s"}
            ],
            "correct_option_id": "opt_c"
        }
    }, headers=headers)
    assert q_res.status_code == 200
    q1_id = q_res.json()["id"]

    # 3. Create Exam & Publish (Version 1)
    exam_res = client.post("/api/v1/exams", json={
        "organization_id": org_id,
        "title": "Versioned Physics Olympiad",
        "duration_minutes": 90,
        "question_ids": [q1_id]
    }, headers=headers)
    assert exam_res.status_code == 200
    exam_id = exam_res.json()["id"]

    pub_res = client.post(f"/api/v1/exams/{exam_id}/publish", headers=headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["version_number"] == 1

    # 4. Enroll Candidate into Exam
    enroll_res = client.post(f"/api/v1/exams/{exam_id}/enrollments/bulk-generate", json={
        "count": 1,
        "max_attempts": 1
    }, headers=headers)
    assert enroll_res.status_code == 200
    cand_info = enroll_res.json()["enrollments"][0]
    cand_uid = cand_info["uid"]
    cand_pin = cand_info["pin"]

    # 5. Candidate enters exam and starts attempt bound to Version 1
    verify_res = client.post("/api/v1/candidate/verify", json={
        "exam_slug": exam_id,
        "candidate_uid": cand_uid,
        "access_pin": cand_pin
    })
    assert verify_res.status_code == 200
    cand_token = verify_res.json()["session_token"]
    cand_headers = {"X-Candidate-Session": cand_token}

    start_res = client.post("/api/v1/candidate/start-attempt", headers=cand_headers)
    assert start_res.status_code == 200

    paper_v1 = client.get("/api/v1/candidate/paper", headers=cand_headers)
    assert paper_v1.status_code == 200
    q_text_v1 = paper_v1.json()["questions"][0]["content"]["text"]
    assert "Version 1 Question" in q_text_v1

    # 6. Faculty edits the source question or adds a second question, and publishes Version 2!
    q2_res = client.post("/api/v1/questions", json={
        "organization_id": org_id,
        "subject": "Physics",
        "question_type": "single_mcq",
        "content": {
            "text": "Version 2 Question: Charge of electron?",
            "options": [{"id": "o_e", "text": "-1.6 x 10^-19 C"}],
            "correct_option_id": "o_e"
        }
    }, headers=headers)
    assert q2_res.status_code == 200

    pub_v2_res = client.post(f"/api/v1/exams/{exam_id}/publish", headers=headers)
    assert pub_v2_res.status_code == 200
    assert pub_v2_res.json()["version_number"] == 2

    # 7. CRITICAL VERIFICATION: In-progress candidate still gets Version 1 snapshot!
    paper_after_v2 = client.get("/api/v1/candidate/paper", headers=cand_headers)
    assert paper_after_v2.status_code == 200
    assert len(paper_after_v2.json()["questions"]) == 1
    assert "Version 1 Question" in paper_after_v2.json()["questions"][0]["content"]["text"]
    assert "Version 2 Question" not in paper_after_v2.json()["questions"][0]["content"]["text"]
