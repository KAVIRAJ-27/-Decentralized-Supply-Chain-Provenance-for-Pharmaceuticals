/**
 * Centralized Role-Based Access Control (RBAC) System
 * Defines permissions, role mappings, and role/permission verification logic.
 */

export type UserRole = 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL' | 'CONSUMER';

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

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
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
  CONSUMER: [], // Zero authenticated permissions
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
