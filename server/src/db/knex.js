import knex from 'knex';
import config from '../../knexfile.js';

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export const db = knex(config[environment]);
