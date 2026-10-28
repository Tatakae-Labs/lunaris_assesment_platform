# Lunaris System Architecture: JEE-Style Assessment SaaS

**Version:** 1.0.0 (October 2026)  
**Architecture Style:** Modular Monolith (FastAPI + React 19/Vite + PostgreSQL)  

---

## 1. System Topology

```
[ Candidate Browser ]       [ Org Admin / Proctor Browser ]
        │                                  │
        └─────────────────┬────────────────┘
                          ▼
             [ Reverse Proxy / Edge TLS ]
                          │
                          ▼
            [ Lunaris Application Backend ]
            ├── Module 1: Auth & Tenant Access
            ├── Module 2: Question Bank & Versioning
            ├── Module 3: Candidate Exam Engine (JEE CBT)
            ├── Module 4: Proctoring Event Ingestion
            ├── Module 5: Scheduling & Invitations
            ├── Module 6: Proctor Operations Console
            ├── Module 7: Deterministic Grading & Analytics
            └── Module 8: Audit & Incident Review
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
 [ PostgreSQL 16 ]                 [ Private S3 Storage ]
 (Normalized Tenancy,              (Evidence Snapshots,
  Immutable Exam Versions)          Restricted Signed URLs)
```

---

## 2. JEE CBT Examination Engine (State Machine)

The National Testing Agency (NTA) JEE Main standard defines 5 distinct visual question states in the question palette:

```
                  ┌──────────────────────┐
                  │ 1. Not Visited       │ (Silver / Grey square)
                  └──────────┬───────────┘
                             │ Navigate to question
                             ▼
                  ┌──────────────────────┐
                  │ 2. Not Answered      │ (Red pentagon/rounded)
                  └─────┬──────────┬─────┘
           Select option│          │ Click "Mark for Review"
                        ▼          ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ 3. Answered             │     │ 4. Marked for Review    │ (Purple circle)
│ (Green polygon)         │     │ (Without Answer)        │
└───────────┬─────────────┘     └──────────┬──────────────┘
            │                              │
            │ Click "Save & Mark           │ Select option and click
            │ for Review"                  │ "Save & Mark for Review"
            ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Answered & Marked for Review                         │
│ (Purple circle with green badge - EVALUATED IN JEE)     │
└─────────────────────────────────────────────────────────┘
```

### JEE Question Types Supported
1. **Single-Correct MCQ:** Exactly one option correct (+4 for correct, -1 for incorrect, 0 if unanswered).
2. **Multiple-Correct MCQ:** One or more options correct with configurable partial marking.
3. **Numerical Value Question (NVQ):** Integer or floating-point input rounded to specified precision (typically 2 decimals). In JEE Main Section B, candidates choose 5 out of 10 NVQs. No negative marking or configurable negative marking (-1).

---

## 3. Normalized Relational Schema

All entities strictly enforce multi-tenancy and immutable publication:

1. **`organizations`**: `(id UUID, name, slug, plan_id, created_at)`
2. **`users`**: `(id UUID, email, password_hash, full_name, is_active, created_at)`
3. **`organization_members`**: `(id UUID, organization_id, user_id, role, joined_at)`
   - Roles: `owner`, `admin`, `exam_author`, `proctor`, `candidate`
4. **`question_banks`**: `(id UUID, organization_id, title, subject)`
5. **`questions`**: `(id UUID, organization_id, bank_id, subject, question_type, content_json, marking_scheme_json, version)`
6. **`exams`**: `(id UUID, organization_id, title, duration_minutes, settings_json, status)`
7. **`exam_versions`**: `(id UUID, exam_id, version_number, snapshot_json, published_at)`
8. **`exam_assignments`**: `(id UUID, exam_version_id, candidate_id, invite_token, opens_at, closes_at)`
9. **`exam_attempts`**: `(id UUID, assignment_id, candidate_id, started_at, deadline_at, status, submitted_at)`
10. **`attempt_answers`**: `(id UUID, attempt_id, question_id, answer_json, revision, saved_at)`
11. **`proctor_events`**: `(id UUID, attempt_id, event_type, severity, metadata_json, occurred_at)`
12. **`evidence_assets`**: `(id UUID, event_id, storage_key, mime_type, retention_until)`
13. **`audit_events`**: `(id UUID, organization_id, actor_id, action, payload_json, created_at)`
