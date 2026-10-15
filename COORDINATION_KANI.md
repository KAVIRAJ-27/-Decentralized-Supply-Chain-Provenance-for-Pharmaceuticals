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

---

## 4. Phase 3 Status Update (Admin Module Ready)

Kavi has completed **Phase 3 (Admin Module & Governance)**:
- **Organization Provisioning:** The Admin can register, edit, and activate/deactivate Manufacturers, Distributors, Pharmacies, and Hospitals via `/api/organizations`.
- **User Provisioning:** The Admin provisions accounts for each role (`ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`) mapped to their respective organization IDs via `/api/users`. Passwords are encrypted with PBKDF2 salt/hash.
- **Deactivation Invariant:** Deactivating an organization or user revokes login capabilities immediately while preserving all historical batch traceability and custody logs.
- **Audit Trails:** Administrative activities are persisted under `GET /api/admin/activities`.

---

## 5. Phase 4 Status Update (Authentication & RBAC Enforced)

Kavi has completed **Phase 4 (Authentication & Centralized RBAC)**:
- **Password Security:** All accounts use cryptographic PBKDF2 salt/hashing (10,000 iterations, SHA-512). Passwords and password hashes are never returned in API responses.
- **Rate-Limiting:** `checkLoginRateLimit` protects `/api/auth/login` from brute-force password guessing (429 Too Many Requests after 5 failures).
- **Session Revocation (Logout):** `/api/auth/logout` revokes active tokens in real-time.
- **Middleware for Kani's Modules:**
  - `authenticate`: Validates JWT, verifies token is not revoked, checks user is active, and verifies organization is active. Attaches `req.user` with `id`, `email`, `role`, and `organizationId`.
  - `requireRole('DISTRIBUTOR')` or `requireRole('PHARMACY', 'HOSPITAL')`: Enforces RBAC permissions on backend routes.
  - `requirePermission('CONFIRM_DELIVERY_RECEIPT')`: Fine-grained permission checks using `hasPermission`.
  - `requireOrganizationMatch()`: Prevents cross-organization inventory manipulation.

---

## 6. Phase 5 Status Update (Manufacturer Module & Production Tracking Ready)

Kavi has completed **Phase 5 (Manufacturer Module & Medicine Cataloging)**:
- **Medicine Master Catalog:**
  - Standardized drug specification registration via `POST /api/medicines` with `name`, `genericName`, `description`, `dosageForm`, `strength`, `packaging`.
  - Authorized manufacturers view and manage their organization's catalog via `GET /api/medicines` and `PUT /api/medicines/:id`.
- **Formulate & Mint Batch:**
  - Manufacturers create immutable production lots via `POST /api/batches`.
  - Enforces `BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/`.
  - Validates `expiryDate > manufacturingDate` and `quantity > 0`.
  - Organization lock: `manufacturerOrganizationId` and `manufacturerName` are derived server-side from `req.user`, strictly preventing cross-tenant identity spoofing.
- **Cryptographic QR Code & Physical Label Generation:**
  - High-fidelity SVG QR code encoding the canonical verification route `/?verify=<BATCH_ID>`.
  - Integrated "Print Label" (official GMP slip) and "Download QR" SVG for package application.
  - Public verification at `/api/verify/:batchId` remains read-only without requiring login.
- **Compatibility for Kani's Downstream Modules (Distributor & Pharmacy/Hospital):**
  - All batches minted in Phase 5 are initialized with status `MANUFACTURED` and remain eligible for dispatch:
    - Status: `IN_TRANSIT_TO_DISTRIBUTOR` via `POST /api/batches/:batchId/status`.
    - Distributor reception: `RECEIVED_BY_DISTRIBUTOR`.
    - Pharmacy transit & dispensing: `IN_TRANSIT_TO_PHARMACY` -> `RECEIVED_BY_PHARMACY` -> `DISPENSED`.
- **Test Suite:**
  - Added `backend/test/manufacturer.test.js` (16 automated tests covering login, stats, role guards, medicine CRUD, batch creation, validation, duplicates, QR verification, identity isolation, and persistence).
  - All 57 backend tests passing across Phase 3, 4, and 5 (`npm run test:all`).

