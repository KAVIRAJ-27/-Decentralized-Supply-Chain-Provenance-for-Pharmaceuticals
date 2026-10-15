# MediTrace — Comprehensive API Specification & Interface Contracts

**Version:** 2.0.0 (Phase 2 Baseline)  
**Base URL:** `http://localhost:5000/api`  
**Protocol:** REST over HTTPS, JSON payload formats  
**Author:** Kavi (System Architecture and Shared Foundation)

---

## 1. Authentication & Security Standard

- **Authentication Scheme:** Bearer Token via HTTP Header: `Authorization: Bearer <jwt_token>`
- **Token Format:** JSON Web Token (JWT) signed with `HS256`, containing:
  ```json
  {
    "userId": "USR-00102",
    "organizationId": "ORG-MFG-01",
    "role": "MANUFACTURER",
    "exp": 1792100000
  }
  ```
- **Error Format (Unified Envelope):**
  ```json
  {
    "success": false,
    "error": "Error description",
    "code": "ERROR_CODE",
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```
- **Public Verification Exemption:** `GET /api/public/verify/:batchId` and `GET /api/verify/:batchId` **never** require an Authorization header or login token.

---

## 2. API Contract Endpoints

### Group 1: Authentication

#### 1.1 `POST /api/auth/login`
Authenticates an accredited institutional user and issues a JWT token.
- **Authorized Roles:** Unauthenticated / Any
- **Request Body:**
  ```json
  {
    "email": "manufacturer@apexpharma.com",
    "password": "securePassword123"
  }
  ```
- **Validation Rules:**
  - `email` must be a valid email format.
  - `password` must be non-empty.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "USR-00102",
      "name": "Dr. Sarah Chen",
      "email": "manufacturer@apexpharma.com",
      "role": "MANUFACTURER",
      "organizationId": "ORG-MFG-01",
      "organizationName": "Apex Biotech Pharmaceuticals Ltd."
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "Email and password are required", "code": "VALIDATION_ERROR" }`
  - `401 Unauthorized`: `{ "error": "Invalid email or credentials", "code": "INVALID_CREDENTIALS" }`

#### 1.2 `POST /api/auth/logout`
Invalidates or clears client session cookies / marks token revocation.
- **Authorized Roles:** Any authenticated user
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Successfully signed out",
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

#### 1.3 `GET /api/auth/me`
Retrieves profile and permissions for the currently authenticated caller.
- **Authorized Roles:** Any authenticated user
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "userId": "USR-00102",
      "organizationId": "ORG-MFG-01",
      "name": "Dr. Sarah Chen",
      "email": "manufacturer@apexpharma.com",
      "role": "MANUFACTURER",
      "organizationName": "Apex Biotech Pharmaceuticals Ltd.",
      "licenseNumber": "MFG-FDA-8832-GMP"
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Missing or expired token.

---

### Group 2: Organizations & Users (Institutional Management)

#### 2.1 `GET /api/organizations`
Lists accredited organizations in the pharmaceutical network.
- **Authorized Roles:** `ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`
- **Query Parameters:** `type` (optional: `MANUFACTURER | DISTRIBUTOR | PHARMACY | HOSPITAL`), `status` (optional)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "organizationId": "ORG-MFG-01",
        "name": "Apex Biotech Pharmaceuticals Ltd.",
        "type": "MANUFACTURER",
        "address": "100 Innovation Park, Formulation Suite 4",
        "contactEmail": "compliance@apexpharma.com",
        "licenseNumber": "MFG-FDA-8832-GMP",
        "status": "ACTIVE",
        "createdAt": "2026-10-01T00:00:00.000Z"
      }
    ],
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

#### 2.2 `POST /api/organizations`
Registers and accredits a new supply chain participant.
- **Authorized Roles:** `ADMIN` strictly
- **Request Body:**
  ```json
  {
    "name": "Global Health Logistics & Cold Chain Inc.",
    "type": "DISTRIBUTOR",
    "address": "Vault 3, Logistics Corridor West",
    "contactEmail": "dispatch@ghlogistics.com",
    "licenseNumber": "DST-LOG-4412",
    "walletAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  }
  ```
- **Validation Rules:**
  - `licenseNumber` must be unique.
  - `type` must be one of `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`.
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": { "organizationId": "ORG-DIST-02", "name": "Global Health Logistics & Cold Chain Inc.", "status": "ACTIVE" },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: Non-admin caller.
  - `409 Conflict`: Organization with license number already exists.

#### 2.3 `GET /api/users`
Lists users belonging to the caller's organization (or all users for Admin).
- **Authorized Roles:** `ADMIN` (all), Orgs (their own members)
- **Success Response (`200 OK`):** Array of User records without `passwordHash`.

#### 2.4 `POST /api/users`
Creates a new authenticated user for an organization.
- **Authorized Roles:** `ADMIN` or Org Manager
- **Validation Rules:** Valid unique email, password minimum 8 chars, matching organization ID.

---

### Group 3: Medicine & Batches

#### 3.1 `POST /api/medicines`
Registers an approved pharmaceutical formulation catalog entry.
- **Authorized Roles:** `MANUFACTURER`, `ADMIN`
- **Request Body:**
  ```json
  {
    "name": "Amoxicillin Clavulanate",
    "genericName": "Amoxicillin / Clavulanic Acid",
    "description": "Broad-spectrum antibacterial tablets",
    "dosageForm": "Tablet",
    "strength": "625mg USP"
  }
  ```
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "medicineId": "MED-FORM-104",
      "name": "Amoxicillin Clavulanate",
      "manufacturerOrganizationId": "ORG-MFG-01"
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

#### 3.2 `GET /api/medicines`
Lists approved medicine catalog entries.
- **Authorized Roles:** All authenticated users

#### 3.3 `POST /api/batches`
Mints and registers a new physical medicine batch on MongoDB and the Blockchain ledger.
- **Authorized Roles:** `MANUFACTURER`
- **Request Body:**
  ```json
  {
    "batchId": "MED-20261015-A8F2K",
    "medicineId": "MED-FORM-104",
    "batchNumber": "LOT-2026-441",
    "drugName": "Amoxicillin Clavulanate",
    "genericName": "Amoxicillin / Clavulanic Acid",
    "dosage": "625mg USP Tablets",
    "quantity": 5000,
    "manufacturingDate": "2026-10-01T08:00:00.000Z",
    "expiryDate": "2028-10-01T08:00:00.000Z",
    "location": "Plant A - Formulation Bay 4"
  }
  ```
- **Validation Rules:**
  - `batchId` must strictly match regex: `/^MED-\d{8}-[A-Z0-9]{4,8}$/`.
  - `quantity` must be positive integer (`> 0`).
  - `expiryDate` must be after `manufacturingDate`.
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Batch minted and anchored to blockchain",
    "data": {
      "batchId": "MED-20261015-A8F2K",
      "status": "MANUFACTURED",
      "blockchainTxHash": "0x94f1c7d23a10e82937e20b33c1d982ab91c890123f9901adbc389021a88190c1",
      "qrCodeUrl": "https://meditrace.network/verify/MED-20261015-A8F2K"
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

#### 3.4 `GET /api/batches/:batchId`
Retrieves internal detailed batch metadata and complete custody history.
- **Authorized Roles:** Authenticated participants (`ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `PHARMACY`, `HOSPITAL`)
- **Success Response (`200 OK`):** Complete `MedicineBatch` record with remaining quantities, transaction manifests, and audit events.

