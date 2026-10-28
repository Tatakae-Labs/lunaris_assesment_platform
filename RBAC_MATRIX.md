# Lunaris Role-Based Access Control (RBAC) Matrix

## 1. Role Scopes

| Role | Scope | Description |
| :--- | :--- | :--- |
| **Platform Superadmin** | Entire Platform | Manages customer tenants, global SaaS catalogue, and system operational health. |
| **Organization Owner** | Organization | Full authority over billing, membership invitations, and organization profile. |
| **Organization Admin** | Organization | Manages exams, member assignments, batches, and candidate enrollments. |
| **Exam Author / Faculty**| Organization | Creates questions in Question Bank, assembles exams, reviews AI drafts. |
| **Proctor** | Assigned Sessions| Live candidate telemetry monitoring, evidence timeline, incident review decisions. |
| **Candidate** | Active Session | Zero-account exam attempt: answers questions, views permitted scorecard. |

---

## 2. Resource Permission Matrix

| Resource & Operation | Superadmin | Org Owner | Org Admin | Faculty | Proctor | Candidate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tenant Lifecycle (Suspend/Activate)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Platform Analytics & Health** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SaaS Subscription & Billing** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Invite & Remove Org Members** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create & Edit Question Banks** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Publish Exam (Immutable Snapshot)** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Generate Candidate UIDs / PINs** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Monitor Live Telemetry Stream** | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Confirm / Dismiss Proctor Violations**| ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Take Assigned Exam Attempt** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Access Unsanitized Answer Keys** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
