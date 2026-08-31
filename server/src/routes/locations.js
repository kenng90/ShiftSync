import { Router } from 'express';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, managerLocationIds } from '../middleware/auth.js';

export const locationsRouter = Router();
locationsRouter.use(authRequired);

locationsRouter.get(
  '/',
  wrap(async (req, res) => {
    const ids = await managerLocationIds(req.user);
    const locations = await db('locations').whereIn('id', ids.length ? ids : [0]).orderBy('name');
    res.json({ locations });
  })
);
