export type UserRole = 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL' | 'CONSUMER';
export type OrganizationType = 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL';
export type DeliveryStatus = 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export type BatchStatus =
  | 'MANUFACTURED'
  | 'IN_TRANSIT_TO_DISTRIBUTOR'
  | 'RECEIVED_BY_DISTRIBUTOR'
  | 'IN_TRANSIT_TO_PHARMACY'
  | 'RECEIVED_BY_PHARMACY'
  | 'DISPENSED'
  | 'RECALLED';

export interface MedicineBatch {
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  remainingQuantity: number;
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturingDate: string;
  expiryDate: string;
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

export interface PublicVerificationResponse {
  verified: boolean;
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
  status: BatchStatus;
  manufacturer: {
    name: string;
    address: string;
    verified: boolean;
  };
  manufacturingDate: string;
  expiryDate: string;
  isExpired: boolean;
  isRecalled: boolean;
  recallReason?: string;
  currentHandler: {
    role: UserRole;
    name: string;
    address: string;
  };
  provenanceHistory: Array<{
    id: string;
    timestamp: string;
    action: string;
    status: BatchStatus;
    actorRole: UserRole;
    actorName: string;
    location: string;
    temperatureCelsius?: number;
    notes?: string;
    blockchainTxHash?: string;
  }>;
  blockchainVerification: {
    onChain: boolean;
    contractAddress: string;
    txHash?: string;
    blockNumber?: number;
    integrityCheck: string;
  };
}

export interface UserSession {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    organizationName: string;
    licenseNumber: string;
    walletAddress: string;
  };
}
