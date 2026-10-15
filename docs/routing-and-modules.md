# MediTrace — Frontend Routing & Module Boundaries Specification

**Version:** 2.0.0 (Phase 2 Baseline)  
**Author:** Kavi (System Architecture and Shared Foundation)

---

## 1. Web Application Routing Map

The management website (`frontend/`) employs a role-aware routing structure. The landing experience allows instantaneous public verification without authentication, or seamless role selection for accredited participants.

```text
/ ---------------------------- Landing / Role Selection / Public Verification (Default View)
/login ----------------------- Institutional Portal Authentication Modal / Screen
/admin ----------------------- National Drug Authority & Regulator Console (Requires ADMIN role)
/manufacturer ---------------- Pharmaceutical Manufacturing Plant Operations (Requires MANUFACTURER role)
/distributor ----------------- Logistics Hub & Cold-Chain Warehouse (Requires DISTRIBUTOR role)
/pharmacy -------------------- Retail Pharmacy Dispensary (Requires PHARMACY role)
/hospital -------------------- Hospital Inpatient Dispensary (Requires HOSPITAL role)
/verify/:batchId ------------- Canonical Public Batch Provenance Verification Page
```

---

## 2. Access Control & Permission Rules

| Route Path | Intended Audience | Authentication Required? | Server-Side Guard |
|---|---|---|---|
| `/` or `/verify` | Consumers, Patients, General Public | **No** (Zero-login) | None (`GET /api/public/verify/:batchId`) |
| `/verify/:batchId` | Anyone with a Batch QR or ID | **No** (Zero-login) | None (`GET /api/public/verify/:batchId`) |
| `/login` | Institutional staff | **No** (Entryway) | Validates credentials against `POST /api/auth/login` |
| `/admin` | Regulatory compliance officers | **Yes** | Server verifies JWT `role === 'ADMIN'` |
| `/manufacturer` | Pharmaceutical lab technicians | **Yes** | Server verifies JWT `role === 'MANUFACTURER'` |
| `/distributor` | Cold-chain warehouse managers | **Yes** | Server verifies JWT `role === 'DISTRIBUTOR'` |
| `/pharmacy` | Retail pharmacists | **Yes** | Server verifies JWT `role === 'PHARMACY'` |
| `/hospital` | Hospital dispensary clinicians | **Yes** | Server verifies JWT `role === 'HOSPITAL'` |

> **SECURITY INVARIANT:** Frontend route guards only control UI presentation. The backend API independently validates the JWT signature, user active status, and role permissions on every API request. Tampering with client routing state will result in `401 Unauthorized` or `403 Forbidden` responses from the backend.

---

## 3. Mobile QR Scanner Separation

- **Application Root:** `mobile/`
- **Port:** `http://localhost:5174` (or mobile device viewport)
- **Design Philosophy:** Clean, lightweight scanner interface with a real-time camera viewfinder or manual batch code input.
- **Strict Boundary:**
  - The mobile scanner is strictly decoupled from back-office management operations.
  - It does **not** provide inventory counts, delivery dispatching, price adjustments, or administrative controls.
  - It displays only permitted clinical and safety attributes: drug name, generic ingredients, dosage form, manufacturer verification badge, expiration status, and recall alerts.
