# Lunaris Assessment Platform

> **Multi-Tenant Computer-Based Examination & Institutional Assessment Platform**  
> *Engineered to the standards of the October 2026 Architectural Blueprint.*

---

## 1. System Overview

Lunaris Assessment Platform is a specialized institutional testing platform designed for coaching institutes, universities, and recruitment teams administering high-stakes computer-based tests (CBT), specifically modeled on rigorous competitive examination formats.

### Key Innovations & Principles
- **Server-Authoritative Lifecycle:** Exam timing, question release, answer persistence, and scoring are strictly enforced by the server. The client timer is purely cosmetic.
- **Full JEE CBT Interface:** Authentic 5-state question palette (*Answered, Not Answered, Marked for Review, Answered & Marked for Review, Unvisited*), section tabs (Physics, Chemistry, Mathematics), and on-screen numerical keypad for Numerical Value Questions (NVQ).
- **Idempotent Answer Synchronization:** Out-of-order and duplicate answer autosaves are resolved via monotonically increasing revision counters. Survives page refreshes and transient connection drops.
- **Evidence-Based Proctoring:** Anomaly signals (tab switching, fullscreen exits, audio energy spikes, face presence) are recorded as advisory evidence for human review rather than causing arbitrary automated disqualification.
- **Strict Multi-Tenant Isolation:** Complete schema-enforced tenant boundaries preventing cross-organization IDOR leaks.

---

## 2. Pre-Fork Audit Summary (ProctorAI Upstream)

The upstream reference repository (`MrDPrasad/AI-Powered`, commit `4fe2823dc0fb82ffd2e48447dbd2374fa87c851f`) was audited with key findings:

1. **Licensing & Legal Risk:**
   - Missing root `LICENSE` file in the upstream repository.
   - Upstream bundled `ultralytics` (YOLOv8), which is licensed under **GNU AGPL-3.0**. Using this directly in a networked commercial SaaS creates copyleft viral licensing risks. Lunaris isolates AI inferences into client-side WebAssembly / ONNX runtimes.
2. **Missing Runtime Assets:**
   - Upstream referenced `face_landmarker.task`, which was missing from the repository, causing crashes on startup.
3. **Concurrency Bottlenecks:**
   - Upstream ran synchronous computer-vision inference directly in the FastAPI event loop thread on every 1.5s POST request, blocking answer persistence under real exam loads.
4. **Architectural Gaps:**
   - Single-tenant schema, hardcoded 4-option questions (`option_a` through `option_d`), no NVQ support, and no evidence image storage.

*For complete technical analysis, see [`docs/repository-audit.md`](file:///g:/Lunaris/docs/repository-audit.md) and [`docs/license-and-legal-review.md`](file:///g:/Lunaris/docs/license-and-legal-review.md).*

---

## 3. Repository Architecture

```
g:\Lunaris\
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & demo seeder
│   │   ├── core/                # Database connection, config, JWT security
│   │   ├── models.py            # Normalized multi-tenant relational schema
│   │   ├── auth/                # Multi-tenant auth, registration, RBAC
│   │   ├── organizations/       # Workspaces, roles, invitations
│   │   ├── question_bank/       # Single MCQ, Multi MCQ, NVQ questions
│   │   ├── exams/               # Draft exams, immutable version snapshots
│   │   ├── attempts/            # Candidate delivery engine & autosave
│   │   ├── grading/             # Deterministic JEE evaluation (+4, -1, NVQ)
│   │   ├── proctoring/          # Ingestion, timeline & human review
│   │   └── evidence/            # Encrypted snapshot storage service
│   ├── tests/
│   │   ├── test_grading.py      # JEE scoring engine test suite
│   │   └── test_auth_tenancy.py # End-to-end integration test
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── candidate/           # JEE CBT Portal, QuestionPalette, Keypad
│   │   ├── proctor-console/     # Live monitoring & incident review
│   │   ├── shared/              # API client & design tokens
│   │   └── App.jsx              # Navigation and mock exam launcher
│   ├── package.json
│   └── vite.config.js
├── infra/
│   ├── docker-compose.yml       # Production stack (Backend, Frontend, Postgres)
│   └── .env.example
└── docs/
    ├── architecture.md          # System design & JEE state machine
    ├── threat-model.md          # OWASP ASVS 5.0 alignment
    ├── repository-audit.md      # Upstream technical audit
    └── license-and-legal-review.md # Legal, copyright & AGPL analysis
```

---

## 4. Running the Project Locally

### Prerequisites
- Python 3.12+
- Node.js 20+

### Step 1: Start Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # On Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Step 2: Run Tests
```bash
cd backend
python -m pytest
```

### Step 3: Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

Click **"Launch JEE Grand Mock Exam"** on the landing page to automatically initialize the sample JEE Main mock test, log in as a candidate, and test the full CBT interface!
