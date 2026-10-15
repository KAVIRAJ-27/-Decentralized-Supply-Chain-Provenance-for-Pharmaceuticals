import { Request, Response, NextFunction } from 'express';

// Standard Batch ID Regex: MED-YYYYMMDD-XXXXX (e.g. MED-20261015-A8F2K)
export const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

export function validateBatchIdParam(req: Request, res: Response, next: NextFunction) {
  const batchId = (req.params.batchId || '').trim().toUpperCase();
  if (!batchId) {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  if (!BATCH_ID_REGEX.test(batchId)) {
    return res.status(400).json({
      verified: false,
      batchId,
      error: `Invalid Batch ID format '${batchId}'. Must follow standardized pattern: MED-YYYYMMDD-XXXXX (e.g., MED-20261015-A8F2K)`,
      expectedFormat: 'MED-YYYYMMDD-XXXXX',
    });
  }

  req.params.batchId = batchId;
  next();
}

export function validateCreateBatchBody(req: Request, res: Response, next: NextFunction) {
  const { batchId, drugName, genericName, dosage, quantity, manufacturingDate, expiryDate } = req.body;

  if (!batchId || !BATCH_ID_REGEX.test(batchId.trim().toUpperCase())) {
    return res.status(400).json({
      error: `Invalid or missing batchId. Expected format: MED-YYYYMMDD-XXXXX`,
    });
  }

  if (!drugName || typeof drugName !== 'string') {
    return res.status(400).json({ error: 'Valid drugName is required' });
  }

  if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  if (!manufacturingDate || !expiryDate) {
    return res.status(400).json({ error: 'manufacturingDate and expiryDate are required' });
  }

  if (new Date(expiryDate).getTime() <= new Date(manufacturingDate).getTime()) {
    return res.status(400).json({ error: 'expiryDate must be after manufacturingDate' });
  }

  req.body.batchId = batchId.trim().toUpperCase();
  next();
}
