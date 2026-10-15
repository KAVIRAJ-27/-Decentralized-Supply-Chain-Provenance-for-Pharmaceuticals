import { Response } from 'express';
import { db, OrganizationRecord } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export function listOrganizations(req: AuthenticatedRequest, res: Response) {
  const { type, status, search } = req.query as {
    type?: string;
    status?: string;
    search?: string;
  };

  const organizations = db.listOrganizations(type, status, search);
  return res.json({
    success: true,
    data: organizations,
    count: organizations.length,
    timestamp: new Date().toISOString(),
  });
}

export function getOrganizationById(req: AuthenticatedRequest, res: Response) {
  const { organizationId } = req.params;
  const organization = db.findOrganizationById(organizationId);

  if (!organization) {
    return res.status(404).json({
      success: false,
      error: `Organization with ID '${organizationId}' was not found.`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  }

  // Also include count of linked users and active batches
  const users = db.listUsers(organizationId);
  const batches = db.listBatches(undefined, organization.walletAddress);

  return res.json({
    success: true,
    data: {
      ...organization,
      userCount: users.length,
      batchCount: batches.length,
    },
    timestamp: new Date().toISOString(),
  });
}

export function createOrganization(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { name, type, address, contactEmail, licenseNumber, walletAddress, status } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Organization name is required', code: 'VALIDATION_ERROR' });
  }

  const validTypes = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'];
  if (!type || !validTypes.includes(type.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: `Invalid organization type '${type}'. Allowed: ${validTypes.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'Physical address is required', code: 'VALIDATION_ERROR' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || !emailRegex.test(contactEmail.trim())) {
    return res.status(400).json({ success: false, error: 'Valid contact email is required', code: 'VALIDATION_ERROR' });
  }

  if (!licenseNumber || typeof licenseNumber !== 'string' || licenseNumber.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Regulatory license number is required', code: 'VALIDATION_ERROR' });
  }

  // Check duplicate license
  const existingLicense = db.findOrganizationByLicense(licenseNumber.trim());
  if (existingLicense) {
    return res.status(409).json({
      success: false,
      error: `An organization with license number '${licenseNumber.trim()}' already exists (${existingLicense.name}).`,
      code: 'DUPLICATE_LICENSE',
    });
  }

  // Auto-generate organization ID
  const typePrefixMap: Record<string, string> = {
    MANUFACTURER: 'MFG',
    DISTRIBUTOR: 'DIST',
    PHARMACY: 'PHARM',
    HOSPITAL: 'HOSP',
  };
  const prefix = typePrefixMap[type.toUpperCase()] || 'ORG';
  const randSuffix = Math.floor(100 + Math.random() * 900);
  const organizationId = `ORG-${prefix}-${randSuffix}`;

  const newOrg: OrganizationRecord = {
    organizationId,
    name: name.trim(),
    type: type.toUpperCase() as any,
    address: address.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    licenseNumber: licenseNumber.trim().toUpperCase(),
    walletAddress: walletAddress?.trim() || `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}`,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const created = db.createOrganization(newOrg);

    // Record administrative audit trail
    db.recordAdminActivity({
      id: `act-${Date.now()}`,
      actorUserId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: 'ORGANIZATION_CREATED',
      targetType: 'ORGANIZATION',
      targetId: created.organizationId,
      targetName: created.name,
      details: `Registered as ${created.type} with license ${created.licenseNumber}`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: `Organization '${created.name}' successfully registered`,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to create organization',
      code: 'CREATE_FAILED',
    });
  }
}

export function updateOrganization(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { organizationId } = req.params;
  const { name, address, contactEmail, walletAddress, licenseNumber } = req.body;

  const existing = db.findOrganizationById(organizationId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `Organization '${organizationId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  const updates: Partial<OrganizationRecord> = {};
  if (name && typeof name === 'string') updates.name = name.trim();
  if (address && typeof address === 'string') updates.address = address.trim();
  if (contactEmail && typeof contactEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      return res.status(400).json({ success: false, error: 'Valid contact email is required', code: 'VALIDATION_ERROR' });
    }
    updates.contactEmail = contactEmail.trim().toLowerCase();
  }
  if (walletAddress && typeof walletAddress === 'string') updates.walletAddress = walletAddress.trim();
  if (licenseNumber && typeof licenseNumber === 'string') updates.licenseNumber = licenseNumber.trim().toUpperCase();

  try {
    const updated = db.updateOrganization(organizationId, updates);

    // Record audit trail
    db.recordAdminActivity({
      id: `act-${Date.now()}`,
      actorUserId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: 'ORGANIZATION_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: updated.organizationId,
      targetName: updated.name,
      details: `Updated details: ${Object.keys(updates).join(', ')}`,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `Organization '${updated.name}' updated successfully`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to update organization',
      code: 'UPDATE_FAILED',
    });
  }
}

export function setOrganizationStatus(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { organizationId } = req.params;
  const { status, reason } = req.body;

  const allowedStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  if (!status || !allowedStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: `Invalid status '${status}'. Allowed: ${allowedStatuses.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }

  const existing = db.findOrganizationById(organizationId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `Organization '${organizationId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  const targetStatus = status.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  const updated = db.setOrganizationStatus(organizationId, targetStatus);

  // Record audit trail
  db.recordAdminActivity({
    id: `act-${Date.now()}`,
    actorUserId: adminUser.id,
    actorName: adminUser.name,
    actorRole: adminUser.role,
    action: targetStatus === 'ACTIVE' ? 'ORGANIZATION_ACTIVATED' : 'ORGANIZATION_DEACTIVATED',
    targetType: 'ORGANIZATION',
    targetId: updated.organizationId,
    targetName: updated.name,
    details: `Status set to ${targetStatus}.${reason ? ` Reason: ${reason}` : ''}`,
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    message: `Organization '${updated.name}' status set to ${targetStatus}`,
    data: updated,
    timestamp: new Date().toISOString(),
  });
}
