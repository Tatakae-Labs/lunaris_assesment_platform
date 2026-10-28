# Lunaris Security Architecture & Verification

## 1. Compliance Baseline
Lunaris is designed against the **OWASP Application Security Verification Standard (ASVS) 5.0** and the **OWASP Multi-Tenant Security Cheat Sheet**.

---

## 2. Authentication & Session Controls
1. **Password Hashing**: User passwords are encrypted using `bcrypt` (or `Argon2id` in production configurations) with a minimum salt work factor of 12. Plaintext passwords are never persisted or logged.
2. **Access Token Lifecycles**:
   - Organization Members & Admins: JWT bearer tokens with 24-hour expiration.
   - Candidates: High-entropy session tokens (`lunaris_cand_<random_base64>`) with a maximum lifespan of 6 hours, bound strictly to the active exam attempt.
3. **Session Revocation**:
   - `UserSession` and `CandidateSession` records maintain an `is_active` flag. Logging out or completing an exam invalidates the token in the database.
4. **Credential Confidentiality**:
   - Candidate access PINs are stored as plain values solely within institutional export views and are never returned in public APIs.
   - UID verification uses constant-time comparison to prevent timing attacks.

---

## 3. Multi-Tenant Authorization & Isolation
1. **Membership-Scoped Access Control**:
   - Authorization is verified on every request using `(user_id, organization_id)`.
   - A user who is an `owner` in Organization A receives `403 Forbidden` if attempting to view or manipulate questions, exams, enrollments, or attempts belonging to Organization B.
2. **Platform Superadmin Boundary**:
   - `is_superadmin` is an immutable platform flag stored on the `User` table.
   - Standard organization creation or invitation cannot grant `is_superadmin`.
   - Platform endpoints under `/api/v1/platform/*` reject any user where `is_superadmin != True`.
3. **Answer Key Masking**:
   - Candidate paper endpoints (`GET /api/v1/candidate/paper` and `GET /api/v1/attempts/{id}/paper`) scrub:
     - `correct_option_id`
     - `correct_option_ids`
     - `numerical_answer`
     - `is_correct`
     - Solutions and explanations
   - Correct answers are only evaluated server-side inside `JeeGradingEngine`.

---

## 4. Evidence Asset Protection
1. **Snapshot Privacy**:
   - Webcam evidence frames captured during proctor incidents are stored in private object storage (`storage_assets/`).
   - Telemetry event references require authenticated proctor role permissions.
   - Presigned access URLs expire automatically after 15 minutes.
