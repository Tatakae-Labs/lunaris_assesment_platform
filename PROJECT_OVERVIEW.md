# Lunaris Platform — Complete Architectural & Operational Overview

> **Version:** 1.0.0 Production Architecture  
> **Platform Classification:** White-Theme, Enterprise Assessment SaaS & High-Stakes Proctored CBT Platform  
> **Target Audience:** Coaching Institutes (e.g. Allen, Aakash, Resonance), Universities, Certification Bodies, and Independent Educators.

---

## 1. Executive Summary & Value Proposition

**Lunaris** is a multi-tenant, cloud-native assessment platform designed to deliver high-stakes computer-based tests (modeled after the National Testing Agency / NTA JEE Mains & Advanced CBT interface) alongside fast-paced live gamified quizzes (Quizinco-style Quick Quiz arena). 

Unlike conventional test platforms that demand cumbersome user registrations for candidates, Lunaris introduces a **Zero-Friction Candidate Enrollment Architecture**: students take proctored examinations using an exam-specific **Enrollment UID and Access PIN** (accessible via direct URL or mobile-scannable QR pass) with zero permanent account creation. 

Security is maintained through a **Modular, Non-Destructive On-Device Proctoring System** leveraging MediaPipe and computer vision heuristics. Facial telemetry, student movements, tab-switching, and clipboard security events are evaluated as **advisory risk signals** for human review rather than automatic, error-prone disqualifications.

---

## 2. Technology Stack & System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LUNARIS FRONTEND                              │
│  React 18 • Vite • React Router DOM v6 • Vanilla CSS Design System    │
│  On-Device MediaPipe / FaceDetector CV • Web Audio • QR Generator     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP REST & Telemetry Ingestion
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          LUNARIS BACKEND                               │
│  FastAPI (Python 3.12) • Pydantic v2 • SQLAlchemy 2.0 ORM             │
│  Uvicorn ASGI Server • Automated Scoring Engine • Evidence Storage     │
└──────────────────┬───────────────────────────────┬─────────────────────┘
                   │                               │
        ┌──────────┴──────────┐         ┌──────────┴──────────┐
        │ SQLite / PostgreSQL │         │ Groq AI API         │
        │ + Local MongoDB     │         │ LLaMA-3.3-70B Model │
        │ Master Data Schema  │         └─────────────────────┘
        └─────────────────────┘
```

### 2.1. Frontend Specifications
- **Framework:** React 18 with Vite bundling (~2.3s production build time).
- **Routing:** `react-router-dom` v6 with dedicated declarative routes (`/`, `/features`, `/pricing`, `/login`, `/register`, `/join`, `/dashboard`, `/candidate`, `/exam/:slug`, `/proctor`, `/quiz/:roomCode`).
- **Styling Philosophy:** Modern Vanilla CSS design system featuring a clean **White Theme** (`--bg-primary: #ffffff`), subtle borders (`#e2e8f0`), glassmorphic overlays, and curated HSL accents (Royal Blue `#2563eb`, Emerald `#16a34a`, Rose `#dc2626`).
- **Client-Side AI/CV:** On-device MediaPipe & HTML5 Canvas optical variance analysis for face presence, movement deviation, and multi-person detection.

### 2.2. Backend Specifications
- **Framework:** FastAPI (Python 3.12) with asynchronous routers and Pydantic validation schemas.
- **ORM & Database:** SQLAlchemy 2.0 with declarative base models and SQLite (development) / PostgreSQL (production) compatibility.
- **AI Synthesis Provider:** Groq Cloud API with `llama-3.3-70b-versatile` running high-speed JSON structured generation with curriculum template fallbacks.
- **Security & Cryptography:** Passlib (Bcrypt) password hashing, python-jose for JWT organization tokens, and cryptographic secrets for candidate session tokens.

---

## 3. Core Functional Modules & Features

### 3.1. Organization Workspace & Tenancy
- **Role-Based Access Control (RBAC):**
  - **Owner / Administrator:** Full platform control, billing, member invites, plan quotas.
  - **Faculty / Exam Author:** Creates question banks, synthesizes items with Groq AI, authors and publishes exam papers.
  - **Proctor / Reviewer:** Monitors live candidate telemetry, audits timeline incidents, confirms or dismisses integrity flags.
  - **Candidate:** Secure UID access to assigned examination papers.
- **Permanent Workspace Collaboration Key:** Each organization possesses an immutable invite code (e.g. `ORG-ALLEN-KOTA-MOCK`) allowing faculty colleagues to join the workspace with a single click.

### 3.2. Examination Modes
1. **NTA JEE-Style Proctored CBT:**
   - Multi-subject navigation (Physics, Chemistry, Mathematics).
   - Interactive 5-state NTA question palette (Answered, Not Answered, Marked for Review, Answered & Marked, Not Visited).
   - Single-Choice MCQs and Numerical Value Questions (NVQ) with decimal tolerance matching.
   - Server-governed authoritative countdown timer with automatic force-submission on expiration.
   - Non-blocking continuous answer autosave with network retry resilience.
2. **Speed-Based Quick Quiz Arena:**
   - Synchronous multiplayer room hosting via 6-digit room code.
   - Per-question countdown timer (e.g. 20s) with exponential speed bonus scoring.
   - Instant answer verification and podium leaderboard reveal.

