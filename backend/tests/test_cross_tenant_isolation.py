import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import get_superadmin_token

client = TestClient(app)

def test_cross_tenant_isolation():
    """
    Verifies that tenants cannot access or tamper with resources
    belonging to another organization (OWASP Multi-Tenant Security).
    """
    # 1. Register Org A Owner
    reg_a = client.post("/api/v1/auth/register", json={
        "email": "owner_a@acme.edu",
        "password": "Password123!",
        "full_name": "Alice Acme",
        "organization_name": "Acme Institute of Technology"
    })
    assert reg_a.status_code == 200, reg_a.text
    token_a = reg_a.json()["access_token"]
    org_a_id = reg_a.json()["organization_id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register Org B Owner
    reg_b = client.post("/api/v1/auth/register", json={
        "email": "owner_b@apex.edu",
        "password": "Password123!",
        "full_name": "Bob Apex",
        "organization_name": "Apex Learning Academy"
    })
    assert reg_b.status_code == 200, reg_b.text
    token_b = reg_b.json()["access_token"]
    org_b_id = reg_b.json()["organization_id"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert org_a_id != org_b_id

    # 3. Org A creates a Question
    q_a_res = client.post("/api/v1/questions", json={
        "organization_id": org_a_id,
        "subject": "Physics",
        "question_type": "single_mcq",
        "content": {
            "text": "What is the unit of capacitance?",
            "options": [
                {"id": "o1", "text": "Farad"},
                {"id": "o2", "text": "Henry"}
            ],
            "correct_option_id": "o1"
        }
    }, headers=headers_a)
    assert q_a_res.status_code == 200, q_a_res.text
    q_a_id = q_a_res.json()["id"]

    # 4. Org A creates an Exam
    exam_a_res = client.post("/api/v1/exams", json={
        "organization_id": org_a_id,
        "title": "Org A Midterm Exam",
        "duration_minutes": 60,
        "question_ids": [q_a_id]
    }, headers=headers_a)
    assert exam_a_res.status_code == 200, exam_a_res.text
    exam_a_id = exam_a_res.json()["id"]

    # 5. CROSS-TENANT ATTACK: Org B attempts to list Org A's exams
    list_cross_res = client.get(f"/api/v1/exams?organization_id={org_a_id}", headers=headers_b)
    assert list_cross_res.status_code in [403, 404], "Org B must be forbidden from querying Org A exams"

    # 6. CROSS-TENANT ATTACK: Org B attempts to publish Org A's exam
    pub_cross_res = client.post(f"/api/v1/exams/{exam_a_id}/publish", headers=headers_b)
    assert pub_cross_res.status_code in [403, 404], "Org B must be forbidden from publishing Org A exam"

    # 7. CROSS-TENANT ATTACK: Org B attempts to query Org A's questions
    questions_cross_res = client.get(f"/api/v1/questions?organization_id={org_a_id}", headers=headers_b)
    assert questions_cross_res.status_code in [403, 404], "Org B must be forbidden from viewing Org A questions"

    # 8. PRIVILEGE ESCALATION ATTACK: Org A owner attempts to access Platform SuperAdmin endpoint
    superadmin_endpoint_res = client.get("/api/v1/platform/overview", headers=headers_a)
    assert superadmin_endpoint_res.status_code == 403, "Standard organization owner must not access platform superadmin overview"


def test_platform_superadmin_access():
    """
    Verifies that only users with is_superadmin=True can access platform operations.
    """
    # Seed platform superadmin (via our test helper)
    sa_token = get_superadmin_token(client)
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    client.post("/api/v1/seed/jee-demo", headers=sa_headers)

    # Superadmin is already logged in via get_superadmin_token

    # Superadmin views platform overview
    overview_res = client.get("/api/v1/platform/overview", headers=sa_headers)
    assert overview_res.status_code == 200
    data = overview_res.json()
    assert "total_organizations" in data
    assert "total_exams" in data
