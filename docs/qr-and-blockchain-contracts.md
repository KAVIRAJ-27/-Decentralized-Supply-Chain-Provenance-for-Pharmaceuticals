# MediTrace — QR Code Standard & Blockchain Event Conventions

**Version:** 2.0.0 (Phase 2 Baseline)  
**Author:** Kavi (System Architecture and Shared Foundation)

---

## 1. Standardized QR Code Convention

### A. Universal Batch Identifier
Every pharmaceutical batch produced is stamped with a single, immutable, and stable identifier:
- **Identifier Pattern:** `MED-YYYYMMDD-XXXXX`
- **Regex Validation:** `/^MED-\d{8}-[A-Z0-9]{4,8}$/`
- **Examples:** `MED-20261015-A8F2K`, `MED-20261015-00101`

### B. Single QR Life Throughout the Entire Supply Chain
1. **Zero Regenerations:** The same batch QR code printed on the physical packaging at the manufacturing facility travels with the medication through distributors, warehouses, transport fleets, hospital pharmacies, and ultimately to the patient.
2. **No Per-Delivery Codes:** Intermediary distributors or couriers must **not** generate new batch QR codes for their leg of the journey. Custody handoffs are recorded digitally against the original immutable `batchId`.
3. **No Confidential Data in QR Payload:**
   - The QR code contains only the public canonical verification URL and basic serialization headers.
   - It **never** contains wholesale pricing, trade secrets, patient IDs, driver names, or internal access tokens.
4. **Canonical URL Format:**
   ```text
   https://meditrace.network/verify/{batchId}
   ```
   *Local Development Example:*
   ```text
   http://localhost:5173/?verify=MED-20261015-A8F2K
   ```

### C. Standardized QR Code JSON Payload Schema (`QrCodePayload`)
```typescript
export interface QrCodePayload {
  v: number;          // Schema version (e.g. 2)
  batchId: string;    // Standardized Batch Identifier (e.g. "MED-20261015-A8F2K")
  drug: string;       // Commercial Drug Name (e.g. "Amoxicillin Clavulanate")
  mfgDate: string;    // YYYY-MM-DD
  expDate: string;    // YYYY-MM-DD
  verifyUrl: string;  // Public verification endpoint URL
}
```

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
