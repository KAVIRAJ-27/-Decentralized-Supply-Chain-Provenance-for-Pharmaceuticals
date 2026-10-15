# MediTrace — Decentralized Supply Chain Provenance for Pharmaceuticals

[![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?logo=ethereum&logoColor=white)](https://ethereum.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![NodeJS](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MediTrace is an end-to-end decentralized pharmaceutical supply chain tracking and provenance verification platform. It provides cryptographic certainty against counterfeit drugs, temperature breaches in the cold chain, and unauthorized distribution through Ethereum smart contracts, multi-role participant portals, and a zero-login mobile QR-scanning verification engine.

---

## 🏛️ System Architecture

```text
                                  +---------------------------------------+
                                  |        Ethereum Blockchain Ledger     |
                                  |  (MediTraceProvenance Smart Contract) |
                                  +-------------------+-------------------+
                                                      ^
                                                      | Web3 RPC / JSON-RPC
                                                      v
                                  +-------------------+-------------------+
                                  |         MediTrace Backend API         |
                                  |      (Node / Express / TypeScript)    |
                                  +---------+-------------------+---------+
                                            |                   |
                       REST API / WebSocket |                   | REST API (Public Verify)
                                            v                   v
+-------------------------------------------+---+   +-----------+-------------------------------+
|         Management Web Application            |   |           Mobile QR Scanner               |
|            (React 18 / Vite / TS)             |   |        (Mobile Web / PWA Engine)          |
|                                               |   |                                           |
|  - ⚖️ Admin / Drug Regulatory Console          |   |  - 📷 Camera Viewfinder Scanner           |
|  - 🏭 Manufacturer Portal (Batch Mint & QR)   |   |  - 🔍 Zero-Login Public Verification      |
|  - 🚚 Logistics & Distributor Cold Chain      |   |  - ⚠️ Emergency Recall Alert Banner       |
|  - 🏥 Hospital & Pharmacy Dispensary          |   |  - 📋 Permitted Medicine Specs            |
|  - 🔍 Zero-Login Public Verification Portal   |   |                                           |
+-----------------------------------------------+   +-------------------------------------------+
```

---

## 📁 Repository Directory Structure

```text
blockchain_pharmacy_supply chain/
├── .gitignore                    # Git ignore file for modules, builds, caches & secrets
├── .env.example                  # Environment configuration template
├── package.json                  # Root monorepo workspace configuration & runner scripts
├── README.md                     # Complete project documentation and onboarding guide
├── COORDINATION_KANI.md          # Multi-developer collaboration protocol (Kavi & Kani)
│
├── shared/                       # Shared TypeScript models, contracts & validators
│   ├── package.json
│   ├── index.ts
│   └── types/
│       └── index.ts              # Roles, BatchStatus, MedicineBatch, Batch ID regex
│
├── blockchain/                   # Hardhat smart contract development workspace
│   ├── package.json
│   ├── hardhat.config.cjs        # Hardhat configuration (Solidity 0.8.20, optimizer)
│   ├── contracts/
│   │   ├── MediTraceProvenance.sol            # Main multi-role supply chain smart contract
│   │   └── interfaces/
│   │       └── IMediTraceProvenance.sol       # Contract interface
│   ├── test/
│   │   └── MediTraceProvenance.test.js        # Hardhat mocha/chai test suite
│   └── scripts/
│       └── deploy.js             # Deployment script with address artifact export
│
├── backend/                      # Node.js + Express + TypeScript Backend API
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Server bootstrap and route mounting
│       ├── config.ts             # Environment variable loader
│       ├── services/
│       │   ├── db.service.ts     # Persistent data store with demo seed data
│       │   └── blockchain.service.ts # Blockchain RPC bridge and network health
│       ├── middleware/
│       │   ├── auth.middleware.ts    # JWT token validation & role guards
│       │   └── validator.middleware.ts # Standard Batch ID & payload validation
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── batch.controller.ts
│       │   └── verify.controller.ts  # Zero-login public verification
│       └── routes/
│           ├── auth.routes.ts
│           ├── batch.routes.ts
│           ├── verify.routes.ts
│           └── stats.routes.ts
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
│       │   ├── Navbar.tsx
│       │   ├── RoleBadge.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── Timeline.tsx      # Visual provenance journey with temp readings
│       │   └── QrModal.tsx       # Standard QR code modal with download & copy
│       ├── pages/
│       │   ├── PublicVerifyPage.tsx  # Public verification without login
│       │   ├── ManufacturerPage.tsx  # Batch minting, label printing, dispatch
│       │   ├── DistributorPage.tsx   # Intake acknowledgment, cold chain checks
│       │   ├── PharmacyPage.tsx      # Hospital inventory, patient dispensation
│       │   └── AdminPage.tsx         # Regulatory oversight & emergency recalls
│       ├── services/
│       │   └── api.ts            # Client API bridge
│       └── types/
│           └── index.ts
│
└── mobile/                       # Mobile QR-Scanning App Engine
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        └── components/
            ├── Scanner.tsx       # Camera viewfinder & batch ID scanner
            └── MedicineCard.tsx  # Permitted drug information & recall warnings
```

---

## 🔑 Shared Batch Identifier Standard

To ensure interoperability across all tiers, every unit is identified by a standardized format:
- **Format:** `MED-YYYYMMDD-XXXXX`
- **Regex:** `^MED-\d{8}-[A-Z0-9]{4,8}$`
- **Example:** `MED-20261015-A8F2K`

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher (v24 LTS supported)
- **npm:** v9.0.0 or higher
- **Git**

### 2. Environment Setup
Copy the template configuration:
```bash
cp .env.example .env
```

### 3. Install Dependencies
Install dependencies across all packages in one command:
```bash
npm run install:all
```

### 4. Smart Contract Compilation & Testing
```bash
# Compile Solidity contracts
npm run compile:contracts

# Run automated tests
npm run test:contracts
```

### 5. Running the Application
In separate terminal tabs:
```bash
# 1. Start Backend API (Port 5000)
npm run dev:backend

# 2. Start Management Website (Port 5173)
npm run dev:frontend

# 3. Start Mobile QR Scanner (Port 5174)
npm run dev:mobile
```

---

## 👥 Demo Credentials (Local Development)

| Role | Email | Password | Pre-configured Entity |
|---|---|---|---|
| **ADMIN** | `admin@meditrace.org` | `admin123` | National Drug Regulatory Authority |
| **MANUFACTURER** | `manufacturer@apexpharma.com` | `mfg123` | Apex Biotech Pharmaceuticals Ltd. |
| **DISTRIBUTOR** | `distributor@ghlogistics.com` | `dist123` | Global Health Logistics & Cold Chain Inc. |
| **PHARMACY** | `pharmacy@citycare.org` | `pharm123` | City Care Hospital & Central Pharmacy |
| **CONSUMER** | *None required* | *None* | Zero-login public verification |
