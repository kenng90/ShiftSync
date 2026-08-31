import { Router } from 'express';
import { wrap } from '../middleware/error.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { acceptSwap, cancelOwn, createRequest, decide, listRequests } from '../services/swaps.js';

export const swapsRouter = Router();
swapsRouter.use(authRequired);

swapsRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json({ requests: await listRequests(req.user) });
  })
);

swapsRouter.post(
  '/',
  wrap(async (req, res) => {
    const result = await createRequest(req.user, req.body);
    res.status(201).json(result);
  })
);

swapsRouter.post(
  '/:id/accept',
  wrap(async (req, res) => {
    res.json(await acceptSwap(req.user, Number(req.params.id)));
  })
);

swapsRouter.post(
  '/:id/cancel',
  wrap(async (req, res) => {
    res.json(await cancelOwn(req.user, Number(req.params.id)));
  })
);

swapsRouter.post(
  '/:id/approve',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    res.json(await decide(req.user, Number(req.params.id), true));
  })
);

swapsRouter.post(
  '/:id/deny',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    res.json(await decide(req.user, Number(req.params.id), false));
  })
);
