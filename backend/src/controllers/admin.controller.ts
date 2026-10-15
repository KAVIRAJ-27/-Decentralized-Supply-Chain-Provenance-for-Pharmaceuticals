import { Response } from 'express';
import { db } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export function getAdminMetrics(req: AuthenticatedRequest, res: Response) {
  const metrics = db.getAdminMetrics();
  return res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}

export function listAdminActivities(req: AuthenticatedRequest, res: Response) {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const activities = db.listAdminActivities(limit);

  return res.json({
    success: true,
    data: activities,
    count: activities.length,
    timestamp: new Date().toISOString(),
  });
}
