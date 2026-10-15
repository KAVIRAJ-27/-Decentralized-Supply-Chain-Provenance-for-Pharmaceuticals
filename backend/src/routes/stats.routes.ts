import { Router, Request, Response } from 'express';
import { db } from '../services/db.service';
import { blockchainService } from '../services/blockchain.service';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const stats = db.getStats();
  const blockchainStatus = await blockchainService.checkStatus();

  return res.json({
    metrics: stats,
    blockchain: blockchainStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
