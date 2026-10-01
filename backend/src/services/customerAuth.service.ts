import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/phone.utils';
import {
  generateCustomerAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  generateOtpCode,
  config,
} from '../utils/auth.utils';
import { otpProvider } from './otp/otp.provider';

export const sendOtpSchema = z.object({
  phone: z.string().trim().min(8, 'Invalid phone number'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(8, 'Invalid phone number'),
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export class CustomerAuthService {
  /**
   * Generates, hashes, stores, and sends OTP to customer phone.
   */
  static async sendOtp(input: SendOtpInput) {
    const validatedData = sendOtpSchema.parse(input);
    const phone = normalizePhone(validatedData.phone);

    const otpCode = generateOtpCode();
    const otpHash = hashOpaqueToken(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Invalidate any previous active OTPs for this phone number
    await prisma.customerOtp.updateMany({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Save hashed OTP in database
    await prisma.customerOtp.create({
      data: {
        phone,
        otpHash,
        expiresAt,
        failedAttempts: 0,
        usedAt: null,
      },
    });

    // Send OTP via provider (Mock in development)
    await otpProvider.sendOtp(phone, otpCode);

    return {
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verifies OTP, creates/retrieves Customer, and issues tokens.
   */
  static async verifyOtp(input: VerifyOtpInput) {
    const validatedData = verifyOtpSchema.parse(input);
    const phone = normalizePhone(validatedData.phone);
    const { otp } = validatedData;

    // Find the latest active OTP for this phone
    const activeOtp = await prisma.customerOtp.findFirst({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gte: new Date() },
        failedAttempts: { lt: 3 },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!activeOtp) {
      throw new AppError('Invalid or expired OTP', 401);
    }

    const suppliedHash = hashOpaqueToken(otp);

    // Incorrect OTP attempt handling
    if (suppliedHash !== activeOtp.otpHash) {
      await prisma.customerOtp.update({
        where: { id: activeOtp.id },
        data: {
          failedAttempts: { increment: 1 },
        },
      });

      throw new AppError('Invalid or expired OTP', 401);
    }

    // Correct OTP: Mark OTP as used
    await prisma.customerOtp.update({
      where: { id: activeOtp.id },
      data: {
        usedAt: new Date(),
      },
    });

    // Find or create Customer record
    let customer = await prisma.customer.findUnique({
      where: { phone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone,
          name: 'Customer',
        },
      });
    }

    // Generate Customer Access JWT
    const accessToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    // Create Customer RefreshSession
    const opaqueToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(opaqueToken);
    const expiresAt = new Date(
      Date.now() + config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    const session = await prisma.refreshSession.create({
      data: {
        customerId: customer.id,
        userId: null,
        tokenHash,
        expiresAt,
        isRevoked: false,
      },
    });

    const refreshTokenValue = `${session.id}:${opaqueToken}`;

    return {
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
      },
      accessToken,
      refreshTokenValue,
    };
  }

  /**
   * Refreshes Customer access token with refresh token rotation & reuse detection.
   */
  static async refreshCustomer(cookieValue?: string) {
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

    if (!session || !session.customerId) {
      throw new AppError('Invalid customer refresh session', 401);
    }

    if (session.isRevoked || session.expiresAt < new Date()) {
      throw new AppError('Refresh session expired or revoked', 401);
    }

    const suppliedHash = hashOpaqueToken(opaqueToken);

    // Reuse detection
    if (suppliedHash !== session.tokenHash) {
      await prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
      throw new AppError('Invalid refresh token (reuse detected)', 401);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 401);
    }

    // Rotation
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
      await prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
      throw new AppError('Token refresh collision', 401);
    }

    const newAccessToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    const newRefreshTokenValue = `${sessionId}:${newOpaqueToken}`;

    return {
      accessToken: newAccessToken,
      refreshTokenValue: newRefreshTokenValue,
    };
  }

  /**
   * Customer logout.
   */
  static async logoutCustomer(cookieValue?: string) {
    if (cookieValue && cookieValue.includes(':')) {
      const [sessionId] = cookieValue.split(':');
      if (sessionId) {
        try {
          await prisma.refreshSession.updateMany({
            where: { id: sessionId },
            data: { isRevoked: true },
          });
        } catch {
          // Ignore error on logout
        }
      }
    }
  }
}
