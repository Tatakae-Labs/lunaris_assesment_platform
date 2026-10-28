# Threat Model & Exam Integrity Specification

**Target Product:** Lunaris JEE-Style Proctored Assessment SaaS  
**Standard Baseline:** OWASP ASVS 5.0 (Application Security Verification Standard)  
**Classification:** High-Stakes Academic & Recruitment Assessment  

---

## 1. Threat Actors & Attack Vectors

| Threat Actor | Motivations | Attack Vectors |
| :--- | :--- | :--- |
| **Dishonest Candidate** | Obtain higher test score, clear cutoffs | - Clock skewing / pausing local timer<br>- DevTools injection / DOM answer sniffing<br>- Tab switching, secondary monitor, screen sharing<br>- Post-deadline answer submission replay<br>- Replaying previous network packets |
| **Malicious Student / Peer** | Disrupt competitor, access others' data | - IDOR parameter tampering (`attempt_id`, `user_id`)<br>- Denial of Service via flood of proctoring frames<br>- Cross-tenant question bank theft |
| **Unauthorized Third Party** | Extract intellectual property (questions) | - Scraping unreleased questions and answer keys<br>- Reconstructing exam paper prior to test window |

---

## 2. Integrity Controls (ASVS 5.0 Aligned)

### 2.1 Server-Authoritative Exam Lifecycle
- **Zero Client Trust:** The client countdown timer is purely decorative UI.
- **Official Deadline:** When an attempt starts, `deadline_at = started_at + duration + grace_period` is permanently written to PostgreSQL.
- **Server Enforcement:** Every `PUT /api/v1/attempts/{id}/answers/{question_id}` validates `NOW() <= attempt.deadline_at`. Any packet received after the deadline is rejected with HTTP 403 `EXAM_EXPIRED`.
- **Automatic Finalizer:** A server worker/cron transitions any unsubmitted attempts to `SUBMITTED` when `NOW() > deadline_at + grace_period`.

### 2.2 Answer Key & Question Isolation
- **No Client Answer Keys:** The exam delivery endpoint `GET /api/v1/attempts/{id}/paper` **NEVER** returns `correct_answer`, `explanation`, or grading weights.
- **Shuffled Options with Stable UUIDs:** Option order is shuffled per candidate session, but answer submission references permanent option UUIDs (`selected_option_id`), making position-based guessing and DOM scraping useless.

### 2.3 Idempotent Answer Persistence & Revisions
- Each answer submission carries an incrementing revision counter:
  ```json
  {
    "question_id": "uuid",
    "answer_json": { "selected_option_id": "uuid" },
    "client_timestamp": "2026-10-25T11:30:00Z",
    "revision": 4
  }
  ```
- Protects against out-of-order packet delivery during network reconnection.

### 2.4 Multi-Tenant Row-Level Security
- Every SQL query across `questions`, `exams`, `assignments`, and `attempts` strictly enforces `organization_id` tenancy filters.
- Passing another tenant's UUID returns HTTP 404 (preventing existence disclosure) rather than HTTP 403.

### 2.5 Proctoring Privacy & Tamper-Evident Evidence
- Candidate webcam snapshots are encrypted and stored in private S3-compatible object storage with time-limited signed URLs (TTL: 15 minutes) accessible only to assigned proctors.
- Audit logs are append-only.
