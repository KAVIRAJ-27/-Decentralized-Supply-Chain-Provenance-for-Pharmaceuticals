import { Router } from 'express';
import {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  setOrganizationStatus,
} from '../controllers/organization.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Read operations: Available to all authenticated supply chain participants
router.get('/', authenticate, listOrganizations);
router.get('/:organizationId', authenticate, getOrganizationById);

// Administrative operations: Strictly restricted to ADMIN
router.post('/', authenticate, requireRole('ADMIN'), createOrganization);
router.put('/:organizationId', authenticate, requireRole('ADMIN'), updateOrganization);
router.patch('/:organizationId/status', authenticate, requireRole('ADMIN'), setOrganizationStatus);

export default router;
