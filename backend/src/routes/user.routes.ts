import { Router } from 'express';
import {
  listUsers,
  getUserById,
  createUser,
  setUserActiveStatus,
  updateUserRole,
  updateUser,
} from '../controllers/user.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Directory: Available to authenticated users
router.get('/', authenticate, listUsers);
router.get('/:userId', authenticate, getUserById);

// Profile update: Self or Admin
router.patch('/:userId', authenticate, updateUser);

// Administrative operations: Strictly restricted to ADMIN
router.post('/', authenticate, requireRole('ADMIN'), createUser);
router.patch('/:userId/status', authenticate, requireRole('ADMIN'), setUserActiveStatus);
router.patch('/:userId/role', authenticate, requireRole('ADMIN'), updateUserRole);

export default router;