- **Frontend Protection:** `/login`, `/admin`, `/manufacturer`, `/distributor`, `/pharmacy`, `/hospital`, and public `/verify/:batchId` are wired with route guards and automatic redirection. Unauthorized access renders the `AccessDenied` view.

---

## 7. Phase 6 Status Update (Blockchain Smart Contract & Verification Service)

Kavi has completed **Phase 6 (Blockchain Smart Contract & Verification Service)**:
- **Smart Contract (`MediTraceProvenance.sol`):**
  - Compiled with Solidity `^0.8.20` using Hardhat optimizer.
  - Deployed locally to `0x5FbDB2315678afecb367f032d93F642f64180aa3` (Chain ID `31337`).
  - Contract ABI exported and typed in `backend/src/services/contractAbi.ts` and `blockchain/deployedAddress.json`.
  - Supported Roles: `ADMIN (1)`, `MANUFACTURER (2)`, `DISTRIBUTOR (3)`, `PHARMACY (4)`, `CONSUMER (5)`, `HOSPITAL (6)`.
  - Supported Statuses: `MANUFACTURED (0)`, `IN_TRANSIT_TO_DISTRIBUTOR (1)`, `RECEIVED_BY_DISTRIBUTOR (2)`, `IN_TRANSIT_TO_PHARMACY (3)`, `RECEIVED_BY_PHARMACY (4)`, `DISPENSED (5)`, `RECALLED (6)`.
- **Decentralized Functions Available for Kani's Modules:**
  - **Distributor Portal:**
    - Receive batch: `receiveByDistributor(batchId, location, tempReading, notes)`
    - Dispatch to Pharmacy/Hospital: `transferToPharmacy(batchId, pharmacyOrHospitalAddress, location, tempReading, notes)`
  - **Pharmacy & Hospital Portals:**
    - Receive batch: `receiveByPharmacy(batchId, location, tempReading, notes)`
    - Dispense to patient: `dispenseMedicine(batchId, dispenseQty, notes)`
  - **Emergency Recall:**
    - `recallBatch(batchId, reason)` (callable by administering manufacturer or super admin)
    - `isBatchRecalled(batchId)` returns `(bool isRecalled, string recallReason)`
  - **Public Verification & Provenance History:**
    - `verifyBatch(batchId)` (unauthenticated, returns batch tuple, manufacturer name, and history count)
    - `getProvenanceHistory(batchId)` (returns full ordered timeline of custody events with timestamps, actors, locations, temperature readings, and notes)
- **Backend Service Layer (`backend/src/services/blockchain.service.ts`):**
  - Integrated with `ethers.js` v6.
  - Custom error hierarchy (`BlockchainConnectionError`, `BlockchainExecutionError`, `BlockchainReceiptError`) ensures blockchain exceptions are never confused with MongoDB/database exceptions.
  - Real transaction receipts required (`tx.wait(1)`) before confirming on-chain mining.
  - Graceful standalone fallback when the local node is offline, keeping the database ledger operational.
- **Verification & Test Status:**
  - 19 Hardhat smart contract tests passing (`npm test` in `blockchain/`).
  - 64 backend tests passing (`npm run test:all` in `backend/`).

---

## 8. Phase 7 Status Update (Shared QR Generation & Verification Logic Ready)

Kavi has completed **Phase 7 (Shared QR Code Generation, Public Verification & Provenance Logic)**:
- **Shared QR Generation Service (`backend/src/services/qr.service.ts`):**
  - Canonical verification URL constructor: `QrService.buildVerificationUrl(batchId, origin)`
  - Standardized GS1/GMP packaging label SVG vector generator: `QrService.generateQrSvg(batchId, size)`
  - Formatted printable GMP label with packaging details: `QrService.generatePrintableLabelHtml(metadata)`
  - Safe QR content parser (`QrService.parseScannedContent`): safely extracts batch IDs from raw text, query URLs (`?verify=`), and path URLs (`/verify/`), while rejecting arbitrary untrusted phishing URLs.
- **Packaging Label Endpoint:**
  - `GET /api/batches/:batchId/qr`: allows authenticated and authorized custodians (`MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`, `ADMIN`) to retrieve packaging vector SVG QR and printable GMP label HTML.
