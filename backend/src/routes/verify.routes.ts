import { Router } from 'express';
import { verifyBatchPublic } from '../controllers/verify.controller';
import { validateBatchIdParam } from '../middleware/validator.middleware';
import { checkVerificationRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Public Verification Endpoint — accessible by anyone, QR scanner, or consumer with NO LOGIN required!
router.get('/:batchId', checkVerificationRateLimit, validateBatchIdParam, verifyBatchPublic);

export default router;
