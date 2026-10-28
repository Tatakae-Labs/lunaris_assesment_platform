# Lunaris Privacy, Data Governance & Regulatory Compliance

## 1. Compliance Framework
Lunaris assesses compliance obligations under the **Digital Personal Data Protection Act, 2023 (DPDP Act, India)** and relevant global privacy standards (GDPR, FERPA for educational institutions).

---

## 2. Zero Permanent Account Enrollment
- Students taking examinations do not require permanent account registration.
- Candidates authenticate via one-time, exam-specific **Enrollment UIDs** and **PINs**.
- PII collected is strictly limited to the name and optional email required by the organizing institution for result distribution.

---

## 3. Proctoring Privacy Safeguards
1. **On-Device Vision AI Inference**:
   - MediaPipe and COCO-SSD inference runs locally in the student's web browser using WebAssembly and WebGL.
   - Continuous live camera video streams are **NEVER uploaded or stored** on Lunaris servers.
2. **Policy-Triggered Evidence Snapshots**:
   - Still image snapshots are recorded only when a distinct, threshold-exceeding integrity anomaly occurs (e.g., cell phone detected, multiple individuals detected, fullscreen exit).
   - Images are encrypted in transit (TLS 1.3) and at rest (AES-256).
3. **Retention & Deletion Schedules**:
   - Institutional exam data and evidence snapshots default to a 90-day retention schedule, after which evidence assets are permanently purged from object storage.
   - Organization owners can request immediate tenant data exports or cryptographic deletion upon subscription termination.
