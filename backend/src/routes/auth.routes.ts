import { Router } from 'express';
import { login, getCurrentUser, listParticipants } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.get('/participants', authenticate, listParticipants);

export default router;
