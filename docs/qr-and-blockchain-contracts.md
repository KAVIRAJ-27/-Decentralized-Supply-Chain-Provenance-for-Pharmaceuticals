# MediTrace — QR Code Standard & Blockchain Event Conventions

**Version:** 2.0.0 (Phase 2 Baseline)  
**Author:** Kavi (System Architecture and Shared Foundation)

---

## 1. Standardized QR Code Convention

### A. Cryptographically Secure Universal Batch Identifier
Every pharmaceutical batch produced is stamped with a single, immutable, and cryptographically unpredictable identifier:
- **Identifier Pattern:** `MED-YYYYMMDD-XXXXX`
- **Regex Validation:** `/^MED-\d{8}-[A-Z0-9]{4,8}$/`
- **Entropy & Generation:** Node.js built-in `crypto.randomBytes(3)` CSPRNG generating high-entropy suffixes (over 1,000,000 combinations per calendar day) combined with database collision resistance loops. Sequential numbers, timestamps alone, or ordinary Math.random() are strictly prohibited.
- **Examples:** `MED-20261016-A8F2K`, `MED-20261016-9B3C1`

### B. Single QR Life Throughout the Entire Supply Chain
1. **Zero Regenerations:** The same batch QR code printed on the physical packaging at the manufacturing facility travels with the medication through distributors, warehouses, transport fleets, hospital pharmacies, and ultimately to the patient.
2. **Post-Save Generation:** QR codes are generated strictly after the batch record and its cryptographic digital signature are persistently saved in the database.
3. **No Per-Delivery Codes:** Intermediary distributors or couriers must **not** generate new batch QR codes for their leg of the journey. Custody handoffs are recorded digitally against the original immutable `batchId`.
4. **No Confidential Data in QR Payload:**
   - The QR code contains strictly the public canonical verification URL.
   - It **never** contains wholesale pricing, trade secrets, patient IDs, driver names, internal stock levels, private keys, or internal access tokens.
5. **Canonical URL Format:**
   ```text
   https://YOUR-VERIFICATION-DOMAIN/verify/{batchId}
   ```
   *Development / Local Example:*
   ```text
   http://localhost:5173/?verify=MED-20261016-A8F2K
   ```

### C. Cryptographic Tamper-Evident Digital Signatures
To guarantee tamper evidence against off-chain tampering or man-in-the-middle manipulation:
1. **Algorithm:** HMAC-SHA256 over a canonical representation of the batch metadata (`batchId:drugName:manufacturerOrgId:mfgDate:expDate:quantity`).
2. **Key Rotation (`keyId`):** Digital signatures embed a key identifier (e.g. `key-2026-v1`) to facilitate zero-downtime key rotation.
3. **Timing-Safe Comparison:** Signatures are validated using Node.js `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
4. **Altered Metadata Detection:** Any modification to formulation, dosage, or expiry date invalidates the signature and triggers a `SIGNATURE_TAMPER_DETECTED` alert.

### D. ISO/IEC 18004 Scannable QR Matrix Specification
1. **Error Correction Level:** Level 'H' (High), recovering up to 30% data loss due to label scratching, moisture, or warehouse tears.
2. **Quiet Zone:** Minimum 4-module quiet zone margin on all borders.
3. **Contrast:** Pure dark modules (`#000000`) on solid light background (`#FFFFFF`).
4. **Export Formats:**
   - High-precision vector SVG for scalable web rendering and industrial laser printers.
   - 300-DPI label-grade Base64 PNG Data URL for high-resolution packaging label printing.

### E. Telemetry & Counterfeit Clone Risk Assessment
Scan events are monitored server-side with strict privacy safeguards (no consumer personal information recorded):
1. **Velocity Alerting:** >10 scans in 5 minutes triggers `SUSPICIOUS_SCAN_VELOCITY`.
2. **Volume Alerting:** >35 scans in 1 hour triggers `ELEVATED_HOURLY_VOLUME`.
3. **Multi-Location Anomaly:** >=4 distinct IP addresses scanning within 5 minutes triggers `MULTI_LOCATION_SIMULTANEOUS_BURST`.
4. **Rate Limiting:** Public verification requests are rate-limited to 60 requests per minute per IP to protect against enumeration attacks.
5. **Risk Classification:** Telemetry alerts are treated as risk advisories (recommending physical tamper seal inspection), not definitive proof of counterfeit medicine.

---

## 2. Blockchain Smart Contract Event Conventions

All critical provenance milestones must be broadcast on the Ethereum EVM ledger as indexed events. This guarantees tamper-evident provenance without requiring high gas expenditure for storing full clinical monographs on-chain.

### A. Core Smart Contract Events (`IMediTraceProvenance.sol`)

#### 1. Batch Registration Event (`BatchCreated`)
Emitted when a licensed manufacturer registers a new medicine lot.
```solidity
event BatchCreated(
    string indexed batchId,          // Indexed Batch Identifier (MED-YYYYMMDD-XXXXX)
    string drugName,                 // Formulation Name
    address indexed manufacturer,    // Registered EVM Address of Manufacturer
    uint256 quantity,                // Total Physical Units Minted
    uint256 expiryDate               // Unix Timestamp of Shelf-Life Expiry
);
```

#### 2. Stock Custody Transfer Event (`BatchTransferred` / `BatchStatusUpdated`)
Emitted when custody transitions to a carrier, distributor, or pharmacy.
```solidity
event BatchStatusUpdated(
    string indexed batchId,          // Indexed Batch Identifier
    BatchStatus status,              // New Status Enum (0=MANUFACTURED, 1=IN_TRANSIT, etc.)
    address indexed actor,           // Transacting Wallet Address
    Role actorRole,                  // Role Enum (MANUFACTURER, DISTRIBUTOR, PHARMACY, HOSPITAL)
    string location                  // Checkpoint Location String (e.g. "Hub West")
);
```

#### 3. Receipt Confirmation Event (`BatchReceived`)
Emitted when the intended recipient explicitly accepts delivery.
```solidity
event BatchReceived(
    string indexed batchId,          // Indexed Batch Identifier
    address indexed receivingOrg,    // EVM Address of Receiving Distributor/Hospital
    uint256 receivedQuantity,        // Confirmed Unit Count
    uint256 timestamp                // Block Timestamp
);
```

#### 4. Emergency Recall Event (`BatchRecalled`)
Emitted when an authorized regulatory admin or the manufacturer issues a defect recall notice.
```solidity
event BatchRecalled(
    string indexed batchId,          // Target Recalled Batch Identifier
    address indexed recalledBy,      // Regulatory Authority or Manufacturer Wallet
    string reason                    // Official Public Recall Reason
);
```

---

## 3. Linking Blockchain Transactions with MongoDB

To maintain a frictionless query experience while preserving cryptographic proof, MongoDB collections store cross-reference fields:

| MongoDB Entity | Cross-Reference Field | Target Blockchain Artifact |
|---|---|---|
| `medicine_batches` | `blockchainTransactionHash` | Minting transaction hash from `createBatch` |
| `deliveries` | `blockchainTxHash` | Transit handoff transaction hash |
| `receipt_confirmations` | `confirmationTxHash` | Receipt confirmation transaction hash |
| `batch_history` | `transactionHash` | Hash of the corresponding on-chain state transition |
| `blockchain_records` | `transactionHash` + `blockNumber` | Full EVM block header and receipt index |

When the public verification endpoint (`/api/public/verify/:batchId`) is invoked, the backend queries MongoDB for fast response times, while simultaneously asserting that the `blockchainTransactionHash` corresponds to an authentic, un-recalled record in `MediTraceProvenance.sol`.
