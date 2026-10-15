import { Router } from 'express';
import { getAdminMetrics, listAdminActivities } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All admin dashboard routes require authenticated ADMIN role
router.use(authenticate, requireRole('ADMIN'));

router.get('/metrics', getAdminMetrics);
router.get('/activities', listAdminActivities);

export default router;
