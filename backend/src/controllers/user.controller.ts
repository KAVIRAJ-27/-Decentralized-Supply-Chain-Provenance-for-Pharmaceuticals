import { Response } from 'express';
import { db, UserRecord, hashPassword } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationName: user.organizationName,
    licenseNumber: user.licenseNumber,
    walletAddress: user.walletAddress,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function listUsers(req: AuthenticatedRequest, res: Response) {
  const { organizationId, role, isActive, search } = req.query as {
    organizationId?: string;
    role?: string;
    isActive?: string;
    search?: string;
  };

  const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
  const users = db.listUsers(organizationId, role, activeBool, search);

  return res.json({
    success: true,
    data: users.map(sanitizeUser),
    count: users.length,
    timestamp: new Date().toISOString(),
  });
}

export function getUserById(req: AuthenticatedRequest, res: Response) {
  const { userId } = req.params;
  const user = db.findUserById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: `User with ID '${userId}' was not found.`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    success: true,
    data: sanitizeUser(user),
    timestamp: new Date().toISOString(),
  });
}

export function createUser(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { name, email, password, role, organizationId, walletAddress } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Full name is required', code: 'VALIDATION_ERROR' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Valid work email is required', code: 'VALIDATION_ERROR' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters long',
      code: 'VALIDATION_ERROR',
    });
  }

  const validRoles = ['ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'];
  if (!role || !validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: `Invalid role '${role}'. Supported roles: ${validRoles.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Check email uniqueness
  const existingUser = db.findUserByEmail(email.trim());
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: `A user with email '${email.trim()}' is already registered.`,
      code: 'DUPLICATE_EMAIL',
    });
  }

  // Validate linked organization
  let orgName = 'Independent Regulatory Entity';
  let orgLicense = 'N/A';
  if (organizationId) {
    const org = db.findOrganizationById(organizationId);
    if (!org) {
      return res.status(400).json({
        success: false,
        error: `Organization ID '${organizationId}' does not exist.`,
        code: 'INVALID_ORGANIZATION',
      });
    }
    orgName = org.name;
    orgLicense = org.licenseNumber;
  }

  const targetRole = role.toUpperCase() as any;
  const newUserId = `usr-${Date.now().toString(36)}`;
  const passwordHash = hashPassword(password);

  const newUser: UserRecord = {
    id: newUserId,
    organizationId: organizationId || 'ORG-SYSTEM',
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: targetRole,
    organizationName: orgName,
    licenseNumber: orgLicense,
    walletAddress: walletAddress?.trim() || `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}`,
    passwordHash,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const created = db.createUser(newUser);

    // Record administrative activity audit log
    db.recordAdminActivity({
      id: `act-${Date.now()}`,
      actorUserId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: 'USER_CREATED',
      targetType: 'USER',
      targetId: created.id,
      targetName: created.name,
      details: `Created user with role ${created.role} for organization '${created.organizationName}'`,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: `User '${created.name}' successfully registered`,
      data: sanitizeUser(created),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to create user',
      code: 'CREATE_FAILED',
    });
  }
}

export function setUserActiveStatus(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { userId } = req.params;
  const { isActive, reason } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'isActive must be a boolean (true or false)',
      code: 'VALIDATION_ERROR',
    });
  }

  const existing = db.findUserById(userId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `User '${userId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  // Prevent admin from deactivating themselves
  if (existing.id === adminUser.id && !isActive) {
    return res.status(400).json({
      success: false,
      error: 'Administrators cannot deactivate their own active account',
      code: 'SELF_DEACTIVATION_PROHIBITED',
    });
  }

  const updated = db.setUserActive(userId, isActive);

  // Record audit trail
  db.recordAdminActivity({
    id: `act-${Date.now()}`,
    actorUserId: adminUser.id,
    actorName: adminUser.name,
    actorRole: adminUser.role,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    targetType: 'USER',
    targetId: updated.id,
    targetName: updated.name,
    details: `Account access set to ${isActive ? 'Active' : 'Deactivated'}.${reason ? ` Reason: ${reason}` : ''}`,
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    message: `User '${updated.name}' account is now ${isActive ? 'active' : 'deactivated'}`,
    data: sanitizeUser(updated),
    timestamp: new Date().toISOString(),
  });
}

export function updateUserRole(req: AuthenticatedRequest, res: Response) {
  const adminUser = req.user!;
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles = ['ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'];
  if (!role || !validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: `Invalid role '${role}'. Supported roles: ${validRoles.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }

  const existing = db.findUserById(userId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `User '${userId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  const targetRole = role.toUpperCase() as any;
  const updated = db.updateUser(userId, { role: targetRole });

  // Record audit trail
  db.recordAdminActivity({
    id: `act-${Date.now()}`,
    actorUserId: adminUser.id,
    actorName: adminUser.name,
    actorRole: adminUser.role,
    action: 'ROLE_CHANGED',
    targetType: 'USER',
    targetId: updated.id,
    targetName: updated.name,
    details: `Role updated from ${existing.role} to ${targetRole}`,
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    message: `User '${updated.name}' role updated to ${targetRole}`,
    data: sanitizeUser(updated),
    timestamp: new Date().toISOString(),
  });
}

export function updateUser(req: AuthenticatedRequest, res: Response) {
  const currentUser = req.user!;
  const { userId } = req.params;
  const { name, walletAddress, role, organizationId } = req.body;

  const existing = db.findUserById(userId);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: `User '${userId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  // Security guard: Non-admins can only edit their own profile, and cannot elevate role or change organization
  if (currentUser.role !== 'ADMIN') {
    if (currentUser.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You cannot modify other users profiles',
        code: 'FORBIDDEN',
      });
    }

    if (role && role !== existing.role) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Ordinary users cannot alter their own role or grant themselves Admin access',
        code: 'PRIVILEGE_ESCALATION_DENIED',
      });
    }

    if (organizationId && organizationId !== existing.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Ordinary users cannot change their organization association',
        code: 'ORG_MUTATION_DENIED',
      });
    }
  }

  const updates: Partial<UserRecord> = {};
  if (name && typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (walletAddress && typeof walletAddress === 'string') updates.walletAddress = walletAddress.trim();
  if (currentUser.role === 'ADMIN' && role) updates.role = role.toUpperCase() as any;
  if (currentUser.role === 'ADMIN' && organizationId) updates.organizationId = organizationId;

  const updated = db.updateUser(userId, updates);

  return res.json({
    success: true,
    message: 'User profile updated successfully',
    data: sanitizeUser(updated),
    timestamp: new Date().toISOString(),
  });
}
