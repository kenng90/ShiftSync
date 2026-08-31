import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startJobs } from './jobs/expireDrops.js';
import { attachSockets } from './sockets.js';

const app = createApp();
const server = createServer(app);
attachSockets(server);
startJobs();

server.listen(env.port, '0.0.0.0', () => {
  console.log(`ShiftSync API listening on port ${env.port}`);
});
