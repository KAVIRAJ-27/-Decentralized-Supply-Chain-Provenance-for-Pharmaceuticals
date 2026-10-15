import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../services/db.service';
import { Permission, hasPermission } from './rbac';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  name: string;
  organizationName: string;
  licenseNumber: string;
  walletAddress: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

// In-memory token revocation blacklist (stores invalidated tokens until TTL)
const tokenBlacklist = new Set<string>();

/**
 * Revoke an active JWT token (e.g., during explicit logout)
 */
export function revokeToken(token: string) {
  if (token) {
    tokenBlacklist.add(token.trim());
  }
}

/**
 * Check if a token has been revoked
 */
export function isTokenRevoked(token: string): boolean {
  return tokenBlacklist.has(token.trim());
}

/**
 * Clear revocation list (useful for test suites)
 */
export function clearTokenBlacklist() {
  tokenBlacklist.clear();
}

/**
 * Mandatory Authentication Middleware
 * Validates JWT signature, expiration, active token blacklist, and real-time user/organization status.
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token missing from authorization header' });
  }

  // 1. Check if token was explicitly revoked
  if (isTokenRevoked(token)) {
    return res.status(401).json({ error: 'Unauthorized: Session has been logged out or terminated' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const user = db.findUserById(decoded.id);

    // 2. Real-time user existence and active status check
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Forbidden: User account has been deactivated by the administrator' });
    }

    // 3. Real-time organization active status check
    if (user.organizationId) {
      const org = db.findOrganizationById(user.organizationId);
      if (org && org.status !== 'ACTIVE') {
        return res.status(403).json({
          error: `Forbidden: Organization '${org.name}' is currently ${org.status.toLowerCase()}. Access denied.`,
        });
      }
    }

    // 4. Attach verified authenticated credentials to request
    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationName: user.organizationName,
      licenseNumber: user.licenseNumber,
      walletAddress: user.walletAddress,
    };
    req.token = token;

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Session token has expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid or corrupted token signature' });
  }
}

/**
 * Role-Based Access Control Guard
 * Restricts access to one or more permitted system roles.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role ${req.user.role} is not permitted to perform this operation. Allowed roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Centralized Permission Guard
 * Validates that user's role grants the required fine-grained permission.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: `Forbidden: Role ${req.user.role} lacks required permission '${permission}'`,
      });
    }

    next();
  };
}

/**
 * Organization-Level Authorization Guard
 * Ensures a participant cannot access or alter resources belonging to another organization.
 * Admins are permitted cross-organization oversight.
 */
export function requireOrganizationMatch(paramName = 'organizationId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // Admin has global system-wide authority
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const targetOrgId = req.params[paramName] || req.body[paramName];
    if (targetOrgId && targetOrgId.toUpperCase() !== req.user.organizationId.toUpperCase()) {
      return res.status(403).json({
        error: `Forbidden: You are not authorized to access or modify records for organization ${targetOrgId}`,
      });
    }

    next();
  };
}
