import { Router } from 'express';
import {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatchStatus,
  dispenseBatch,
  recallBatch,
  getManufacturerDashboardStats,
  getBatchQr,
} from '../controllers/batch.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validateBatchIdParam, validateCreateBatchBody } from '../middleware/validator.middleware';

const router = Router();

// Batch listing & metrics
router.get('/', authenticate, getAllBatches);
router.get('/manufacturer/stats', authenticate, requireRole('MANUFACTURER', 'ADMIN'), getManufacturerDashboardStats);
router.get('/:batchId', authenticate, validateBatchIdParam, getBatchById);
router.get('/:batchId/qr', authenticate, validateBatchIdParam, getBatchQr);

// Lifecycle actions
// 1. Manufacturer creates new medicine batch
router.post(
  '/',
  authenticate,
  requireRole('MANUFACTURER'),
  validateCreateBatchBody,
  createBatch
);

// 2. Transfer / Status update (Manufacturer or Distributor or Pharmacy)
router.post(
  '/:batchId/status',
  authenticate,
  requireRole('MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'),
  validateBatchIdParam,
  updateBatchStatus
);

// 3. Dispense to end patient (Pharmacy & Hospital)
router.post(
  '/:batchId/dispense',
  authenticate,
  requireRole('PHARMACY', 'HOSPITAL'),
  validateBatchIdParam,
  dispenseBatch
);

// 4. Recall batch (Admin or Manufacturer)
router.post(
  '/:batchId/recall',
  authenticate,
  requireRole('ADMIN', 'MANUFACTURER'),
  validateBatchIdParam,
  recallBatch
);

export default router;
