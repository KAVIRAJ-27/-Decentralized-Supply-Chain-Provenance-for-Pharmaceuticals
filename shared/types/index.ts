/**
 * MediTrace — Core Shared Domain Models, Constants & API Contracts
 * 
 * Version: 2.0.0 (Phase 2 Shared Foundation)
 * Shared across:
 * - Blockchain Smart Contracts (Solidity)
 * - Backend API (Node / Express / TypeScript / MongoDB)
 * - Management Website (React / Vite)
 * - Mobile QR Scanner (Mobile Web / PWA Engine)
 */

// ============================================================================
// 1. Participant Roles & Organizations
// ============================================================================

/**
 * Authenticated system roles.
 * Note: Public verification is a zero-login access mode, not an authenticated role.
 */
export type UserRole = 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL' | 'CONSUMER';

export enum RoleEnum {
  ADMIN = 'ADMIN',
  MANUFACTURER = 'MANUFACTURER',
  DISTRIBUTOR = 'DISTRIBUTOR',
  PHARMACY = 'PHARMACY',
  HOSPITAL = 'HOSPITAL',
  CONSUMER = 'CONSUMER', // Zero-login public inspection mode
}

export type OrganizationType = 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL';

export interface Organization {
  organizationId: string;
  name: string;
  type: OrganizationType;
  address: string;
  contactEmail: string;
  licenseNumber: string;
  walletAddress?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  createdAt: string;
}

export interface User {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  // passwordHash is strictly server-side and excluded in API transfers
}

export interface UserProfile extends User {
  organizationName?: string;
  licenseNumber?: string;
  walletAddress?: string;
}

// ============================================================================
// 2. Delivery & Supply Chain Logistics Statuses
// ============================================================================

/**
 * Standardized Delivery Lifecycle Statuses
 * CRITICAL RULE: A delivery never becomes DELIVERED simply upon QR scanning.
 * The intended receiving organization must explicitly confirm receipt.
 */
export type DeliveryStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export enum DeliveryStatusEnum {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

/**
 * Batch Lifecycle Status (End-to-end custody provenance)
 */
export type BatchStatus =
  | 'MANUFACTURED'
  | 'IN_TRANSIT_TO_DISTRIBUTOR'
  | 'RECEIVED_BY_DISTRIBUTOR'
  | 'IN_TRANSIT_TO_PHARMACY'
  | 'RECEIVED_BY_PHARMACY'
  | 'DISPENSED'
  | 'RECALLED';

export enum BatchStatusEnum {
  MANUFACTURED = 0,
  IN_TRANSIT_TO_DISTRIBUTOR = 1,
  RECEIVED_BY_DISTRIBUTOR = 2,
  IN_TRANSIT_TO_PHARMACY = 3,
  RECEIVED_BY_PHARMACY = 4,
  DISPENSED = 5,
  RECALLED = 6,
}

// ============================================================================
// 3. Shared Batch Identifier Standard
// ============================================================================

/**
 * Standardized Batch Identifier format: MED-YYYYMMDD-XXXXX
 * Example: MED-20261015-A8F2K
 */
export const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

export function isValidBatchId(batchId: string): boolean {
  if (!batchId) return false;
  return BATCH_ID_REGEX.test(batchId.trim().toUpperCase());
}

export interface BatchDigitalSignature {
  signature: string;
  algorithm: string;
  keyId: string;
  signedAt: string;
}

export interface CryptographicProof {
  verified: boolean;
  algorithm: string;
  keyId: string;
  verifiedAt: string;
  error?: string;
}

export interface ScanTelemetryRisk {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suspiciousScanAlert: boolean;
  recentScanCount: number;
  recent1hScans?: number;
  totalScanCount: number;
  uniqueIpCount?: number;
  flags?: string[];
  message?: string;
}

export function generateBatchId(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  let randomHex = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 5)
      .toUpperCase();
  } else {
    randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
  }
  return `MED-${year}${month}${day}-${randomHex}`;
}

// ============================================================================
// 4. Master Domain Entities
// ============================================================================

export interface Medicine {
  medicineId: string;
  name: string;
  genericName: string;
  description: string;
  manufacturerOrganizationId: string;
  dosageForm: string; // e.g. "Tablet", "Injection", "Vial", "Capsule"
  strength: string;   // e.g. "625mg", "100mg/mL"
  createdAt: string;
}

