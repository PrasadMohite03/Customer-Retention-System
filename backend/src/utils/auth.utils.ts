import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { CookieOptions } from 'express';
import { config } from '../config';
import { UserRole } from '@prisma/client';

export { config };

export interface JwtPayload {
  userId: string;
  role: UserRole;
  businessId: string;
}

export interface CustomerJwtPayload {
  customerId: string;
  role: 'CUSTOMER';
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: '15m',
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function generateCustomerAccessToken(payload: CustomerJwtPayload): string {
  const options: SignOptions = {
    expiresIn: '15m',
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyCustomerAccessToken(token: string): CustomerJwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as CustomerJwtPayload;
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function getRefreshCookieOptions(): CookieOptions {
  const isProduction = config.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
