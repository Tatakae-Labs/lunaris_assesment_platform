# Lunaris Architecture Specification

## 1. System Overview & Mission
**Lunaris** is a commercial-grade, multi-tenant computer-based assessment Software-as-a-Service (SaaS) tailored for institutional exams (JEE Main & Advanced, NEET, collegiate exams, and professional certifications). 

Lunaris is designed around four decoupled control planes:
1. **Platform Control Plane**: Platform Super Administrators manage customer tenants, global SaaS subscription catalogues, feature entitlements, abuse monitoring, and operational metrics.
2. **Organization Workspace**: Institutional owners, faculty authors, and exam managers assemble question banks, schedule assessments, issue one-time candidate credentials, and inspect live integrity logs.
3. **Assessment Delivery Engine**: Timed, resilient, NTA-style Computer-Based Testing (CBT) portal supporting zero-account candidate enrollment, deterministic server-side timing, and idempotent answer autosaving.
4. **Integrity Review & Proctoring**: Dual-engine client-side AI proctoring (MediaPipe + COCO-SSD) producing advisory telemetry and policy-triggered snapshots for human proctor review.

---

## 2. High-Level Component Topology

```
+-----------------------------------------------------------------------------------+
|                              LUNARIS CLIENT SURFACES                              |
|  +-------------------+  +--------------------+  +-------------------------------+  |
|  | Public Website    |  | Org Workspaces     |  | Candidate Exam Delivery       |  |
|  | (Pure White Theme)|  | (Admins, Faculty,  |  | (NTA/JEE Interface, Zero-     |  |
|  | Marketing/Pricing |  |  Proctors, Owners) |  |  Account UID & Access PIN)    |  |
|  +-------------------+  +--------------------+  +-------------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / REST / SSE
+-----------------------------------------v-----------------------------------------+
|                        MODULAR MONOLITH API CONTROL PLANE                         |
|                                                                                   |
|  [Auth & Tenancy]       [Question Bank]         [Exam Versioning]                 |
|  - Membership RBAC      - Schema-validated      - Immutable snapshots             |
|  - Argon2id / JWT       - Multi-subject banks   - Content integrity hash          |
|  - Token revocation     - AI studio drafts      - Rule preservation               |
|                                                                                   |
|  [Candidate Delivery]   [Proctoring Ingestion]  [Deterministic Grading]           |
|  - Server timer clock   - Rate-limited stream   - JEE Marking (+4, -1, NVQ)       |
|  - Idempotent autosave  - Advisory review queue - Subject breakdown               |
|  - Reconnect tolerance  - Snapshot storage      - Decimal tolerance               |
|                                                                                   |
|  [Plans & Entitlements] [Platform Operations]   [Quick Quiz Arena]                |
|  - Quota verification   - Superadmin console    - Real-time multiplayer rooms     |
|  - Webhook processing   - Audit logs            - Synchronized question timers    |
+--------------------+---------------------+--------------------+-------------------+
                     |                     |                    |
                     v                     v                    v
            +----------------+    +----------------+   +-----------------+
            | PostgreSQL 16+ |    | Object Storage |   | Redis (Workers) |
            | Transactional  |    | Private S3     |   | Asynchronous    |
            | Tenant Records |    | Evidence JPEGs |   | Outbox / Queue  |
            +----------------+    +----------------+   +-----------------+
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Core** | React 18, Vite, React Router v7 | Fast build times, modern bundle splitting, single-page navigation. |
| **Styling & Theme** | Vanilla CSS Tokens (Pure White) | 100% control over NTA/JEE examination layout, design consistency. |
| **Client Vision AI** | TensorFlow.js + COCO-SSD, MediaPipe | Zero-dependency on-device neural object detection and face presence. |
| **Backend Core** | FastAPI (Python 3.12+), Pydantic v2 | High-throughput asynchronous REST API with strict runtime schema validation. |
| **Database & ORM** | PostgreSQL 16+, SQLAlchemy 2.x, Alembic | ACID transactional guarantees, relational integrity, row-level security. |
| **Security & Auth** | Argon2id / bcrypt, JWT Bearer Sessions | ASVS 5.0 compliant credentials, short-lived candidate session tokens. |
| **Evidence Storage** | S3-Compatible Private Storage | Media snapshots accessed exclusively via expiring presigned tokens. |

---

## 4. Architectural Invariants & Guarantees
1. **Server-Authoritative Clock**: The exam deadline is computed and enforced strictly by the server. Client clocks cannot manipulate test durations.
2. **Immutable Exam Snapshots**: Publishing an exam freezes all questions, options, point allocations, and instructions into an `ExamVersion`. In-progress student attempts remain bound to their starting snapshot even if the source exam is subsequently edited.
3. **Strict Answer Key Confidentiality**: Answer keys, correct option IDs, and numerical tolerances are stripped on the server before transmitting candidate papers. Answer keys are never present in client bundles or network responses.
4. **Non-Destructive AI Proctoring**: Vision AI telemetry produces advisory review signals, never automated candidate disqualification. Human reviewers retain exclusive sanction authority.
