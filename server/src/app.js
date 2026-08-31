import path from 'path';
import { fileURLToPath } from 'url';
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
import { notificationsRouter } from './routes/notifications.js';
import { onDutyRouter } from './routes/onDuty.js';
import { auditRouter } from './routes/audit.js';
import { errorHandler, notFound } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mountApi(router) {
  router.use('/health', healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);
  router.use('/locations', locationsRouter);
  router.use('/availability', availabilityRouter);
  router.use('/shifts', shiftsRouter);
  router.use('/swaps', swapsRouter);
  router.use('/labor', laborRouter);
  router.use('/fairness', fairnessRouter);
  router.use('/notifications', notificationsRouter);
  router.use('/on-duty', onDutyRouter);
  router.use('/audit', auditRouter);
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  if (process.env.NODE_ENV !== 'production') {
    app.get('/', (_req, res) => {
      res.json({ name: 'ShiftSync API', status: 'ok' });
    });
  }
  mountApi(app);
  const api = express.Router();
  mountApi(api);
  app.use('/api', api);

  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
