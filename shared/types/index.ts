/**
 * MediTrace — Core Shared Domain Models, Constants & API Contracts
 * 
 * Shared across:
 * - Blockchain Smart Contracts (Solidity)
 * - Backend API (Node / Express / TypeScript)
 * - Management Website (React / Vite)
 * - Mobile QR Scanner (Mobile Web / React)
 */

// ============================================================================
// 1. Participant Roles
// ============================================================================

export type UserRole = 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'CONSUMER';

export enum RoleEnum {
  ADMIN = 'ADMIN',
  MANUFACTURER = 'MANUFACTURER',
  DISTRIBUTOR = 'DISTRIBUTOR',
  PHARMACY = 'PHARMACY',
  CONSUMER = 'CONSUMER',
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string;
  licenseNumber?: string;
  walletAddress?: string;
  createdAt: string;
}

// ============================================================================
// 2. Batch Lifecycle & Delivery Status
// ============================================================================

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
// 3. Shared Batch Identifier Specification
// ============================================================================

/**
 * Shared Batch ID standard format: MED-YYYYMMDD-XXXXX
 * Example: MED-20261015-8A7B1
 */
export const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

export function isValidBatchId(batchId: string): boolean {
  return BATCH_ID_REGEX.test(batchId);
}

export function generateBatchId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MED-${year}${month}${day}-${randomSuffix}`;
}

// ============================================================================
// 4. Medicine Batch Data Models
// ============================================================================

export interface MedicineBatch {
  batchId: string; // Unified Batch Identifier
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
  blockchainTxHash?: string;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustodyEvent {
  id: string;
  batchId: string;
  timestamp: string; // ISO 8601
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
// 5. Public Verification Contract (No Authentication Required)
// ============================================================================

export interface PublicVerificationResponse {
  verified: boolean;
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
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
  status: BatchStatus;
  currentHandler: {
    role: UserRole;
    name: string;
  };
  provenanceHistory: Array<{
    timestamp: string;
    action: string;
    location: string;
    actorRole: UserRole;
    txHash?: string;
  }>;
  blockchainVerification: {
    onChain: boolean;
    contractAddress: string;
    lastTxHash?: string;
  };
}

// ============================================================================
// 6. QR Code Payload Specification
// ============================================================================

export interface QrCodePayload {
  v: number;              // Schema version (e.g., 1)
  batchId: string;        // Shared Batch ID
  drug: string;           // Drug Name
  mfgDate: string;        // YYYY-MM-DD
  expDate: string;        // YYYY-MM-DD
  verifyUrl: string;      // Public URL to verify without login
}