---

### Group 4: Supply-Chain Operations & Deliveries

#### 4.1 `POST /api/deliveries`
Initiates a dispatch shipment manifest from one organization to another.
- **Authorized Roles:** `MANUFACTURER`, `DISTRIBUTOR`
- **Request Body:**
  ```json
  {
    "batchId": "MED-20261015-A8F2K",
    "toOrganizationId": "ORG-DIST-01",
    "quantity": 2500,
    "expectedDeliveryDate": "2026-10-18T18:00:00.000Z",
    "location": "Apex Dispatch Gate 2",
    "temperatureCelsius": 4.5,
    "notes": "Packed in certified reefer shipping unit #12"
  }
  ```
- **Validation Rules:**
  - Sender must hold the batch in their live inventory.
  - `quantity` must be &le; sender's `remainingQuantity`.
  - Target organization must be an active, accredited partner.
- **Initial Status:** `DISPATCHED` (or `IN_TRANSIT`).
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "deliveryId": "DEL-99210",
      "status": "DISPATCHED",
      "batchId": "MED-20261015-A8F2K",
      "blockchainTxHash": "0x32a8901bce4710a90182bc8102931a89012bf991a03912a781039bcdae991201"
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

#### 4.2 `GET /api/deliveries`
Lists deliveries filtered by inbound/outbound status for the caller's organization.
- **Authorized Roles:** Authenticated participants
- **Query Parameters:** `status` (`PENDING | DISPATCHED | IN_TRANSIT | DELIVERED | CANCELLED`), `direction` (`inbound | outbound`)

#### 4.3 `POST /api/deliveries/:deliveryId/dispatch`
Updates logistics checkpoint or marks carrier departure into active transit.
- **Authorized Roles:** Dispatching entity or carrier
- **Request Body:** `{ "location": "Checkpoint West 4", "temperatureCelsius": 4.2 }`
- **Status Change:** Updates `status` to `IN_TRANSIT`.

