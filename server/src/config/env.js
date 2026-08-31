export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  databaseUrl: process.env.DATABASE_URL || '',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'shiftsync',
    password: process.env.DB_PASSWORD || 'shiftsync',
    name: process.env.DB_NAME || 'shiftsync',
  },
  cutoffHours: Number(process.env.SCHEDULE_CUTOFF_HOURS || 48),
};
