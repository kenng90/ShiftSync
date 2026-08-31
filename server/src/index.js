import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = createServer(app);

server.listen(env.port, () => {
  console.log(`ShiftSync API listening on port ${env.port}`);
});
