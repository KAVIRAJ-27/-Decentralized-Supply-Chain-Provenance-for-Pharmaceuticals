/**
 * MediTrace — Centralized Role-Based Access Control (RBAC) & Permissions
 * 
 * Defines the central permission registry and mapping across all system roles.
 */

import { UserRole } from './index';

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

/**
 * Centralized Role-to-Permission Mapping
 */
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
  CONSUMER: [], // Public zero-login inspection mode has zero authenticated permissions
};

/**
 * Helper to evaluate if a given role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Returns all permitted actions for a given role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
