# Lunaris REST API Specification

All endpoints are prefixed with `/api/v1`.

---

## 1. Authentication (`/api/v1/auth`)
- `POST /auth/register`: Create user account & tenant organization workspace.
- `POST /auth/login`: Authenticate email/password; returns JWT bearer token and primary org membership.
- `GET /auth/me`: Current user profile, status, and list of organization memberships.

---

## 2. Platform Administration (`/api/v1/platform`)
*(Requires `User.is_superadmin == True`)*
- `GET /platform/stats` (alias `/platform/overview`): Global counts of tenants, exams, attempts, and subscriptions.
- `GET /platform/organizations`: List all registered institutional workspaces.
- `PUT /platform/organizations/{id}/status`: Suspend or activate a customer tenant.
- `PUT /platform/organizations/{id}/plan`: Upgrade or modify tenant subscription tier.
- `GET /platform/plans`: List SaaS subscription catalogue.
- `PUT /platform/plans/{id}`: Update plan pricing and feature entitlement limits.

---

## 3. Organizations & Workspaces (`/api/v1/organizations`)
- `POST /organizations`: Create an additional organization workspace.
- `GET /organizations/my`: List organizations where caller holds a membership.
- `GET /organizations/{id}/members`: List organization faculty, admins, and proctors.
- `POST /organizations/{id}/members`: Invite a faculty member or proctor.
- `GET /organizations/{id}/invite-code`: Retrieve shareable organization joining code.
- `POST /organizations/join`: Join an organization using an invite code.

---

## 4. Question Bank (`/api/v1/questions`)
- `POST /questions`: Create question item (Single MCQ, Multi MCQ, Numerical Value).
- `GET /questions?organization_id={id}`: List questions with optional subject filter.
- `GET /questions/{id}`: Retrieve question details.

---

## 5. Exam Authoring & Versioning (`/api/v1/exams`)
- `POST /exams`: Create an exam draft with duration and JEE settings.
- `GET /exams?organization_id={id}`: List assessments belonging to organization.
- `POST /exams/{id}/publish`: Freezes all questions into an immutable `ExamVersion`.
- `POST /exams/{id}/enrollments/bulk-generate`: Generate one-time candidate access UIDs and PINs.
- `GET /exams/{id}/enrollments`: List candidate enrollments with attempt statuses.

---

## 6. Candidate Examination Delivery (`/api/v1/candidate`)
*(Requires zero permanent account registration; authenticated via `X-Candidate-Session` or `Bearer <session_token>`)*
- `POST /candidate/verify` (alias `/candidate/verify-access`): Validates Exam UID and PIN; returns short-lived session token.
- `POST /candidate/preflight-consent`: Records camera check acknowledgement and privacy consent.
- `POST /candidate/start-attempt`: Atomically reserves the attempt; issues server deadline timestamp.
- `GET /candidate/paper`: Returns sanitized question paper (answer keys scrubbed).
- `POST /candidate/save-answer`: Idempotent autosave with revision tracking.
- `POST /candidate/proctor-event`: Ingests advisory vision and browser telemetry with evidence snapshots.
- `POST /candidate/submit`: Finalizes attempt, evaluates score via `JeeGradingEngine`, returns scorecard.

---

## 7. Proctor Console & Evidence (`/api/v1/proctor`)
- `GET /proctor/sessions?organization_id={id}`: Live dashboard of active candidate sittings.
- `GET /proctor/attempts/{id}/timeline`: Chronological incident events and review decisions.
- `POST /proctor/events/{id}/review`: Human reviewer records verdict (`dismissed`, `confirmed_violation`).
- `GET /proctor/evidence/{asset_id}`: Stream evidence snapshot image for incident inspection.
