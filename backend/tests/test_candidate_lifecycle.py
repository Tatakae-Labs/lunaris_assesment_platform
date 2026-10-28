import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import get_superadmin_token

client = TestClient(app)

def test_candidate_uid_zero_account_lifecycle():
    """
    Verifies that a candidate can take an assigned exam using only an
    enrollment UID and PIN without creating a permanent account,
    with server-authoritative timer and answer autosave.
    """
    # 1. Seed Demo JEE Exam (requires superadmin)
    sa_token = get_superadmin_token(client)
    seed_res = client.post("/api/v1/seed/jee-demo", headers={"Authorization": f"Bearer {sa_token}"})
    assert seed_res.status_code == 200
    seed_data = seed_res.json()
    exam_slug = seed_data["organization_slug"]
    exam_id = seed_data["exam_id"]
    uid = seed_data["candidate_uid"]
    pin = seed_data["candidate_pin"]

    # 2. Test Invalid PIN returns 401
    bad_pin_res = client.post("/api/v1/candidate/verify", json={
        "exam_slug": exam_id,
        "candidate_uid": uid,
        "access_pin": "WRONG_PIN_9999"
    })
    assert bad_pin_res.status_code == 401

    # 3. Test Invalid UID returns 401 (prevent enumeration)
    bad_uid_res = client.post("/api/v1/candidate/verify", json={
        "exam_slug": exam_id,
        "candidate_uid": "NON_EXISTENT_UID",
        "access_pin": pin
    })
    assert bad_uid_res.status_code == 401

    # 4. Valid Verification returns candidate session token
    verify_res = client.post("/api/v1/candidate/verify", json={
        "exam_slug": exam_id,
        "candidate_uid": uid,
        "access_pin": pin
    })
    assert verify_res.status_code == 200, verify_res.text
    session_data = verify_res.json()
    session_token = session_data["session_token"]
    assert session_token.startswith("lunaris_cand_")
    assert session_data["candidate_uid"] == uid

    headers = {"X-Candidate-Session": session_token}

    # 5. Device check consent
    consent_res = client.post("/api/v1/candidate/preflight-consent", json={
        "consent_given": True,
        "camera_status": "granted"
    }, headers=headers)
    assert consent_res.status_code == 200
    assert consent_res.json()["status"] == "consent_recorded"

    # 6. Start Exam Attempt
    start_res = client.post("/api/v1/candidate/start-attempt", headers=headers)
    assert start_res.status_code == 200
    attempt_data = start_res.json()
    attempt_id = attempt_data["attempt_id"]
    assert attempt_data["status"] == "in_progress"
    assert "remaining_seconds" in attempt_data
    assert attempt_data["remaining_seconds"] > 0

    # 7. Get Candidate Paper - verify complete confidentiality of answer keys
    paper_res = client.get("/api/v1/candidate/paper", headers=headers)
    assert paper_res.status_code == 200
    paper = paper_res.json()
    assert len(paper["questions"]) > 0

    for q in paper["questions"]:
        assert "correct_option_id" not in q["content"]
        assert "numerical_answer" not in q["content"]
        assert "is_correct" not in q["content"]

    # 8. Save Answers (Autosave with revision)
    q1 = paper["questions"][0]
    opt_id = q1["content"]["options"][0]["id"]

    save_res = client.post("/api/v1/candidate/save-answer", json={
        "question_id": q1["id"],
        "answer": {"selected_options": [opt_id], "state": "answered"},
        "revision": 1
    }, headers=headers)
    assert save_res.status_code == 200
    assert save_res.json()["status"] == "saved"

    # 9. Verify Autosave Persistence (Fetching paper returns saved answer)
    refreshed_paper = client.get("/api/v1/candidate/paper", headers=headers)
    assert refreshed_paper.status_code == 200
    saved = refreshed_paper.json()["saved_answers"]
    assert q1["id"] in saved
    assert saved[q1["id"]]["selected_options"] == [opt_id]

    # 10. Submit Attempt
    sub_res = client.post("/api/v1/candidate/submit", headers=headers)
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["status"] == "submitted"
    assert "score_total" in sub_data
    assert "accuracy" in sub_data
