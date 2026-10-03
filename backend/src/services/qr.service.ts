import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';

export class QrService {
  /**
   * Resolves public branch & active loyalty program information by qrToken.
   * Does NOT expose internal database UUIDs (businessId, branchId, programId).
   */
  static async resolvePublicQr(qrToken: string) {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('QR token is required', 400);
    }

    const branch = await prisma.branch.findUnique({
      where: { qrToken: qrToken.trim() },
      include: {
        business: true,
        loyaltyPrograms: {
          where: { isActive: true },
          include: {
            milestones: {
              where: { isEnabled: true },
              orderBy: { visitNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new AppError('Invalid or expired QR code', 404);
    }

    if (!branch.isActive) {
      throw new AppError('This branch location is currently inactive', 400);
    }

    const activeProgram = branch.loyaltyPrograms[0];
    if (!activeProgram) {
      throw new AppError('No active loyalty program is configured for this branch', 422);
    }

    return {
      business: {
        name: branch.business.name,
        type: branch.business.type,
      },
      branch: {
        name: branch.name,
        address: branch.address,
      },
      program: {
        name: activeProgram.name,
        description: activeProgram.description,
        cycleLength: activeProgram.cycleLength,
        milestones: activeProgram.milestones.map((m) => ({
          visitNumber: m.visitNumber,
          rewardType: m.rewardType,
          rewardName: m.rewardName,
          rewardDescription: m.rewardDescription,
          rewardValue: m.rewardValue ? m.rewardValue.toString() : null,
        })),
      },
    };
  }
}
