import { Router } from 'express';
import { hydrate, login } from '../services/auth.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const result = await login(req.body);
    res.json(result);
  })
);

authRouter.get(
  '/me',
  authRequired,
  wrap(async (req, res) => {
    res.json({ user: await hydrate(req.user) });
  })
);
