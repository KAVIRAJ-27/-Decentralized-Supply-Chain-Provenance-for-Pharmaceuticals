import { Router } from 'express';
import {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  confirmDeliveryReceipt,
  cancelDelivery,
} from '../controllers/delivery.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// List deliveries (filtered by organization for non-admins)
router.get('/', authenticate, getAllDeliveries);

// Get single delivery with receipt confirmation details
router.get('/:deliveryId', authenticate, getDeliveryById);

// Create / Dispatch stock
router.post(
  '/',
  authenticate,
  requireRole('MANUFACTURER', 'DISTRIBUTOR', 'ADMIN'),
  createDelivery
);

// Explicit Receipt Confirmation (Pharmacy, Hospital, Distributor, Admin)
router.post(
  '/:deliveryId/confirm-receipt',
  authenticate,
  requireRole('DISTRIBUTOR', 'PHARMACY', 'HOSPITAL', 'ADMIN'),
  confirmDeliveryReceipt
);

// Cancel unfulfilled delivery (Manufacturer, Distributor, Admin)
router.post(
  '/:deliveryId/cancel',
  authenticate,
  requireRole('MANUFACTURER', 'DISTRIBUTOR', 'ADMIN'),
  cancelDelivery
);

export default router;
