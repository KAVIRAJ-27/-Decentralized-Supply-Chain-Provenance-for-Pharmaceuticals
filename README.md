# MediTrace — Decentralized Supply Chain Provenance for Pharmaceuticals

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636.svg?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Hardhat%2031337-3C3C3D?logo=ethereum&logoColor=white)](https://ethereum.org/)
[![React](https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![NodeJS](https://img.shields.io/badge/Node.js-Express%20TS-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-165%20Passing-brightgreen.svg)](docs/demo-guide.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MediTrace is an end-to-end decentralized pharmaceutical supply chain tracking and provenance verification platform. It provides cryptographic certainty against counterfeit drugs, temperature breaches in the cold chain, and unauthorized distribution through Ethereum smart contracts, multi-role participant portals, and a zero-login mobile QR-scanning verification engine.

---

## 🏛️ System Architecture

```text
                                  +---------------------------------------+
                                  |        Ethereum Blockchain Ledger     |
                                  |  (MediTraceProvenance Smart Contract) |
                                  |         Chain ID: 31337 (Hardhat)     |
                                  +-------------------+-------------------+
                                                      ^
                                                      | JSON-RPC (ethers.js v6)
                                                      v
                                  +-------------------+-------------------+
                                  |         MediTrace Backend API         |
                                  |    (Node / Express / TypeScript / RBAC)|
                                  +---------+-------------------+---------+
                                            |                   |
                       REST API / Protected |                   | REST API (Public Verify)
                                            v                   v
+-------------------------------------------+---+   +-----------+-------------------------------+
|         Management Web Application            |   |           Mobile QR Scanner               |
|            (React 18 / Vite / TS)             |   |        (Mobile Web / PWA Engine)          |
|                                               |   |                                           |
|  - ⚖️ Admin / Drug Regulatory Console          |   |  - 📷 Live Camera QR Viewfinder           |
|  - 🏭 Manufacturer Portal (Batch Mint & QR)   |   |  - 🔍 Zero-Login Public Verification      |
|  - 🚚 Logistics & Distributor Cold Chain      |   |  - ⚠️ Emergency Recall Alert Banner       |
|  - 🏥 Hospital & Pharmacy Dispensary          |   |  - 📋 Permitted Medicine Specifications   |
|  - 🔍 Zero-Login Public Verification Portal   |   |  - 🌐 LAN Wi-Fi Device Access (Port 5174) |
+-----------------------------------------------+   +-------------------------------------------+
```

---

## 📁 Repository Directory Structure

```text
blockchain_pharmacy_supply chain/
├── .gitignore                    # Git ignore file for modules, builds, caches & local data
├── .env.example                  # Safe environment configuration template with test keys
├── package.json                  # Root monorepo workspace configuration & runner scripts
├── README.md                     # Complete project documentation and onboarding guide
├── COORDINATION_KANI.md          # Multi-developer collaboration protocol (Kavi & Kani)
│
├── shared/                       # Shared TypeScript models, contracts & validators
│   ├── package.json
│   ├── index.ts
│   └── types/
│       ├── index.ts              # Roles, BatchStatus, MedicineBatch, Batch ID regex
│       └── permissions.ts        # Fine-grained RBAC permission matrix
│
├── blockchain/                   # Hardhat smart contract development workspace
│   ├── package.json
│   ├── hardhat.config.cjs        # Hardhat configuration (Solidity 0.8.20, optimizer)
│   ├── deployedAddress.json      # Public local deployment metadata (address & chain ID)
│   ├── contracts/
│   │   ├── MediTraceProvenance.sol            # Multi-role supply chain smart contract
│   │   └── interfaces/
│   │       └── IMediTraceProvenance.sol       # Contract interface
│   ├── test/
│   │   └── MediTraceProvenance.test.js        # Hardhat mocha/chai test suite (19 tests)
│   └── scripts/
│       └── deploy.js             # Deployment script with address artifact export
│
├── backend/                      # Node.js + Express + TypeScript Backend API
│   ├── package.json
│   ├── tsconfig.json
│   ├── test/                     # Automated test suites (146 tests)
│   │   ├── admin.test.js         # Regulatory organization & user provisioning
│   │   ├── auth.test.js          # PBKDF2 authentication & rate limiting
│   │   ├── blockchain.test.js    # Smart contract service & fallback checks
│   │   ├── integration.test.js   # Multi-role end-to-end supply chain workflow
│   │   ├── manufacturer.test.js  # Catalog management & lot formulation
│   │   ├── mobile-verification.test.js # Scanner parsing & privacy verification
│   │   └── qr-verify.test.js     # Shared QR generation & velocity detection
│   └── src/
│       ├── index.ts              # Server bootstrap and route mounting
│       ├── config.ts             # Environment variable loader
│       ├── services/
│       │   ├── db.service.ts     # Persistent data store with demo seed data
│       │   ├── blockchain.service.ts # Ethers.js bridge and network health
│       │   ├── contractAbi.ts    # Typed contract ABI & role definitions
│       │   └── qr.service.ts     # QR code vector SVG & GMP label generator
│       ├── middleware/
│       │   ├── auth.middleware.ts    # JWT token validation & revocation
│       │   ├── rbac.ts               # Role-based & organization-level guards
│       │   ├── rateLimiter.ts        # Brute-force login rate limiter
│       │   └── validator.middleware.ts # Standard Batch ID & payload validation
│       ├── controllers/
│       │   ├── admin.controller.ts
│       │   ├── auth.controller.ts
│       │   ├── batch.controller.ts
│       │   ├── delivery.controller.ts
│       │   ├── medicine.controller.ts
│       │   ├── organization.controller.ts
│       │   ├── user.controller.ts
│       │   └── verify.controller.ts
│       └── routes/
│           ├── admin.routes.ts
│           ├── auth.routes.ts
│           ├── batch.routes.ts
│           ├── delivery.routes.ts
│           ├── medicine.routes.ts
│           ├── organization.routes.ts
│           ├── stats.routes.ts
│           ├── user.routes.ts
│           └── verify.routes.ts
│
├── frontend/                     # Management Web Application (React + Vite + TypeScript)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # Main layout, tab navigation, demo role switcher
│       ├── index.css             # Obsidian medical-tech theme and glassmorphism
│       ├── components/
│       │   ├── AccessDenied.tsx  # Unauthorized route fallback
│       │   ├── Navbar.tsx
│       │   ├── QrModal.tsx       # Standard QR code modal with download & copy
│       │   ├── RoleBadge.tsx
│       │   ├── StatusBadge.tsx
│       │   └── Timeline.tsx      # Visual provenance journey with temp readings
│       ├── pages/
│       │   ├── AdminPage.tsx         # Regulatory oversight & emergency recalls
│       │   ├── DistributorPage.tsx   # Intake acknowledgment, cold chain checks
│       │   ├── HospitalPage.tsx      # Inpatient hospital dispensary
│       │   ├── LoginPage.tsx         # Central multi-role login portal
│       │   ├── ManufacturerPage.tsx  # Batch minting, label printing, dispatch
│       │   ├── PharmacyPage.tsx      # Retail dispensary, patient dispensation
│       │   └── PublicVerifyPage.tsx  # Public verification without login
│       ├── services/
│       │   └── api.ts            # Client API bridge
│       └── types/
│           └── index.ts
│
├── mobile/                       # Mobile QR-Scanning App Engine (PWA / LAN-Ready)
│   ├── package.json
│   ├── vite.config.ts            # Configured with server.host for LAN access
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       └── components/
│           ├── HomeScreen.tsx    # Mobile landing, quick scan, and manual lookup
│           ├── MedicineCard.tsx  # Permitted drug info & recall warning banners
│           ├── NetworkSettingsModal.tsx # LAN IP configuration for physical testing
│           └── Scanner.tsx       # Camera viewfinder & batch ID scanner
│
└── docs/                         # Specifications & Live Demo Walkthrough
    ├── api-contracts.md
    ├── architecture.md
    ├── database-design.md
    ├── demo-guide.md             # Complete step-by-step hackathon demo script
    ├── qr-and-blockchain-contracts.md
    └── routing-and-modules.md
```

---

## 🔑 Shared Batch Identifier Standard

To ensure interoperability across all tiers, every unit is identified by a standardized format:
- **Format:** `MED-YYYYMMDD-XXXXX`
- **Regex:** `^MED-\d{8}-[A-Z0-9]{4,8}$`
- **Example:** `MED-20261015-A8F2K`

---

## 🧪 Automated Testing & Verification

The project includes **165 automated tests** across the smart contract and backend integration suites. All tests run and pass cleanly:

```bash
# Run the complete repository test suite (Smart Contracts + Backend APIs)
npm run test:all
```

### Breakdown of Test Results:
- **Smart Contract Tests (`blockchain/test/MediTraceProvenance.test.js`):** 19 passed, 0 failed.
  - Role management, batch creation, custody transfers, patient dispensing, emergency recalls, and query timelines.
- **Backend Admin & Auth Tests (`backend/test/admin.test.js`, `auth.test.js`):** 41 passed, 0 failed.
  - Multi-role provisioning, PBKDF2 encryption, rate-limiting lockout, and token revocation.
- **Backend Manufacturer & Supply Chain Tests (`manufacturer.test.js`, `integration.test.js`):** 54 passed, 0 failed.
  - Medicine master catalog, batch minting, SVG QR generation, explicit receipt intake, and negative inventory prevention.
- **Blockchain Bridge & Fallback Tests (`blockchain.test.js`):** 7 passed, 0 failed.
  - Contract ABI encoding, transaction receipt wait, and graceful `STANDALONE_VERIFIED` fallback when node is offline.
- **QR Code & Public Verification Tests (`qr-verify.test.js`, `mobile-verification.test.js`):** 44 passed, 0 failed.
  - Safe QR content parsing, malicious URL rejection, zero-login public privacy audits, counterfeit 404 warnings, and scan velocity detection.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ LTS recommended)
- **npm:** v9.0.0 or higher
- **Git**

### 2. Environment Setup
Copy the template configuration:
```bash
cp .env.example .env
```
*(The repository is pre-configured with safe local development defaults. No external API keys or cloud services are required for local testing.)*

### 3. Install Dependencies
Install dependencies across all workspaces in one command:
```bash
npm run install:all
```

### 4. Smart Contract Compilation & Local Node (Optional)
```bash
# Compile Solidity contracts
npm run compile:contracts

# Run automated smart contract tests
npm run test:contracts

# Optional: Start local Ethereum node
cd blockchain && npx hardhat node
```

*Note: If the local Hardhat node is not running, the backend seamlessly operates in `STANDALONE_VERIFIED` mode with zero downtime.*

### 5. Running the Application
In separate terminal tabs:
```bash
# 1. Start Backend API (Port 5000)
npm run dev:backend

# 2. Start Management Website (Port 5173)
npm run dev:frontend

# 3. Start Mobile QR Scanner (Port 5174, LAN-accessible)
npm run dev:mobile
```

---

## 👥 Safe Demo Credentials (Local Development)

These synthetic credentials are pre-seeded in the local database for evaluation and demonstration purposes:

| Role | Email | Password | Pre-configured Organization |
|---|---|---|---|
| **ADMIN** | `admin@meditrace.org` | `admin123` | National Drug Regulatory Authority (`ORG-REG-01`) |
| **MANUFACTURER** | `manufacturer@apexpharma.com` | `mfg123` | Apex Biotech Pharmaceuticals Ltd. (`ORG-MFG-01`) |
| **DISTRIBUTOR** | `distributor@ghlogistics.com` | `dist123` | Global Health Logistics & Cold Chain Inc. (`ORG-DIST-01`) |
| **PHARMACY** | `pharmacy@citycare.org` | `pharm123` | City Care Hospital & Central Pharmacy (`ORG-PHARM-01`) |
| **HOSPITAL** | `hospital@stjude.org` | `hosp123` | St. Jude Medical Dispensary (`ORG-HOSP-01`) |
| **CONSUMER** | *None required* | *None* | Zero-login public verification |

---

## 🎬 Live Demonstration Script

For a comprehensive, step-by-step walkthrough of the multi-role supply chain workflow, cold-chain monitoring, public QR scanning, and emergency recalls, refer to:
👉 **[Comprehensive Demonstration Guide](docs/demo-guide.md)**

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