- **Zero-Login Public Verification API:**
  - `GET /api/public/verify/:batchId` & `GET /api/verify/:batchId`:
    - Strict privacy guarantee: private quantities (`quantity`, `remainingQuantity`), user passwords, and employee emails are completely stripped.
    - Exposes permitted facts: medicine name, generic name, dosage, strength, packaging, manufacturer organization name/address, manufacturing & expiry dates, current custodian, and custody history timeline.
    - Integrated with `blockchainService`: verifies on-chain records if the local node is online; gracefully reports `STANDALONE_VERIFIED` if the blockchain node is offline without crashing.
- **Suspicious Scan Telemetry:**
  - Automated scan logging with privacy-safe IP hashing (`ipHash = SHA-256(ip)`).
  - High-velocity detection: triggers `suspiciousScanAlert: true` and `SUSPICIOUS_SCAN_VELOCITY` warning if >10 scans occur within 5 minutes, notifying consumers to check physical tamper seals against label cloning.
- **Public Verification Frontend (`/verify/:batchId` & `/?verify=`):**
  - Zero-login verification portal with loading state, not-found error state, expired warning banner, critical recall warning banner, and incomplete record warning.
  - Interactive packaging QR viewer and "Print GMP Packaging Label" feature.
- **Mobile QR Scanner (`mobile/`):**
  - Camera permission management and live video feed inside the scanning viewfinder.
  - Integration with `parseScannedContent` for safe extraction of batch IDs from QR codes, rejecting malformed and untrusted links.
  - Manual batch ID input fallback.
- **Verification & Test Status:**
  - 19 Hardhat tests passing (`npm test` in `blockchain/`).
  - 78 backend tests passing across all suites (`npm run test:all` in `backend/`).
  - Frontend and Mobile applications build with exit code 0 (`tsc && vite build`).

---

## 9. Phase 8 Status Update (Backend APIs & End-to-End Integration Complete)

Kavi has completed **Phase 8 (Backend APIs, Delivery Lifecycles & Supply Chain Integration)**:
- **Full Delivery & Inventory Lifecycle (`backend/src/controllers/delivery.controller.ts`, `backend/src/routes/delivery.routes.ts`):**
  - `POST /api/deliveries`: Dispatches stock from an authorized source (`MANUFACTURER`, `DISTRIBUTOR`, `ADMIN`) to a verified destination (`DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`).
    - Validates batch authenticity, active status, and non-recall state.
    - Prevents negative inventory: rejects requests exceeding `batch.remainingQuantity` (`INSUFFICIENT_STOCK`).
    - Decrements available stock from `batch.remainingQuantity`.
    - Automatically transitions batch state to `IN_TRANSIT` / `IN_TRANSIT_TO_PHARMACY`.
    - Logs custody history record with environmental temperature sensor readings.
  - `GET /api/deliveries`: Retrieves inbound and outbound deliveries scoped to the user's organization (or all for `ADMIN`).
  - `GET /api/deliveries/:deliveryId`: Fetches delivery details along with the immutable receipt confirmation record once received.
  - `POST /api/deliveries/:deliveryId/confirm-receipt`: Explicit stock intake confirmation by intended recipient organization.
    - **Strict Invariant Enforced:** Deliveries are never marked completed merely by scanning a QR code. They require explicit confirmation by an authenticated member of `toOrganizationId`.
    - **Duplicate Prevention:** Rejects duplicate confirmation attempts (`ALREADY_DELIVERED`).
    - Updates delivery status to `DELIVERED`.
    - Updates batch ownership (`currentOwnerRole`, `currentOwnerName`, `currentOwnerAddress`) and status to `RECEIVED_BY_DISTRIBUTOR` or `RECEIVED_BY_PHARMACY`.
  - `POST /api/deliveries/:deliveryId/cancel`: Aborts an unfulfilled delivery, restoring reserved quantity back to batch available stock.
- **Frontend Integration Connected to Real Backend APIs:**
  - `DistributorPage.tsx`: Connected to `api.getDeliveries()`, `api.createDelivery()`, and `api.confirmDeliveryReceipt()`. Supports formal multi-batch dispatch modal and cold-chain intake confirmation.
  - `PharmacyPage.tsx`: Connected to real inbound deliveries, explicit receipt inspection modal, automated dispensary stock increment, and patient dispensation modal.
  - Clean error states, loading spinners, and visual expiry/recall alerts.
