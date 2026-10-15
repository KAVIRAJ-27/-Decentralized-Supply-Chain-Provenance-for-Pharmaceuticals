import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import batchRoutes from './routes/batch.routes';
import verifyRoutes from './routes/verify.routes';
import statsRoutes from './routes/stats.routes';

const app = express();

// Middlewares
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'MediTrace Provenance Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/verify', verifyRoutes); // Public verification without login
app.use('/api/public/verify', verifyRoutes); // Standard public verification alias
app.use('/api/stats', statsRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start Server
app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`💊 MediTrace API running on http://localhost:${config.port}`);
  console.log(`🔍 Public Verification: http://localhost:${config.port}/api/verify/:batchId`);
  console.log(`🛡️  Role Management: http://localhost:${config.port}/api/auth`);
  console.log('====================================================');
});

export default app;
