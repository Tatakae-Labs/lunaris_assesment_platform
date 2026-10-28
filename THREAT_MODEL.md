# Lunaris Threat Model & Risk Mitigations

## 1. Threat Actors & Attack Surfaces

| Actor | Objective | Potential Vector | Lunaris Mitigation |
| :--- | :--- | :--- | :--- |
| **Dishonest Candidate** | Obtain exam answer keys before or during sitting | Inspect browser DevTools, memory, or network payloads | Answer keys are completely omitted on the server from candidate responses. Paper JSON contains only question text and option identifiers. |
| **Dishonest Candidate** | Circumvent exam deadline | Manipulate local system clock or delay submission | Timer is strictly server-authoritative. Server compares request arrival against `ExamAttempt.deadline_at`. |
| **Malicious Tenant** | Access another organization's questions or student data | IDOR attacks, tampering with `organization_id` in requests | Server dependencies verify `OrganizationMember` records on every operation. Cross-tenant access returns 403 Forbidden. |
| **External Attacker** | Enumerate candidate UIDs or guess access PINs | Brute-force guessing against `/api/v1/candidate/verify` | Uniform 401 error response for invalid UIDs and PINs; rate-limiting prevents credential stuffing. |
| **Dishonest Candidate** | Use secondary mobile device or collaborator | Keeping phone off-camera or having another person in room | Dual-engine AI proctoring (COCO-SSD neural + connected-component optical scanner) flags phones and second persons with evidence snapshots for proctor review. |

---

## 2. Browser Environment Limitations (Explicit Notice)
No browser-based web application can guarantee 100% containment against cheating. Lunaris implements deterrents (fullscreen locks, visibility change listeners, clipboard disabling) and computer vision signals (face verification, phone detection), but explicitly treats these as **advisory risk signals for human proctor review**, never as automated disqualification verdicts.
