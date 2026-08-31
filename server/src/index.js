import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startJobs } from './jobs/expireDrops.js';

const app = createApp();
const server = createServer(app);
startJobs();

server.listen(env.port, () => {
  console.log(`ShiftSync API listening on port ${env.port}`);
});
