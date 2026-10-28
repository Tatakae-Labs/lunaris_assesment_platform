# Legal, License & Dependency Audit

**Project:** Lunaris JEE-Style Proctored Assessment SaaS  
**Reference Codebase:** `MrDPrasad/AI-Powered` / `gowthamcgowda22-source/AI-Powered-Assessment-Proctoring-Platform`  
**Date:** October 2026  

---

## 1. Upstream License Verification

### Status: Incomplete / Ambiguous Legal Notice
- **Claim:** The upstream repository `README.md` states:
  ```markdown
  ## Licence
  MIT
  ```
- **Finding:** There is **no root `LICENSE` file** in either `MrDPrasad/AI-Powered` or the original `gowthamcgowda22-source/AI-Powered-Assessment-Proctoring-Platform`.
- **Finding:** Source code files contain **no copyright headers** or license text.
- **Legal Risk:** While an author stating "MIT" in a README indicates intent to grant an MIT license, the lack of standard copyright attribution (`Copyright (c) 2026 [Owner]`) creates legal ambiguity for commercial distribution.

---

## 2. Dependency License Inventory & Copyleft Risk

| Dependency | Stated License | Commercial SaaS Compatibility | Notes & Actions |
| :--- | :--- | :--- | :--- |
| **FastAPI** | MIT | Compatible | High-performance API foundation |
| **Pydantic** | MIT | Compatible | Data validation and schemas |
| **SQLAlchemy** | MIT | Compatible | Enterprise ORM |
| **React 19 / Vite** | MIT | Compatible | Modern frontend runtime |
| **MediaPipe** | Apache 2.0 | Compatible | Permissive, non-viral AI vision |
| **OpenCV** | Apache 2.0 | Compatible | Image processing |
| **PyTorch** | BSD-3-Clause | Compatible | Deep learning framework |
| **Ultralytics (YOLOv8)** | **AGPL-3.0** | **CRITICAL RISK** | **Copyleft Viral License:** Under GNU AGPLv3 Section 13 (Remote Network Interaction), offering a service over a network requires releasing the entire backend source code under AGPL-3.0 unless an enterprise license is purchased from Ultralytics Inc. |

### Critical Recommendation on YOLOv8
**Do NOT bundle `ultralytics` in the proprietary Lunaris SaaS backend.**
- **Alternative 1 (Preferred for Lunaris):** Use **ONNX Runtime** with lightweight COCO-trained MobileNet-SSD or YOLOv8 exported to ONNX format, executed via standard Apache/MIT runtimes without linking the AGPL `ultralytics` package.
- **Alternative 2 (Browser-Side):** Offload object detection to the client browser using WebAssembly / TensorFlow.js, eliminating server-side GPU costs and network image streaming entirely.

---

## 3. Regulatory & Privacy Compliance (India DPDP Act 2023)

As an Indian EdTech / Assessment platform conducting remote proctoring:
1. **Data Fiduciary vs. Data Processor:**
   - The coaching institute / college / enterprise client is the **Data Fiduciary**.
   - Lunaris operates as the **Data Processor**.
2. **Explicit Consent & Notice:**
   - Candidate must be presented with an unambiguous pre-exam consent modal detailing what sensors are active (camera, microphone, focus events).
   - Clear declaration that *no biometric templates or permanent facial recognition identities* are retained beyond the configured exam audit retention window.
3. **Data Minimization & Evidence Retention:**
   - Do NOT record continuous 3-hour video streams.
   - Capture only event-triggered snapshots (e.g., when secondary face or unauthorized object is flagged) and short preflight verification photos.
   - Automatically purge evidence assets after the configured retention period (e.g., 30 days post-exam).
