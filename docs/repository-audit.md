# Technical Audit: ProctorAI Upstream Repository

**Target Repository:** `MrDPrasad/AI-Powered` (forked from `gowthamcgowda22-source/AI-Powered-Assessment-Proctoring-Platform`)  
**Pinned Commit:** `4fe2823dc0fb82ffd2e48447dbd2374fa87c851f`  
**Date of Audit:** October 2026  
**Auditor:** Antigravity AI Engineering Team  

---

## 1. Executive Summary

The upstream repository provides a lightweight prototype demonstrating basic proctoring concepts (MediaPipe FaceLandmarker, YOLOv8 object detection, HTML5 fullscreen & visibility listeners, and basic JWT auth). However, an in-depth codebase audit reveals that **it cannot be deployed as a multi-tenant commercial SaaS without a fundamental re-architecture**.

### Key Findings
1. **Critical Architectural Limitation (Single-Tenant):** No concept of `organizations`, `tenants`, or role-based workspaces. All data (users, exams, questions, submissions) resides in a flat single-tenant schema with sequential integer IDs (IDOR risk).
2. **Missing Core Exam Lifecycle (JEE Incompatible):** Questions are hardcoded to 4 multiple-choice options (`option_a` through `option_d`). It cannot support:
   - JEE Numerical Value Questions (NVQ / decimal input).
   - Multiple-correct options.
   - Section segregation (Physics, Chemistry, Mathematics).
   - Partial marking or standard JEE negative marking schemes (+4, -1, 0).
   - Section-level optionality (e.g., attempt any 5 of 10).
3. **Severe Concurrency & Performance Bottlenecks:**
   - Candidate frames are sent every **1.5 seconds** via synchronous HTTP POST to `/proctor/analyze`.
   - The backend runs heavy CPU/GPU computer vision inference (YOLOv8 + MediaPipe) **synchronously in the FastAPI event loop thread**.
   - With even 10 concurrent candidates, the event loop blocks completely, timing out student autosaves and answer submissions.
4. **Missing Production Assets & Runtime Crashes:**
   - `backend/app/proctoring.py` references `face_landmarker.task`, which is **not present** in the repository. Without manual downloading, the backend crashes on startup.
   - Module-level state dictionary `_previous_lip_distance = {"value": None}` in `proctoring.py` creates a thread-unsafe cross-candidate state leak.
5. **No Evidence Persistence:**
   - Proctoring warnings are saved only as text strings in the database. The captured video frame is discarded immediately, making post-exam human integrity review impossible.
6. **Violates Core Product Principle:**
   - The frontend terminates the candidate's exam automatically upon 3 "Level 2" violations (`MAX_LEVEL2_VIOLATIONS = 3`), violating the fundamental tenet that *AI proctoring produces advisory evidence for human review, not automated verdict*.

---

## 2. Component-by-Component Evaluation

| Component | Upstream State | Assessment | Lunaris Action |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | Single table `users` with `student`/`admin` string enum. Passlib bcrypt + python-jose JWT. | Basic, lacks tenant scoping, refresh tokens, and revocation. | **Refactor into Module 1:** Tenant-aware JWT, Organization memberships, UUID identifiers, ASVS 5.0 compliant session management. |
| **Question Bank & Model** | Hardcoded 4 options (`option_a..d`) embedded inside `questions` table. | Cannot support NVQ, LaTeX, diagrams, or JEE sections. | **Replace with Module 2:** Flexible JSON schema question model supporting Single MCQ, Multi MCQ, Numerical Answers, LaTeX formulas, and immutable exam versions. |
| **Exam State & Timer** | `ExamSession` stores JSON text of shuffled questions. Client manages countdown with `setTimeout`. | Client-skewed timer. Refresh recovery is rudimentary. | **Replace with Module 3:** Server-authoritative start/deadline timestamps, idempotent answer autosave with revision tracking, reconnect tolerance. |
| **AI Proctoring Engine** | Synchronous MediaPipe FaceLandmarker + YOLOv8 in `main.py`. | Blocks web server, missing model assets, no queue. | **Rebuild as Module 4:** Async background worker/task pipeline, ONNX runtime / client-side lightweight models, rate-limited ingestion. |
| **Audio Monitoring** | Web Audio API frequency analysis (~300-3400 Hz voice band). | Client-side energy calculation is innovative and saves bandwidth. | **Retain & Enhance:** Calibrate voice-band energy thresholds, add debouncing, send advisory events rather than raw audio streams. |
| **Browser Security** | `visibilitychange`, `fullscreenchange`, copy/paste/cut blocking, DevTools shortcut traps. | Solid collection of deterrent hooks. | **Retain & Refactor:** Modularize into reusable React hooks (`useBrowserLockdown`), log events cleanly with timestamps, eliminate client-side automatic termination. |
| **Admin Console** | Basic CRUD in React (`AdminViolations.jsx`, `AdminResults.jsx`). | Lacks tenant segregation, audit log filtering, and evidence viewers. | **Rebuild as Module 6:** Dedicated Organization Admin Portal & Live Proctor Console with incident timeline and manual review decisions. |

---

## 3. Retain vs. Replace Matrix

### Retain (with modernization and adaptation)
1. **Client-Side Web Audio Voice-Band Detection:** The FFT frequency bin analysis in `frontend/src/pages/ExamPage.jsx` effectively identifies human voice band without violating privacy by streaming raw audio.
2. **Browser Security Event Handlers:** The fullscreen, visibility change, and keyboard shortcut traps in `ExamPage.jsx` are standard and effective as basic client deterrents.
3. **Core Concept of MediaPipe Iris/Lip Geometric Tracking:** The geometric heuristics for gaze ratio and lip opening are mathematically sound, but must be decoupled from the synchronous HTTP request path.

### Replace / Build Fresh
1. **Multi-Tenant Foundation:** Completely new Organization and Workspace isolation layer.
2. **JEE Exam Delivery Engine:** High-performance, low-latency CBT interface modeled on JEE Main (question palette, marked for review, section tabs, numerical keypad, autosave).
3. **Server-Authoritative Timing:** Immutable deadlines calculated and verified on the server.
4. **Asynchronous Evidence Processing:** Background worker pipeline with private S3-compatible evidence storage.
5. **Deterministic JEE Grading Engine:** Dedicated grading service supporting custom marking schemes (+4/-1/0, partial credit, numerical tolerances).
