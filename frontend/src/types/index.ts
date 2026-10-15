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

export interface Medicine {
  medicineId: string;
  id?: string;
  name: string;
  genericName: string;
  description: string;
  manufacturerOrganizationId: string;
  dosageForm: string;
  strength: string;
  packaging?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MedicineBatch {
  batchId: string;
  medicineId?: string;
  manufacturerOrganizationId?: string;
  drugName: string;
  genericName: string;
  dosage: string;
  strength?: string;
  packaging?: string;
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
  currentLocation?: string;
  location?: string;
  custodianAddress?: string;
  custodianName?: string;
  history?: CustodyEvent[];
  isRecalled: boolean;
  recallReason?: string;
  qrCodeUrl?: string;
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
  strength?: string;
  packaging?: string;
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
    onChainStatus?: string;
  };
  scanTelemetry?: {
    suspiciousScanAlert: boolean;
    recentScanCount: number;
    totalScanCount: number;
    message?: string;
  };
  warnings?: string[];
  incompleteRecord?: boolean;
  verifiedAt?: string;
}

export interface Organization {
  organizationId: string;
  name: string;
  type: OrganizationType;
  address: string;
  contactEmail: string;
  licenseNumber: string;
  walletAddress?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  userId?: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName?: string;
  licenseNumber?: string;
  walletAddress?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminActivity {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: 'ORGANIZATION' | 'USER' | 'SYSTEM';
  targetId: string;
  targetName: string;
  details?: string;
  timestamp: string;
}

export interface UserSession {
  token: string;
  user: {
    id: string;
    organizationId?: string;
    name: string;
    email: string;
    role: UserRole;
    organizationName: string;
    licenseNumber: string;
    walletAddress: string;
  };
}

export type Permission =
  | 'MANAGE_ORGANIZATIONS'
  | 'MANAGE_USERS'
  | 'VIEW_AUDIT_LOGS'
  | 'VIEW_ADMIN_METRICS'
  | 'CREATE_BATCH'
  | 'UPDATE_BATCH_STATUS'
  | 'DISPATCH_DELIVERY'
  | 'CONFIRM_DELIVERY_RECEIPT'
  | 'DISPENSE_MEDICINE'
  | 'RECALL_BATCH';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'MANAGE_ORGANIZATIONS',
    'MANAGE_USERS',
    'VIEW_AUDIT_LOGS',
    'VIEW_ADMIN_METRICS',
    'RECALL_BATCH',
  ],
  MANUFACTURER: [
    'CREATE_BATCH',
    'UPDATE_BATCH_STATUS',
    'DISPATCH_DELIVERY',
    'RECALL_BATCH',
  ],
  DISTRIBUTOR: [
    'UPDATE_BATCH_STATUS',
    'CONFIRM_DELIVERY_RECEIPT',
    'DISPATCH_DELIVERY',
  ],
  PHARMACY: [
    'UPDATE_BATCH_STATUS',
    'CONFIRM_DELIVERY_RECEIPT',
    'DISPENSE_MEDICINE',
  ],
  HOSPITAL: [
    'UPDATE_BATCH_STATUS',
    'CONFIRM_DELIVERY_RECEIPT',
    'DISPENSE_MEDICINE',
  ],
  CONSUMER: [],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export interface Delivery {
  deliveryId: string;
  batchId: string;
  drugName: string;
  fromOrganizationId: string;
  fromOrganizationName: string;
  toOrganizationId: string;
  toOrganizationName: string;
  quantity: number;
  dispatchDate: string;
  expectedDeliveryDate?: string;
  status: DeliveryStatus;
  location: string;
  temperatureCelsius?: number;
  notes?: string;
  blockchainTxHash?: string;
  createdAt: string;
  updatedAt: string;
  confirmation?: ReceiptConfirmation | null;
}

export interface ReceiptConfirmation {
  confirmationId: string;
  deliveryId: string;
  batchId: string;
  receivedByUserId: string;
  receivedByUserName: string;
  receivedByOrganizationId: string;
  receivedQuantity: number;
  receivedDate: string;
  remarks?: string;
  location?: string;
  temperatureCelsius?: number;
  blockchainTxHash?: string;
  createdAt: string;
}