export interface MedicineBatch {
  batchId: string; // Universal Batch ID (MED-YYYYMMDD-XXXXX)
  medicineId?: string;
  manufacturerOrganizationId?: string;
  batchNumber?: string;
  drugName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  remainingQuantity: number;
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturingDate: string; // ISO 8601
  expiryDate: string;        // ISO 8601
  currentStatus: BatchStatus;
  currentOwnerRole: UserRole;
  currentOwnerName: string;
  currentOwnerAddress: string;
  isRecalled: boolean;
  recallReason?: string;
  qrCodeUrl?: string;
  digitalSignature?: BatchDigitalSignature;
  blockchainTxHash?: string;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyChainTransaction {
  transactionId: string;
  batchId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  type: 'DISPATCH' | 'TRANSFER' | 'RECEIPT' | 'DISPENSE' | 'RECALL';
  quantity: number;
  status: 'INITIATED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
}

export interface Delivery {
  deliveryId: string;
  transactionId?: string;
  batchId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  quantity: number;
  dispatchDate: string;
  expectedDeliveryDate?: string;
  status: DeliveryStatus;
  location: string;
  temperatureCelsius?: number;
  notes?: string;
  createdAt: string;
}

export interface ReceiptConfirmation {
  confirmationId: string;
  deliveryId: string;
  receivedByUserId: string;
  receivedQuantity: number;
  receivedDate: string;
  remarks?: string;
  createdAt: string;
}

export interface BatchHistory {
  historyId: string;
  batchId: string;
  eventType: string;
  quantity: number;
  location: string;
  eventDate: string;
  recordedByUserId: string;
  transactionHash?: string;
  createdAt: string;
}

export interface BlockchainRecord {
  recordId: string;
  batchId: string;
  eventType: string;
  fromOrganizationId?: string;
  toOrganizationId?: string;
  quantity: number;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
}

// Backward-compatibility alias
export interface CustodyEvent {
  id: string;
  batchId: string;
  timestamp: string;
  action: string;
  status: BatchStatus;
  actorRole: UserRole;
  actorName: string;
  actorAddress: string;
  location: string;
  temperatureCelsius?: number;
  notes?: string;
  blockchainTxHash?: string;
}

// ============================================================================
// 5. Sanitized Public Verification Response (Zero-Login / Zero-Leakage)
// ============================================================================

/**
 * Public response contract: Strictly separates publicly permitted verification data
 * from internal database attributes (no emails, passwords, pricing, or internal warehouse notes).
 */
export interface PublicBatchVerificationResponse {
  verified: boolean;
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
  status: BatchStatus;
  manufacturer: {
    name: string;
    verified: boolean;
    licenseNumber?: string;
  };
  manufacturingDate: string;
  expiryDate: string;
  isExpired: boolean;
  isRecalled: boolean;
  recallReason?: string;
  currentHandler: {
    role: UserRole;
    name: string;
  };
  provenanceHistory: Array<{
    id?: string;
    timestamp: string;
    action: string;
    status: BatchStatus;
    location: string;
    actorRole: UserRole;
    actorName: string;
    temperatureCelsius?: number;
    blockchainTxHash?: string;
  }>;
  blockchainVerification: {
    onChain: boolean;
    contractAddress: string;
    lastTxHash?: string;
    txHash?: string;
    blockNumber?: number;
    integrityCheck: string;
    onChainStatus?: string;
  };
  cryptographicProof?: CryptographicProof;
  scanTelemetry?: ScanTelemetryRisk;
  warnings?: string[];
  incompleteRecord?: boolean;
  verifiedAt?: string;
}

// Alias for client consumption
export type PublicVerificationResponse = PublicBatchVerificationResponse;

// ============================================================================
// 6. QR Code Payload Specification
// ============================================================================

export interface QrCodePayload {
  v: number;              // Schema version (e.g., 2)
  batchId: string;        // Universal Batch ID (MED-YYYYMMDD-XXXXX)
  drug: string;           // Commercial name
  mfgDate: string;        // YYYY-MM-DD
  expDate: string;        // YYYY-MM-DD
  verifyUrl: string;      // Canonical public verify URL
}

// ============================================================================
// 7. Standard API Response Envelopes
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export * from './permissions';
