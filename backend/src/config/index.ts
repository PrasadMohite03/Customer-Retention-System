import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory if needed
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-super-secret-jwt-key-customer-retention-2026',
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_DAYS: 7,
  REFRESH_COOKIE_NAME: 'refreshToken',
};