#### 4.4 `POST /api/deliveries/:deliveryId/confirm-receipt`
Formal acknowledgment of goods arrival and physical custody acceptance.
- **Authorized Roles:** Strictly the **recipient organization** specified in `toOrganizationId` (`DISTRIBUTOR`, `PHARMACY`, or `HOSPITAL`)
- **Request Body:**
  ```json
  {
    "receivedQuantity": 2500,
    "remarks": "Container seals intact. Cold chain logger verified continuous 4.2°C.",
    "location": "Global Health Logistics Vault 3"
  }
  ```
- **Validation Rules:**
  - Caller's authenticated `organizationId` must match `delivery.toOrganizationId`.
  - Delivery must currently be `DISPATCHED` or `IN_TRANSIT`.
  - Delivery must not be already `DELIVERED` or `CANCELLED`.
- **System Actions:**
  1. Sets `delivery.status` to `DELIVERED`.
  2. Generates a `ReceiptConfirmation` certificate.
  3. Increments receiving organization's available inventory.
  4. Calls smart contract `receiveBatch(...)` or records custody receipt on-chain.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Shipment receipt explicitly confirmed and custody updated",
    "data": {
      "deliveryId": "DEL-99210",
      "status": "DELIVERED",
      "confirmationId": "REC-88102",
      "receivedQuantity": 2500,
      "blockchainTxHash": "0x55bc10293810ae8829103cba00129bcfe1092301823901a89012738910a88102"
    },
    "timestamp": "2026-10-15T09:00:00.000Z"
  }
  ```

---

### Group 5: Public Verification (Zero-Login / Zero-Leakage)

#### 5.1 `GET /api/public/verify/:batchId` (and alias `GET /api/verify/:batchId`)
Public inspection endpoint queried by consumers, mobile QR scanners, and hospitals without requiring credentials.
- **Authorized Roles:** **Public / Anyone (No Authentication Required)**
- **Path Parameter:** `batchId` (Validated against `/^MED-\d{8}-[A-Z0-9]{4,8}$/`)
- **Data Protection Enforcement:**
  - Returns only safe, approved medical provenance fields.
  - Strips internal quantities, commercial order numbers, patient identities, employee emails, passwords, and warehouse remarks.
- **Success Response (`200 OK`):**
  ```json
  {
    "verified": true,
    "batchId": "MED-20261015-A8F2K",
    "drugName": "Amoxicillin Clavulanate",
    "genericName": "Amoxicillin / Clavulanic Acid",
    "dosage": "625mg USP Tablets",
    "status": "RECEIVED_BY_PHARMACY",
    "manufacturer": {
      "name": "Apex Biotech Pharmaceuticals Ltd.",
      "verified": true,
      "licenseNumber": "MFG-FDA-8832-GMP"
    },
    "manufacturingDate": "2026-10-01T08:00:00.000Z",
    "expiryDate": "2028-10-01T08:00:00.000Z",
    "isExpired": false,
    "isRecalled": false,
    "recallReason": null,
    "currentHandler": {
      "role": "PHARMACY",
      "name": "City Care Hospital & Central Pharmacy"
    },
    "provenanceHistory": [
      {
        "timestamp": "2026-10-01T08:30:00.000Z",
        "action": "MANUFACTURED",
        "status": "MANUFACTURED",
        "location": "Formulation Suite 4",
        "actorRole": "MANUFACTURER",
        "actorName": "Apex Biotech Pharmaceuticals Ltd.",
        "temperatureCelsius": 20.5,
        "blockchainTxHash": "0x94f1c7d23a10e82937e20b33c1d982ab91c890123f9901adbc389021a88190c1"
      },
      {
        "timestamp": "2026-10-06T14:40:00.000Z",
        "action": "RECEIVED_BY_DISTRIBUTOR",
        "status": "RECEIVED_BY_DISTRIBUTOR",
        "location": "Logistics Hub West Vault 3",
        "actorRole": "DISTRIBUTOR",
        "actorName": "Global Health Logistics & Cold Chain Inc.",
        "temperatureCelsius": 4.2,
        "blockchainTxHash": "0x55bc10293810ae8829103cba00129bcfe1092301823901a89012738910a88102"
      }
    ],
    "blockchainVerification": {
      "onChain": true,
      "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "lastTxHash": "0x55bc10293810ae8829103cba00129bcfe1092301823901a89012738910a88102",
      "blockNumber": 12401,
      "integrityCheck": "PASSED_CRYPTOGRAPHIC_SEAL"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "verified": false, "error": "Invalid Batch ID format", "expectedFormat": "MED-YYYYMMDD-XXXXX" }`
  - `404 Not Found`: `{ "verified": false, "error": "Batch not found on MediTrace network. May be counterfeit or unindexed." }`