### 3.3. AI Question Studio (Groq LLaMA-3.3-70B)
- Faculty input topic, subject, difficulty, and question type.
- Groq AI generates valid JEE curriculum items with step-by-step LaTeX explanations and distractors.
- Draft-to-production approval pipeline: Faculty can review, edit, approve, or reject AI questions before they enter the official question bank.

### 3.4. Zero-Account Candidate Enrollment & Mobile Pass
- Administrators generate batches of secure, unique enrollment UIDs (e.g. `LUN-827850`) and optional access PINs.
- Instant QR Pass generator creates dynamic scannable passes (`api.qrserver.com`) allowing students to launch their test on any device or tablet without signing up.

---

## 4. Security, Fullscreen Lockdown & Proctoring Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE EXAM SITTING                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. FULLSCREEN LOCK:                                                    │
│    • Automatic requestFullscreen() on start                            │
│    • If exited: Immediate un-dismissible warning modal overlay         │
│    • Event dispatched: "fullscreen_exit" (Suspicious)                  │
├────────────────────────────────────────────────────────────────────────┤
│ 2. ANTI-COPY & CLIPBOARD LOCKDOWN:                                     │
│    • Copy, Cut, Paste events blocked (e.preventDefault())              │
│    • Context menu right-click disabled                                 │
│    • Keyboard intercept: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U, F12           │
│    • CSS userSelect: "none" across all question text                   │
│    • Event dispatched: "clipboard_copy_attempt" (Suspicious)           │
├────────────────────────────────────────────────────────────────────────┤
│ 3. ON-DEVICE COMPUTER VISION & SENSORS:                                │
│    • Camera feed mirrored in on-screen monitoring badge                │
│    • Multi-face detection: Multiple people in camera frame             │
│    • Student movement: Head deviation / looking away from screen       │
│    • Face absence: No student face detected for >6 seconds             │
│    • Browser tab switch & window blur detection                        │
│    • Event dispatched: "multiple_faces_detected", etc.                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Real-time Telemetry + Snapshot Base64
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       LIVE PROCTOR MONITOR (3s)                        │
├────────────────────────────────────────────────────────────────────────┤
│ • Real-time student cards & telemetry counter                          │
│ • Live alert ticker with severity badges (Advisory vs. Suspicious)     │
│ • Photo evidence inspection modal with timestamped snapshots           │
│ • Human audit actions: "Confirm Violation" vs. "Dismiss Flag"          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete End-to-End Lifecycle

1. **Workspace Initiation:** Organization admin logs in or creates account, selects subscription tier, and obtains organization workspace key.
2. **Item Banking & AI Synthesis:** Faculty authors questions manually or prompts Groq LLaMA-3.3-70B for topic-specific items.
3. **Exam Assembly & Publishing:** Exam title, duration (e.g. 180 mins), and questions are assembled into an Exam. Publishing generates an **immutable snapshot version** (`ExamVersion`).
4. **Enrollment Generation:** Administrator generates candidate UIDs with 1-click CSV export or direct QR passes.
5. **Preflight Verification:** Student scans QR code, validates UID, verifies camera sensor, and accepts the privacy & integrity guidelines.
6. **Proctored Sitting:** Exam begins in strict fullscreen mode. Anti-copy lockdown is enforced. Answers autosave to the backend. Anomaly events stream to the proctoring queue.
7. **Live Proctor Supervision:** Instructors watch the live console, view active candidate statuses, inspect flagged snapshots, and log audit decisions.
8. **Evaluation & Comprehensive Scorecard:** On submission or timeout, the `JeeGradingEngine` calculates positive/negative marks, accuracy %, and question breakdown, presenting an instant rich scorecard.

---

## 6. Database Models & Schema Map

- **`User`**: Account identity, email, password hash, platform role (`owner`, `admin`, `candidate`).
- **`Organization`**: Tenant identity, slug, name, plan ID (`free`, `creator_pro`, `institution`).
- **`OrganizationMember`**: Mapping between users and organizations with permissions.
- **`Question`**: Master item bank with subject, question type, and JSON options/numerical answers.
- **`Exam`**: Exam blueprint with mode (`proctored_cbt`, `quick_quiz`) and duration.
- **`ExamVersion`**: Immutable snapshot created upon publishing to ensure question integrity.
- **`ExamEnrollment`**: Student exam token with UID, PIN, attempt limit, and validity window.
- **`CandidateSession`**: Short-lived session token governing the candidate's exam sitting.
- **`ExamAttempt`**: Student exam sitting record with deadline, status, total score, and answers JSON.
- **`AttemptAnswer`**: Individual question response with revision counter and timestamp.
- **`ProctorEvent`**: Logged anomaly with event type, severity, metadata, and optional evidence asset.
- **`EvidenceAsset`**: JPEG snapshot captured on-device during an anomaly event.
- **`ReviewDecision`**: Human proctor ruling (`confirmed_violation` or `dismissed`) with notes.

---

## 7. Prompts & Improvisation Ideas for ChatGPT

*Use the following prompt starters with this document in ChatGPT to expand features:*
- **Prompt 1 (Audio Proctoring):** *"Using this architecture, design a Web Audio API continuous acoustic anomaly detector that identifies whisper and speech frequencies without recording continuous audio."*
- **Prompt 2 (WebRTC Live Stream):** *"How can we extend the 3-second proctoring telemetry snapshots to selective WebRTC video streaming when a candidate triggers 3+ critical incidents?"*
- **Prompt 3 (NTA Score Normalization):** *"Design a multi-shift percentile score normalization formula in Python matching NTA JEE Mains standards."*
