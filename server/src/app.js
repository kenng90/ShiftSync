import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { locationsRouter } from './routes/locations.js';
import { availabilityRouter } from './routes/availability.js';
import { shiftsRouter } from './routes/shifts.js';
import { swapsRouter } from './routes/swaps.js';
import { laborRouter } from './routes/labor.js';
import { fairnessRouter } from './routes/fairness.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.json({ name: 'ShiftSync API', status: 'ok' });
  });
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/locations', locationsRouter);
  app.use('/availability', availabilityRouter);
  app.use('/shifts', shiftsRouter);
  app.use('/swaps', swapsRouter);
  app.use('/labor', laborRouter);
  app.use('/fairness', fairnessRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
