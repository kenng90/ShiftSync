import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { db } from './db/knex.js';
import { attachIo } from './services/notify.js';

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await db('users').where({ id: payload.sub, is_active: true }).first();
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
    const locs =
      socket.user.role === 'admin'
        ? await db('locations').pluck('id')
        : socket.user.role === 'manager'
          ? await db('manager_locations').where({ user_id: socket.user.id }).pluck('location_id')
          : await db('location_certifications')
              .where({ user_id: socket.user.id })
              .whereNull('revoked_at')
              .pluck('location_id');
    for (const id of locs) socket.join(`location:${id}`);
  });

  attachIo(io);
  return io;
}
