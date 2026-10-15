import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  changePassword,
  listParticipants,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkLoginRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Public auth endpoints
router.post('/login', checkLoginRateLimit, login);

// Authenticated session endpoints
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);
router.get('/participants', authenticate, listParticipants);

export default router;
