# MediTrace — Developer Coordination & Interface Agreement (Phase 2)

**Project:** Decentralized Supply Chain Provenance for Pharmaceuticals  
**Primary Collaborators:** Kavi (Architecture & Foundation) & Kani (Distributor, Pharmacy & Hospital Modules)  
**Shared Repository:** [KAVIRAJ-27/-Decentralized-Supply-Chain-Provenance-for-Pharmaceuticals](https://github.com/KAVIRAJ-27/-Decentralized-Supply-Chain-Provenance-for-Pharmaceuticals)

---

## 1. Interface Agreement for Kani's Modules

Dear Kani,  
This document specifies the exact shared contracts, role names, batch formats, and delivery statuses established in Phase 2. Both your **Distributor** and **Pharmacy / Hospital** modules must consume these shared standards to ensure complete end-to-end compatibility.

### A. Role Names (Standardized)
Your code must import and use these exact role identifiers from `@meditrace/shared` (`shared/types/index.ts`):
```typescript
export type UserRole = 
  | 'ADMIN'           // Regulatory authority
  | 'MANUFACTURER'    // Pharmaceutical formulation plant
  | 'DISTRIBUTOR'     // Cold-chain logistics & regional warehouse
  | 'PHARMACY'        // Retail pharmacy dispensary
  | 'HOSPITAL';       // Inpatient hospital dispensary
```
*Note: Public verification is a zero-login inspection mode, not an authenticated role.*

### B. Shared Batch Identifier (Unified Standard)
- **Format:** `MED-YYYYMMDD-XXXXX`
- **Regex:** `/^MED-\d{8}-[A-Z0-9]{4,8}$/`
- **Helper Functions Available in `@meditrace/shared`:**
  - `isValidBatchId(batchId: string): boolean`
  - `generateBatchId(): string`
- Every component (database, smart contract, QR codes, API endpoints, and UI input fields) must use this exact string.

### C. Standardized Delivery Statuses
```typescript
export type DeliveryStatus =
  | 'PENDING'       // Created but not yet dispatched
  | 'DISPATCHED'    // Handed over to logistics carrier
  | 'IN_TRANSIT'    // In transit with active cold chain monitoring
  | 'DELIVERED'     // Explicitly confirmed and accepted into receiving inventory
  | 'CANCELLED';    // Aborted or damaged
```
> **CRITICAL RULE FOR KANI'S MODULES:** A delivery must **never** become `DELIVERED` just because a QR code was scanned. The receiving Distributor, Pharmacy, or Hospital user must explicitly submit a receipt confirmation via `POST /api/deliveries/:deliveryId/confirm-receipt`.

---

## 2. API Contracts for Kani's Work

When implementing the Distributor and Pharmacy/Hospital pages, call these documented endpoints:

| Action in Distributor / Pharmacy Page | HTTP Endpoint | Required Role | Payload / Parameters |
|---|---|---|---|
| **View Inbound Deliveries** | `GET /api/deliveries?direction=inbound` | `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL` | Query parameters for status |
| **Confirm Intake & Receive Stock** | `POST /api/deliveries/:deliveryId/confirm-receipt` | Recipient Org (`DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`) | `{ receivedQuantity: number, remarks: string, location: string }` |
| **Dispatch to Pharmacy/Hospital** | `POST /api/deliveries` | `DISTRIBUTOR` | `{ batchId, toOrganizationId, quantity, expectedDeliveryDate, location, temperatureCelsius }` |
| **Dispense Medication to Patient** | `POST /api/batches/:batchId/dispense` | `PHARMACY`, `HOSPITAL` | `{ quantityToDispense: number, patientReference: string, notes: string }` |
| **Inspect Batch Metadata & Custody** | `GET /api/batches/:batchId` | Any authenticated participant | Route param `batchId` |
| **Public Drug Safety Verification** | `GET /api/public/verify/:batchId` | None (Public Zero-Login) | Route param `batchId` |

---

## 3. File Ownership Boundaries & Branching Protocol

To avoid merge conflicts, please follow this division of files:

### Shared Files (Do Not Modify Unilaterally)
- `shared/types/index.ts` & `shared/index.ts` (Requires mutual alignment)
- `docs/architecture.md`, `docs/database-design.md`, `docs/api-contracts.md`
- Root `package.json`, `.gitignore`, `.env.example`

### Kani's Primary Ownership Areas
- `frontend/src/pages/DistributorPage.tsx` (Distributor cold-chain & intake portal)
- `frontend/src/pages/PharmacyPage.tsx` (Retail pharmacy dispensary & stock reception)
- `frontend/src/pages/HospitalPage.tsx` (Hospital inpatient dispensary)
- `mobile/` (Dedicated mobile QR scanner viewfinder & scanning optimizations)

### Kavi's Primary Ownership Areas
- `blockchain/` (Solidity smart contracts, Hardhat test suites, deploy scripts)
- `backend/` (API routing, JWT & RBAC guards, MongoDB models, blockchain sync)
- `frontend/src/pages/AdminPage.tsx` & `frontend/src/pages/ManufacturerPage.tsx`

### Git Collaboration Rule
1. Always create a feature branch for your work (e.g., `git checkout -b feature/kani-distributor-intake`).
2. Run `npm run test:all` or individual package builds before opening a Pull Request.
3. **Never force-push (`git push --force`)** to `main`.
4. Never commit `.env` or sensitive private keys.
