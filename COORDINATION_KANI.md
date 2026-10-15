# MediTrace — Developer Coordination & Collaboration Protocol
**Project:** Decentralized Supply Chain Provenance for Pharmaceuticals  
**Primary Collaborators:** Kavi & Kani  
**Shared Repository:** [KAVIRAJ-27/-Decentralized-Supply-Chain-Provenance-for-Pharmaceuticals](https://github.com/KAVIRAJ-27/-Decentralized-Supply-Chain-Provenance-for-Pharmaceuticals)

---

## 1. Core Principles & Shared Workspace Agreement

1. **Single Source of Truth:** Both Kavi and Kani collaborate in this single repository. No separate repositories will be created.
2. **Protection of Work:**
   - Always run `git pull --rebase origin main` before creating new branches or pushing.
   - **Never force-push (`git push --force`)** to `main` or another contributor's branch.
   - Never commit `.env` or sensitive private keys. Always use `.env.example`.
   - All shared changes must align with the unified domain models in `shared/types/index.ts`.

---

## 2. Standardized Domain Conventions (Agreed)

### A. Role Names
| Role Identifier | Description | Allowed Actions |
|---|---|---|
| `ADMIN` | Government / Drug Regulatory Authority | Register/revoke network participants, system audits, global emergency recall |
| `MANUFACTURER` | Licensed Pharmaceutical Manufacturing Lab | Mint medicine batches, generate batch QR codes, dispatch to distributors, initiate recalls |
| `DISTRIBUTOR` | Logistics Provider & Cold-Chain Vaults | Acknowledge receipt, record transit temperatures, dispatch to pharmacies/hospitals |
| `PHARMACY` | Certified Hospital or Retail Dispensary | Receive verified batches, inventory count, dispense medication to patients with prescription ref |
| `CONSUMER` | Public Patient / Consumer | Zero-login verification via web portal or mobile QR scanner |

### B. Shared Batch Identifier Format
- **Format:** `MED-YYYYMMDD-XXXXX`
- **Regex:** `^MED-\d{8}-[A-Z0-9]{4,8}$`
- **Examples:**
  - `MED-20261015-A8F2K`
  - `MED-20261015-00101`
- **Rule:** This exact string must be used across the smart contract, backend database, frontend UI, QR payloads, and mobile scanner.

### C. Lifecycle Delivery Status Values
```typescript
export enum BatchStatusEnum {
  MANUFACTURED = 0,
  IN_TRANSIT_TO_DISTRIBUTOR = 1,
  RECEIVED_BY_DISTRIBUTOR = 2,
  IN_TRANSIT_TO_PHARMACY = 3,
  RECEIVED_BY_PHARMACY = 4,
  DISPENSED = 5,
  RECALLED = 6,
}
```

---

## 3. Module Ownership & Workspace Division

| Workspace | Primary Owner | Secondary / Reviewer | Scope & Responsibilities |
|---|---|---|---|
| `blockchain/` | **Kavi** | Kani | Solidity smart contracts (`MediTraceProvenance.sol`), Hardhat tests, deploy scripts, gas optimization |
| `backend/` | **Kavi** | Kani | Node/Express API routes, auth & role guards, SQLite/DB models, blockchain sync service |
| `frontend/` | **Kavi & Kani** | Pair Review | React/Vite web application: Admin, Manufacturer, Distributor, Pharmacy, Public Verify portals |
| `mobile/` | **Kani** | Kavi | Mobile QR scanner web engine, camera viewfinder integration, permitted details card, offline mode |
| `shared/` | **Shared** | Mutual Approval | TypeScript interfaces, API response types, batch ID generators & validators |

---

## 4. Unified API Endpoints

### Public Endpoints (No Authentication Required)
- `GET /api/health` — Service health check
- `GET /api/verify/:batchId` — Public provenance verification with full audit trail & safety check
- `GET /api/stats` — High-level supply chain metrics and blockchain connection status

### Authenticated Participant Endpoints
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Current authenticated participant profile
- `GET /api/auth/participants` — List verified supply chain participants
- `GET /api/batches` — List batches filtered by ownership/role
- `GET /api/batches/:batchId` — Detailed batch metadata with full custody event history
- `POST /api/batches` — Manufacturer mints new batch (`MANUFACTURER` role required)
- `POST /api/batches/:batchId/status` — Custody handoff & status update (`MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`)
- `POST /api/batches/:batchId/dispense` — Dispense medication to patient (`PHARMACY` role required)
- `POST /api/batches/:batchId/recall` — Trigger emergency recall (`ADMIN` or `MANUFACTURER` required)

---

## 5. Development & Testing Commands

From the project root:
```bash
# Install all dependencies across all packages
npm run install:all

# Smart contract compilation & tests
npm run compile:contracts
npm run test:contracts

# Build components
npm run build:backend
npm run build:frontend
npm run build:mobile

# Run development servers
npm run dev:backend   # API server on http://localhost:5000
npm run dev:frontend  # Web app on http://localhost:5173
npm run dev:mobile    # Mobile scanner on http://localhost:5174
```
