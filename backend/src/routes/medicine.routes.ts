import { Router } from 'express';
import {
  listMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
} from '../controllers/medicine.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Read catalog: Available to authenticated participants
router.get('/', authenticate, listMedicines);
router.get('/:medicineId', authenticate, getMedicineById);

// Registration and edits: Strictly restricted to MANUFACTURER or ADMIN
router.post('/', authenticate, requireRole('MANUFACTURER', 'ADMIN'), createMedicine);
router.put('/:medicineId', authenticate, requireRole('MANUFACTURER', 'ADMIN'), updateMedicine);

export default router;
