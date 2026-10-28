# Lunaris Database Schema Specification

## 1. Relational Entity Relationship Diagram

```
[organizations]
   |-- 1:N --> [organization_members] <-- N:1 -- [users] <-- 1:N -- [user_sessions]
   |-- 1:N --> [question_banks]
   |              `-- 1:N --> [questions]
   |                             `-- 1:N --> [question_revisions]
   |-- 1:N --> [exams]
   |              |-- 1:N --> [exam_versions]
   |              |              |-- 1:N --> [exam_enrollments]
   |              |              |              `-- 1:N --> [candidate_sessions]
   |              |              `-- 1:N --> [exam_attempts]
   |              |                             |-- 1:N --> [attempt_answers]
   |              |                             |-- 1:N --> [proctor_events]
   |              |                             |              |-- 1:N --> [evidence_assets]
   |              |                             |              `-- 1:1 --> [review_decisions]
   |              |                             |-- 1:1 --> [proctor_sessions]
   |              |                             |-- 1:N --> [appeals]
   |              |                             `-- 1:N --> [result_revisions]
   |-- 1:N --> [subscriptions] <-- N:1 -- [plans] <-- 1:N -- [plan_entitlements]
   |-- 1:N --> [payment_events]
   |-- 1:N --> [usage_ledger]
   |-- 1:N --> [audit_events]
   `-- 1:N --> [quiz_rooms]
                  |-- 1:N --> [quiz_participants]
                  |-- 1:N --> [quiz_rounds]
                  |-- 1:N --> [quiz_responses]
                  `-- 1:N --> [quiz_leaderboard_snapshots]
```

---

## 2. Core Table Definitions

### `organizations`
- `id` (VARCHAR(36), PK): UUID identifier.
- `name` (VARCHAR(255)): Institutional name.
- `slug` (VARCHAR(100), UNIQUE): URL-friendly unique identifier.
- `plan_id` (VARCHAR(50)): Active subscription tier (`free`, `creator_pro`, `institution`).
- `status` (VARCHAR(50)): `active`, `suspended`.
- `created_at` (TIMESTAMPTZ): UTC creation time.

### `users`
- `id` (VARCHAR(36), PK): UUID identifier.
- `email` (VARCHAR(255), UNIQUE, INDEX): Account email address.
- `password_hash` (VARCHAR(255)): Bcrypt/Argon2id password hash.
- `full_name` (VARCHAR(255)): Display name.
- `status` (VARCHAR(50)): `active`, `deactivated`.
- `is_superadmin` (BOOLEAN): Platform Super Administrator flag.

### `user_sessions`
- `id` (VARCHAR(36), PK): Session identifier.
- `user_id` (VARCHAR(36), FK -> `users.id`): Associated user.
- `session_token` (VARCHAR(128), UNIQUE, INDEX): Revocable session token / JWT.
- `is_revoked` (BOOLEAN): Token revocation flag (supports instant logout).
- `expires_at` (TIMESTAMPTZ): Expiry timestamp.

### `organization_members`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `user_id` (VARCHAR(36), FK -> `users.id`)
- `role` (VARCHAR(50)): `owner`, `admin`, `exam_author`, `proctor`, `candidate`.

### `questions` & `question_revisions`
- `questions.id` (VARCHAR(36), PK)
- `questions.version` (INT): Active version counter.
- `questions.content_json` (TEXT): Current question data.
- `question_revisions.id` (VARCHAR(36), PK)
- `question_revisions.question_id` (VARCHAR(36), FK -> `questions.id`)
- `question_revisions.version` (INT): Snapshot version index.
- `question_revisions.content_json` (TEXT): Historical question data.
- `question_revisions.change_summary` (VARCHAR(255)): Audit change reason.
- `question_revisions.created_by` (VARCHAR(36)): Author who modified item.

### `exams` & `exam_versions`
- `exams.id` (VARCHAR(36), PK)
- `exams.status` (VARCHAR(50)): `draft`, `review`, `approved`, `published`, `archived`.
- `exams.results_released` (BOOLEAN): Publication control for student scorecards.
- `exam_versions.id` (VARCHAR(36), PK)
- `exam_versions.exam_id` (VARCHAR(36), FK -> `exams.id`)
- `exam_versions.version_number` (INT): Snapshot index.
- `exam_versions.snapshot_json` (TEXT): Frozen array of questions and scoring scheme.
- `exam_versions.results_released` (BOOLEAN): Synchronized release status.

### `exam_enrollments`
- `id` (VARCHAR(36), PK)
- `candidate_uid` (VARCHAR(64), INDEX): Exam access UID (`LUN-AIR-2026`).
- `access_pin_hash` (VARCHAR(255)): Salted Bcrypt hash of student PIN.
- `access_pin_plain` (VARCHAR(32)): Plaintext representation for initial admin distribution.
- `candidate_name` (VARCHAR(255)): Student name.
- `max_attempts` (INT): Default 1.
- `attempts_used` (INT): Sitting attempts started.
- `status` (VARCHAR(50)): `active`, `completed`, `revoked`.

### `exam_attempts` & `attempt_answers`
- `exam_attempts.id` (VARCHAR(36), PK)
- `exam_attempts.enrollment_id` (VARCHAR(36), FK -> `exam_enrollments.id`)
- `exam_attempts.deadline_at` (TIMESTAMPTZ): Server clock authoritative expiration.
- `attempt_answers.id` (VARCHAR(36), PK)
- `attempt_answers.sequence_number` (INT): Out-of-order autosave packet deduplication.
- `attempt_answers.revision` (INT): Answer revision counter.

### `appeals`
- `id` (VARCHAR(36), PK)
- `organization_id` (VARCHAR(36), FK -> `organizations.id`)
- `attempt_id` (VARCHAR(36), FK -> `exam_attempts.id`)
- `event_id` (VARCHAR(36), FK -> `proctor_events.id`, nullable)
- `candidate_identifier` (VARCHAR(100)): Candidate UID.
- `reason` (TEXT): Student contestation statement.
- `status` (VARCHAR(50)): `pending`, `accepted`, `rejected`.
- `resolved_by` (VARCHAR(36), FK -> `users.id`)

### `result_revisions`
- `id` (VARCHAR(36), PK)
- `attempt_id` (VARCHAR(36), FK -> `exam_attempts.id`)
- `revised_by` (VARCHAR(36), FK -> `users.id`)
- `previous_score` (FLOAT), `new_score` (FLOAT)
- `reason` (TEXT): Regrading justification.

### Quick Quiz Persistence (`quiz_rooms`, `quiz_participants`, `quiz_rounds`, `quiz_responses`)
- `quiz_rooms`: Multi-tenant persistent game session with `room_code`, `status`, `current_round`, and `per_question_time_seconds`.
- `quiz_participants`: Connected players with `participant_token`, `score`, `streak`, and `is_connected` (supports reconnect recovery).
- `quiz_rounds` & `quiz_responses`: Round questions and player submissions with response time and points.