- **Blockchain Graceful Fallback & Non-blocking Logging:**
  - `blockchainService.recordCustodyEventOnChain` is executed asynchronously in non-blocking mode; if the local Hardhat node is offline, API requests proceed seamlessly while recording cryptographic hashes and fallback status `STANDALONE_VERIFIED`.
- **Integration Test Suite (`backend/test/integration.test.js`):**
  - 38 comprehensive end-to-end integration tests verifying the full supply chain:
    - Login across 4 roles (`ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`)
    - Organization provisioning & role escalation protection
    - Medicine registration & batch creation with 5,000 units
    - Duplicate batch registration blocked with 409
    - Zero-login public verification privacy audit (omits private quantities)
    - Stock dispatch & negative inventory prevention (over-dispatch rejected)
    - Unauthorized cross-organization receipt interception blocked (403)
    - Explicit recipient confirmation & batch ownership transition
    - Duplicate confirmation strictly blocked (400)
    - Secondary logistics dispatch to Pharmacy & patient dispensation
    - Delivery cancellation & inventory restoration
    - Batch recall & public warning propagation
- **Verification & Test Status:**
  - 19 Hardhat tests passing (`npm test` in `blockchain/`).
  - **116 backend tests passing across 6 test suites** (`npm run test:all` in `backend/`).
  - Frontend (`frontend/`), Backend (`backend/`), and Mobile (`mobile/`) build with exit code 0.

---

## 10. Phase 9 Status Update (Mobile QR Scanner & Public Verification Complete)

Kavi has completed **Phase 9 (Mobile QR Scanner & Public Verification Experience)**:
- **Responsive Mobile Application (`mobile/`):**
  - Configured Vite with `server.host: true` to enable direct Wi-Fi access on physical Android and iOS mobile devices over LAN (`http://<LAN-IP>:5174`).
  - **Home Screen (`mobile/src/components/HomeScreen.tsx`):**
    - MediTrace brand identity and tagline.
    - Glowing "Scan Medicine QR" primary action.
    - Manual Batch-ID lookup option with automatic format enforcement (`MED-YYYYMMDD-XXXXX`).
    - Persistent scan history stored in `localStorage` with quick re-inspection and clear history options.
    - Prominent patient safety disclaimer: explains that scanning verifies digitally recorded supply chain and blockchain ledger events, not the physical chemical contents of a package.
    - 1-click test simulation suite (Authentic, Expired, Recalled, Unregistered/Counterfeit).
  - **Live Camera QR Scanner (`mobile/src/components/Scanner.tsx`):**
    - Requests camera permission via `navigator.mediaDevices.getUserMedia`.
    - Corner brackets, pulsating laser scanning line, and viewfinder guidelines.
    - Safe QR content parser (`parseScannedContent`): safely extracts batch IDs from direct strings, query URLs (`?verify=`), and path URLs (`/verify/`), while strictly rejecting arbitrary or phishing URLs.
    - Built-in debounce lock (`isLockedRef`) preventing duplicate rapid navigation on repeated frame detections.
    - Informative Permission Denied and Camera Hardware Unavailable views with troubleshooting guidance and manual lookup fallback.
    - "Back to Home" navigation.
  - **Verification Result Screen (`mobile/src/components/MedicineCard.tsx`):**
    - Distinctly handles all 4 required verification states:
      1. **Authentic Record Found:** Displays verified checkmark, permitted drug details, manufacturer origin, current custodian, tamper-evident provenance history with cold-chain sensor readings (°C), and smart contract verification badge.
      2. **Safety Warnings:** Prominent banners for Critical Recalls (with official recall reason), Expired Batches (with past expiry date), and High Scan Velocity (>10 scans in 5 mins).
      3. **Unregistered Batch (Counterfeit Alert - 404):** Warning banner indicating the product is unregistered in the national ledger and may be counterfeit; instructs immediate quarantine.
      4. **Verification Unavailable (Connection Error):** Explains inability to reach backend with a retry button.
    - Advisory notice reminding consumers to inspect physical holographic seals.
    - "Scan Another Medicine QR" and "Home" navigation actions.
  - **Network & Host Settings (`mobile/src/components/NetworkSettingsModal.tsx`):**
    - In-app modal allowing testers and physical phone users to switch between `/api`, `http://localhost:5000/api`, or a custom LAN IP (e.g. `http://192.168.1.X:5000/api`).
    - Integrated live connectivity ping (`GET /api/health`).
