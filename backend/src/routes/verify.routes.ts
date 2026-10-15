import { Router } from 'express';
import { verifyBatchPublic } from '../controllers/verify.controller';
import { validateBatchIdParam } from '../middleware/validator.middleware';

const router = Router();

// Public Verification Endpoint — accessible by anyone, QR scanner, or consumer with NO LOGIN required!
router.get('/:batchId', validateBatchIdParam, verifyBatchPublic);

export default router;
