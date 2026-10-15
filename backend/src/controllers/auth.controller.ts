import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../services/db.service';
import { config } from '../config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.findUserByEmail(email);
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: 'Invalid email or credentials' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  return res.json({
    message: 'Authentication successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationName: user.organizationName,
      licenseNumber: user.licenseNumber,
      walletAddress: user.walletAddress,
    },
  });
}

export function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
}

export function listParticipants(req: AuthenticatedRequest, res: Response) {
  const users = db.listUsers().map((u) => ({
    id: u.id,
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
