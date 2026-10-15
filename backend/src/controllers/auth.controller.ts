import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db, verifyPassword, hashPassword } from '../services/db.service';
import { config } from '../config';
import { AuthenticatedRequest, revokeToken } from '../middleware/auth.middleware';
import { recordFailedLogin, clearLoginAttempts } from '../middleware/rateLimiter';

/**
 * Enterprise Authentication Login Handler
 * Validates credentials using PBKDF2 hash, enforces rate-limiting on failures,
 * checks real-time user & organization active status, and returns a signed JWT.
 */
export function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Valid email and password are required' });
  }

  const trimmedEmail = email.trim();
  const user = db.findUserByEmail(trimmedEmail);

  // Generic credential check to prevent account enumeration
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'Invalid email or credentials' });
  }

  // Real-time user account status check
  if (!user.isActive) {
    return res.status(403).json({ error: 'Your account has been deactivated by the administrator.' });
  }

  // Real-time organization status check
  if (user.organizationId) {
    const org = db.findOrganizationById(user.organizationId);
    if (org && org.status !== 'ACTIVE') {
      return res.status(403).json({
        error: `Your organization account (${org.name}) is currently ${org.status.toLowerCase()}. Access denied.`,
      });
    }
  }

  // Authentication succeeded: clear failed rate-limit attempts
  clearLoginAttempts(req);

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    config.jwtSecret,
    { expiresIn: (config.jwtExpiresIn || '24h') as any }
  );

  return res.json({
    message: 'Authentication successful',
    token,
    user: {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationName: user.organizationName,
      licenseNumber: user.licenseNumber,
      walletAddress: user.walletAddress,
    },
  });
}

/**
 * Logout Handler
 * Terminates the active session and blacklists the token against future replay.
 */
export function logout(req: AuthenticatedRequest, res: Response) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    revokeToken(token);
  }
  return res.json({ message: 'Session successfully terminated. Token revoked.' });
}

/**
 * Get Current Authenticated Profile
 */
export function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
}

/**
 * Self-Service Password Change
 */
export function changePassword(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters in length' });
  }

  const user = db.findUserById(req.user.id);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password does not match' });
  }

  db.updateUserPassword(user.id, newPassword);

  return res.json({ message: 'Password successfully updated' });
}

/**
 * List Public Participants for Registry Views
 */
export function listParticipants(req: AuthenticatedRequest, res: Response) {
  const users = db.listUsers().map((u) => ({
    id: u.id,
    organizationId: u.organizationId,
    name: u.name,
    email: u.email,
    role: u.role,
    organizationName: u.organizationName,
    licenseNumber: u.licenseNumber,
    walletAddress: u.walletAddress,
    createdAt: u.createdAt,
  }));
  return res.json({ participants: users });
}
