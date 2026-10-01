import { z } from 'zod';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  config,
} from '../utils/auth.utils';

// Zod validation schemas
export const registerOwnerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  businessName: z.string().trim().min(1, 'Business name is required'),
  businessType: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export class AuthService {
  /**
   * Register a new Business Owner and Business in a transaction.
   */
  static async registerOwner(input: RegisterOwnerInput) {
    const validatedData = registerOwnerSchema.parse(input);
    const emailLower = validatedData.email.toLowerCase();

    // Reject duplicate emails
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      throw new AppError('Email is already registered', 400);
    }

    const passwordHash = await hashPassword(validatedData.password);

    // Transaction to create User and Business
    const { user, business } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          role: UserRole.OWNER,
        },
      });

      const newBusiness = await tx.business.create({
        data: {
          name: validatedData.businessName,
          type: validatedData.businessType || null,
          ownerId: newUser.id,
        },
      });

      return { user: newUser, business: newBusiness };
    });

    // Generate access token & stateful refresh session
    const accessToken = generateAccessToken({
      userId: user.id,
      role: UserRole.OWNER,
      businessId: business.id,
    });

    const opaqueToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(opaqueToken);
    const expiresAt = new Date(
      Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    const session = await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        isRevoked: false,
      },
    });

    const refreshTokenValue = `${session.id}:${opaqueToken}`;

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      business: {
        id: business.id,
        name: business.name,
        type: business.type,
      },
      accessToken,
      refreshTokenValue,
    };
  }

  /**
   * Authenticate Owner or Staff.
   */
  static async login(input: LoginInput) {
    const validatedData = loginSchema.parse(input);
    const emailLower = validatedData.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await comparePassword(validatedData.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    let businessId: string;

    if (user.role === UserRole.OWNER) {
      const businesses = await prisma.business.findMany({
        where: { ownerId: user.id },
      });

      // OWNER must have exactly one active Business context
      if (businesses.length !== 1) {
        throw new AppError('Invalid credentials', 401);
      }

      businessId = businesses[0].id;
    } else if (user.role === UserRole.STAFF) {
      const staffAssignments = await prisma.staff.findMany({
        where: { userId: user.id },
      });

      // STAFF must have exactly one active Staff assignment
      if (staffAssignments.length !== 1) {
        throw new AppError('Invalid credentials', 401);
      }

      const staff = staffAssignments[0];

      // STAFF with isActive=false must be rejected
      if (!staff.isActive) {
        throw new AppError('Invalid credentials', 401);
      }

      businessId = staff.businessId;
    } else {
      throw new AppError('Invalid credentials', 401);
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      businessId,
    });

    const opaqueToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(opaqueToken);
    const expiresAt = new Date(
      Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    const session = await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        isRevoked: false,
      },
    });

    const refreshTokenValue = `${session.id}:${opaqueToken}`;

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      businessId,
      accessToken,
      refreshTokenValue,
    };
  }

  /**
   * Refresh access token and rotate refresh token.
   */
  static async refresh(cookieValue?: string) {
    if (!cookieValue || !cookieValue.includes(':')) {
      throw new AppError('Invalid or missing refresh token', 401);
    }

    const [sessionId, opaqueToken] = cookieValue.split(':');

    if (!sessionId || !opaqueToken) {
      throw new AppError('Invalid refresh token format', 401);
    }

    const session = await prisma.refreshSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new AppError('Invalid refresh session', 401);
    }

    if (session.isRevoked || session.expiresAt < new Date()) {
      throw new AppError('Refresh session expired or revoked', 401);
    }

    const suppliedHash = hashOpaqueToken(opaqueToken);

    // Reuse detection: hash mismatch on a valid/non-revoked session
    if (suppliedHash !== session.tokenHash) {
      await prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
      throw new AppError('Invalid refresh token (reuse detected)', 401);
    }

    if (!session.userId) {
      throw new AppError('Invalid refresh session user', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    let businessId: string;

    if (user.role === UserRole.OWNER) {
      const businesses = await prisma.business.findMany({
        where: { ownerId: user.id },
      });

      if (businesses.length !== 1) {
        throw new AppError('Owner business context invalid', 401);
      }

      businessId = businesses[0].id;
    } else if (user.role === UserRole.STAFF) {
      const staffAssignments = await prisma.staff.findMany({
        where: { userId: user.id },
      });

      if (staffAssignments.length !== 1 || !staffAssignments[0].isActive) {
        throw new AppError('Staff assignment invalid or inactive', 401);
      }

      businessId = staffAssignments[0].businessId;
    } else {
      throw new AppError('Invalid user role for refresh', 401);
    }

    // Token rotation: generate new opaque token and update session atomically
    const newOpaqueToken = generateOpaqueToken();
    const newTokenHash = hashOpaqueToken(newOpaqueToken);

    const updateResult = await prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        tokenHash: suppliedHash,
        isRevoked: false,
      },
      data: {
        tokenHash: newTokenHash,
        updatedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Concurrent rotation attempt or session status changed
      await prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
      throw new AppError('Token refresh collision', 401);
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      businessId,
    });

    const newRefreshTokenValue = `${sessionId}:${newOpaqueToken}`;

    return {
      accessToken: newAccessToken,
      refreshTokenValue: newRefreshTokenValue,
    };
  }

  /**
   * Revoke refresh session and log out.
   */
  static async logout(cookieValue?: string) {
    if (cookieValue && cookieValue.includes(':')) {
      const [sessionId] = cookieValue.split(':');
      if (sessionId) {
        try {
          await prisma.refreshSession.updateMany({
            where: { id: sessionId },
            data: { isRevoked: true },
          });
        } catch {
          // Ignore error on logout to allow safe cleanup
        }
      }
    }
  }
}
