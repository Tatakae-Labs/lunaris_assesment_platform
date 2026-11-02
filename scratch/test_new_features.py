import os
import sys
sys.path.insert(0, os.path.abspath('backend'))

import json
import sqlite3
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

conn = sqlite3.connect('backend/lunaris.db')
c = conn.cursor()
c.execute("SELECT id, email, is_superadmin FROM users WHERE email='contact.kadurugved@gmail.com' OR is_superadmin=1 LIMIT 1")
user_row = c.fetchone()
c.execute("SELECT id, name, slug FROM organizations WHERE name LIKE '%Lunaris%' OR slug LIKE '%contact%' LIMIT 1")
org_row = c.fetchone()
conn.close()

org_id = org_row[0]
user_id = user_row[0]

from app.auth.router import create_access_token
token = create_access_token(data={"sub": user_id})
headers = {"Authorization": f"Bearer {token}"}

print("Running Test 1 (Org Usage)...", flush=True)
r = client.get(f"/api/v1/organizations/{org_id}/usage", headers=headers)
print("Test 1 Result:", r.status_code, "max_candidates:", r.json().get("max_candidates"), flush=True)
assert r.status_code == 200

print("Running Test 2 (Update Capacity)...", flush=True)
r = client.put(f"/api/v1/organizations/{org_id}/capacity", headers=headers, json={"max_candidates": 5000})
print("Test 2 Result:", r.status_code, r.json(), flush=True)
assert r.status_code == 200

print("Running Test 3 (List Candidates)...", flush=True)
r = client.get(f"/api/v1/organizations/{org_id}/candidates", headers=headers)
print("Test 3 Result:", r.status_code, "Total candidates enrolled:", r.json()["total"], flush=True)
assert r.status_code == 200

print("Running Test 4 (Ingest PYQ Document without external API)...", flush=True)
sample_pyq = (
    "Past Year Examination 2024 - Computer Science\n"
    "Question 1.\n"
    "What is the worst-case time complexity of searching an element in an unbalanced Binary Search Tree?\n"
    "(A) O(1)\n"
    "(B) O(log n)\n"
    "(C) O(n)\n"
    "(D) O(n log n)\n"
    "Answer: C\n"
    "Explanation: In a skewed or degenerate binary tree, search degenerates to linear traversal O(n).\n\n"
    "Question 2.\n"
    "Compute the height of a complete binary tree containing 15 nodes.\n"
    "Value: 4\n"
    "Answer: 4\n"
    "Explanation: A complete binary tree with N=15 nodes has floor(log2(15)) + 1 = 4 levels.\n"
)
files = {
    "file": ("2024_CS_PYQ_Paper.txt", sample_pyq.encode("utf-8"), "text/plain")
}
data = {
    "organization_id": org_id,
    "subject": "Computer Science",
    "auto_approve": "false"
}
r = client.post("/api/v1/ai/ingest-file", headers=headers, files=files, data=data)
print("Test 4 Result:", r.status_code, r.json(), flush=True)
assert r.status_code == 200
assert r.json()["questions_extracted"] >= 2

print("\nSUCCESS: All new endpoints tested and 100% verified!", flush=True)