- **Automated Mobile Test Suite (`backend/test/mobile-verification.test.js`):**
  - 30 automated tests validating QR parsing, phishing URL rejection, zero-login public verification, privacy protection (stripping internal quantities), 404 counterfeit warnings, expired and recalled batch alerts, and malformed parameter rejections.
- **Verification & Test Status:**
  - 19 Hardhat tests passing (`npm test` in `blockchain/`).
  - **146 backend tests passing across 7 test suites** (`npm run test:all` in `backend/`).
  - `backend`, `frontend`, and `mobile` compile and bundle with exit code 0 (`tsc && vite build`).
---

## 11. Phase 10 Status Update (Final Integration, Testing & Demo Readiness Complete)

Kavi has completed **Phase 10 (Final Integration, Testing & Demo Readiness Audit)**:
- **Comprehensive Multi-Workspace Build & Static Type Checks (100% Passing):**
  - Hardhat Smart Contracts (`blockchain/`): `npx hardhat compile` compiles with code 0; 19 automated tests pass.
  - Backend API (`backend/`): TypeScript `npm run build` succeeds; 146 integration & unit tests pass across 7 suites.
  - Frontend Web Portal (`frontend/`): `tsc && vite build` generates clean production bundle in 1.79s without errors.
  - Mobile Scanner PWA (`mobile/`): `tsc && vite build` generates clean mobile bundle in 1.10s without errors.
  - Repository-wide execution: `npm run test:all` executes all 19 Hardhat tests + 146 backend integration tests (**165 total tests, 0 failures**).
- **Authentication & RBAC System Audit:**
  - Validated all 5 system roles (`ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`) with encrypted PBKDF2 salt/hashing.
  - Deactivated organizations and users are blocked from authentication and protected operations.
  - Role escalation and cross-organization operations are blocked on backend middleware.
  - Zero-login public verification confirmed (`/api/public/verify/:batchId`).
- **End-to-End Supply Chain Provenance Verified:**
  - Admin provisions organizations and user credentials.
  - Manufacturer catalogs drugs, mints batches, generates SVG QR labels, and packages stock.
  - Authorized logistics dispatches stock to recipient organizations with environmental temperature logging.
  - Receiving organizations explicitly confirm delivery intake (`POST /api/deliveries/:deliveryId/confirm-receipt`), updating batch ownership and inventory.
  - Duplicate confirmation is strictly blocked (`400 ALREADY_DELIVERED`).
  - Patients can verify medication authenticity via public QR inspection with zero credentials.
- **Negative & Edge-Case Resilience:**
  - Duplicate batch IDs rejected (`409 CONFLICT`).
  - Over-dispatch and negative quantities rejected (`400 INSUFFICIENT_STOCK`).
  - Expired and recalled batches trigger public visual alert banners and block further logistics dispatch.
  - Phishing and arbitrary URLs scanned by camera are rejected by `parseScannedContent`.
  - Offline blockchain node triggers graceful standalone mode (`STANDALONE_VERIFIED`) with zero API downtime.
- **Final Hackathon Demonstration Guide:**
  - Complete demo script, architecture, ER diagrams, test accounts, and step-by-step walkthrough created at `docs/demo-guide.md`.
  - Verified sample credentials:
    - Admin: `admin@meditrace.org` / `admin123`
    - Manufacturer: `manufacturer@apexpharma.com` / `mfg123`
    - Distributor: `distributor@ghlogistics.com` / `dist123`
    - Pharmacy: `pharmacy@citycare.org` / `pharm123`
    - Hospital: `hospital@stjude.org` / `hosp123`
- **Collaboration Note:**
  - All of Kani's contributions in the Distributor, Pharmacy, Hospital, and Mobile scanner modules have been strictly preserved, tested, and validated.

