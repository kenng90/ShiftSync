import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.json({ name: 'ShiftSync API', status: 'ok' });
  });
  app.use('/health', healthRouter);
  return app;
}
