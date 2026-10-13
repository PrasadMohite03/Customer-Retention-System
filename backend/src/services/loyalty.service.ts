import { z } from 'zod';
import { Prisma, RewardType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { syncMilestoneChangeToActiveCycles, RewardChangeMode } from '../utils/cycleSnapshot';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const createLoyaltyProgramSchema = z.object({
  name: z.string().trim().min(1, 'Program name is required'),
  description: z.string().trim().nullable().optional(),
  cycleLength: z
    .number({ message: 'cycleLength must be a number' })
    .int('cycleLength must be an integer')
    .min(1, 'cycleLength must be at least 1'),
});

export const updateLoyaltyProgramSchema = z
  .object({
    name: z.string().trim().min(1, 'Program name cannot be empty').optional(),
    description: z.string().trim().nullable().optional(),
    cycleLength: z
      .number({ message: 'cycleLength must be a number' })
      .int('cycleLength must be an integer')
      .min(1, 'cycleLength must be at least 1')
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.cycleLength !== undefined,
    { message: 'At least one field must be provided for update' }
  );

export const updateLoyaltyProgramStatusSchema = z.object({
  isActive: z.boolean({ message: 'isActive must be a boolean' }),
});

export const createMilestoneSchema = z
  .object({
    visitNumber: z
      .number({ message: 'visitNumber must be a number' })
      .int('visitNumber must be an integer')
      .min(1, 'visitNumber must be at least 1'),
    rewardType: z.nativeEnum(RewardType, { message: 'Invalid rewardType' }),
    rewardName: z.string().trim().nullable().optional(),
    rewardDescription: z.string().trim().nullable().optional(),
    rewardValue: z.number().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.rewardType !== 'PERCENT_DISCOUNT') return true;
      return data.rewardValue != null && data.rewardValue > 0 && data.rewardValue <= 100;
    },
    { message: 'PERCENT_DISCOUNT requires rewardValue between 0 (exclusive) and 100 (inclusive)' }
  )
  .refine(
    (data) => {
      if (data.rewardType !== 'FIXED_DISCOUNT') return true;
      return data.rewardValue != null && data.rewardValue > 0;
    },
    { message: 'FIXED_DISCOUNT requires a positive rewardValue' }
  )
  .refine(
    (data) => {
      if (data.rewardType !== 'FREE_ITEM') return true;
      return !!(data.rewardName?.trim());
    },
    { message: 'FREE_ITEM requires a non-empty rewardName' }
  );

export const updateMilestoneSchema = z
  .object({
    visitNumber: z
      .number({ message: 'visitNumber must be a number' })
      .int('visitNumber must be an integer')
      .min(1, 'visitNumber must be at least 1')
      .optional(),
    rewardType: z.nativeEnum(RewardType, { message: 'Invalid rewardType' }).optional(),
    rewardName: z.string().trim().nullable().optional(),
    rewardDescription: z.string().trim().nullable().optional(),
    rewardValue: z.number().nullable().optional(),
    changeMode: z.nativeEnum(RewardChangeMode).optional(),
  })
  .refine(
    (data) =>
      data.visitNumber !== undefined ||
      data.rewardType !== undefined ||
      data.rewardName !== undefined ||
      data.rewardDescription !== undefined ||
      data.rewardValue !== undefined ||
      data.changeMode !== undefined,
    { message: 'At least one field must be provided for update' }
  )
  .refine(
    (data) => {
      if (data.rewardType !== 'PERCENT_DISCOUNT' || data.rewardValue === undefined) return true;
      return data.rewardValue != null && data.rewardValue > 0 && data.rewardValue <= 100;
    },
    { message: 'PERCENT_DISCOUNT requires rewardValue between 0 (exclusive) and 100 (inclusive)' }
  )
  .refine(
    (data) => {
      if (data.rewardType !== 'FIXED_DISCOUNT' || data.rewardValue === undefined) return true;
      return data.rewardValue != null && data.rewardValue > 0;
    },
    { message: 'FIXED_DISCOUNT requires a positive rewardValue' }
  )
  .refine(
    (data) => {
      if (data.rewardType !== 'FREE_ITEM' || data.rewardName === undefined) return true;
      return !!(data.rewardName?.trim());
    },
    { message: 'FREE_ITEM requires a non-empty rewardName' }
  );

export const updateMilestoneStatusSchema = z.object({
  isEnabled: z.boolean({ message: 'isEnabled must be a boolean' }),
  changeMode: z.nativeEnum(RewardChangeMode).optional(),
});

export type CreateLoyaltyProgramInput = z.infer<typeof createLoyaltyProgramSchema>;
export type UpdateLoyaltyProgramInput = z.infer<typeof updateLoyaltyProgramSchema>;
export type UpdateLoyaltyProgramStatusInput = z.infer<typeof updateLoyaltyProgramStatusSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type UpdateMilestoneStatusInput = z.infer<typeof updateMilestoneStatusSchema>;


// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Verify that the branch belongs to the authenticated owner's business.
 * Throws 404 if the branch is not found or does not belong to the business.
 */
async function verifyBranchOwnership(branchId: string, businessId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId },
  });
  if (!branch) {
    throw new AppError('Branch not found', 404);
  }
  return branch;
}

/**
 * Verify that a loyalty program belongs to the authenticated owner's business.
 * Throws 404 if not found.
 */
async function verifyProgramOwnership(programId: string, businessId: string) {
  const program = await prisma.loyaltyProgram.findFirst({
    where: { id: programId, businessId },
    include: {
      milestones: { orderBy: { visitNumber: 'asc' } },
    },
  });
  if (!program) {
    throw new AppError('Loyalty program not found', 404);
  }
  return program;
}

/**
 * Verify that a milestone belongs to the authenticated owner's business
 * by joining through its loyalty program.
 */
async function verifyMilestoneOwnership(milestoneId: string, businessId: string) {
  const milestone = await prisma.milestone.findFirst({
    where: {
      id: milestoneId,
      program: { businessId },
    },
    include: {
      program: true,
    },
  });
  if (!milestone) {
    throw new AppError('Milestone not found', 404);
  }
  return milestone;
}

// ─── LoyaltyService ──────────────────────────────────────────────────────────

export class LoyaltyService {
  // ── Loyalty Program Methods ─────────────────────────────────────────────

  /**
   * Create a new loyalty program for a branch.
   * Enforces: one active program per branch (via partial unique index + app-level check).
   * businessId is derived from the authenticated user — never accepted from client.
   */
  static async createLoyaltyProgram(
    branchId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = createLoyaltyProgramSchema.parse(input);
    await verifyBranchOwnership(branchId, businessId);

    // Pre-emptively check for existing active program (gives clearer error than index violation)
    const existingActive = await prisma.loyaltyProgram.findFirst({
      where: { branchId, isActive: true },
    });
    if (existingActive) {
      throw new AppError(
        'This branch already has an active loyalty program. Deactivate it before creating a new one.',
        409
      );
    }

    try {
      const program = await prisma.loyaltyProgram.create({
        data: {
          businessId,
          branchId,
          name: validatedData.name,
          description: validatedData.description ?? null,
          cycleLength: validatedData.cycleLength,
          isActive: true,
        },
        include: {
          milestones: {
            orderBy: { visitNumber: 'asc' },
            include: { _count: { select: { milestoneRewards: true } } },
          },
        },
      });

      return program;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'This branch already has an active loyalty program.',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Get the active loyalty program for a branch (includes milestones ordered by visitNumber).
   */
  static async getLoyaltyProgram(branchId: string, businessId: string) {
    await verifyBranchOwnership(branchId, businessId);

    const program = await prisma.loyaltyProgram.findFirst({
      where: { branchId, businessId, isActive: true },
      include: {
        milestones: {
          orderBy: { visitNumber: 'asc' },
          include: { _count: { select: { milestoneRewards: true } } },
        },
      },
    });

    if (!program) {
      throw new AppError('No active loyalty program found for this branch', 404);
    }

    return program;
  }

  /**
   * Update the active loyalty program's name, description, or cycleLength.
   * Validates that reducing cycleLength does not invalidate existing milestones.
   */
  static async updateLoyaltyProgram(
    branchId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateLoyaltyProgramSchema.parse(input);
    await verifyBranchOwnership(branchId, businessId);

    const program = await prisma.loyaltyProgram.findFirst({
      where: { branchId, businessId, isActive: true },
      include: {
        milestones: { orderBy: { visitNumber: 'asc' } },
      },
    });

    if (!program) {
      throw new AppError('No active loyalty program found for this branch', 404);
    }

    // Validate cycleLength reduction does not conflict with existing active milestones
    if (validatedData.cycleLength !== undefined) {
      const newCycleLength = validatedData.cycleLength;
      const conflictingMilestone = program.milestones.find(
        (m) => m.isEnabled && m.visitNumber > newCycleLength
      );
      if (conflictingMilestone) {
        throw new AppError(
          `Cannot reduce visits to complete to ${newCycleLength}: active reward at visit ${conflictingMilestone.visitNumber} (${conflictingMilestone.rewardName || 'Reward'}) exceeds the new visit count. Disable or remove that reward first.`,
          409
        );
      }
    }

    const updated = await prisma.loyaltyProgram.update({
      where: { id: program.id },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
        ...(validatedData.description !== undefined
          ? { description: validatedData.description }
          : {}),
        ...(validatedData.cycleLength !== undefined
          ? { cycleLength: validatedData.cycleLength }
          : {}),
      },
      include: {
        milestones: {
          orderBy: { visitNumber: 'asc' },
          include: { _count: { select: { milestoneRewards: true } } },
        },
      },
    });

    return updated;
  }

  /**
   * List all loyalty programs for a branch, ordered newest first.
   * Used by the owner management UI (shows active and inactive programs).
   */
  static async getLoyaltyPrograms(branchId: string, businessId: string) {
    await verifyBranchOwnership(branchId, businessId);

    return prisma.loyaltyProgram.findMany({
      where: { branchId, businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        milestones: {
          orderBy: { visitNumber: 'asc' },
          include: { _count: { select: { milestoneRewards: true } } },
        },
      },
    });
  }

  // ── Milestone Methods ──────────────────────────────────────────────────

  /**
   * Add a milestone to a loyalty program.
   * Enforces: visitNumber must be within [1, program.cycleLength].
   * Enforces: (programId, visitNumber) uniqueness (via DB + app-level check).
   */
  static async createMilestone(
    programId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = createMilestoneSchema.parse(input);
    const program = await verifyProgramOwnership(programId, businessId);

    // Validate visitNumber within cycleLength
    if (validatedData.visitNumber > program.cycleLength) {
      throw new AppError(
        `visitNumber (${validatedData.visitNumber}) exceeds the program's cycleLength (${program.cycleLength})`,
        409
      );
    }

    try {
      const milestone = await prisma.milestone.create({
        data: {
          programId,
          visitNumber: validatedData.visitNumber,
          rewardType: validatedData.rewardType as RewardType,
          rewardName: validatedData.rewardName ?? null,
          rewardDescription: validatedData.rewardDescription ?? null,
          rewardValue:
            validatedData.rewardValue != null
              ? new Prisma.Decimal(validatedData.rewardValue)
              : null,
          isEnabled: true,
        },
        include: {
          _count: { select: { milestoneRewards: true } },
        },
      });

      return milestone;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          `A milestone already exists at visit #${validatedData.visitNumber} for this program`,
          409
        );
      }
      throw error;
    }
  }

  /**
   * Update a milestone's fields (visitNumber, reward type/value/name/description).
   * Re-validates visitNumber constraints if changed.
   */
  static async updateMilestone(
    milestoneId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateMilestoneSchema.parse(input);
    const milestone = await verifyMilestoneOwnership(milestoneId, businessId);

    // Validate visitNumber against cycleLength if being changed
    if (validatedData.visitNumber !== undefined) {
      if (validatedData.visitNumber > milestone.program.cycleLength) {
        throw new AppError(
          `visitNumber (${validatedData.visitNumber}) exceeds the program's cycleLength (${milestone.program.cycleLength})`,
          409
        );
      }
    }

    try {
      const updated = await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(validatedData.changeMode === RewardChangeMode.STOP_REWARD
            ? { isEnabled: false }
            : {}),
          ...(validatedData.visitNumber !== undefined
            ? { visitNumber: validatedData.visitNumber }
            : {}),
          ...(validatedData.rewardType !== undefined
            ? { rewardType: validatedData.rewardType as RewardType }
            : {}),
          ...(validatedData.rewardName !== undefined
            ? { rewardName: validatedData.rewardName }
            : {}),
          ...(validatedData.rewardDescription !== undefined
            ? { rewardDescription: validatedData.rewardDescription }
            : {}),
          ...(validatedData.rewardValue !== undefined
            ? {
                rewardValue:
                  validatedData.rewardValue != null
                    ? new Prisma.Decimal(validatedData.rewardValue)
                    : null,
              }
            : {}),
        },
        include: {
          _count: { select: { milestoneRewards: true } },
        },
      });

      // Synchronize changes to active cycles if changeMode is specified
      if (validatedData.changeMode) {
        await syncMilestoneChangeToActiveCycles({
          programId: milestone.programId,
          milestoneId: updated.id,
          targetVisitNumber: updated.visitNumber,
          mode: validatedData.changeMode,
          updatedMilestone: {
            id: updated.id,
            visitNumber: updated.visitNumber,
            rewardType: updated.rewardType,
            rewardName: updated.rewardName,
            rewardDescription: updated.rewardDescription,
            rewardValue: updated.rewardValue ? updated.rewardValue.toString() : null,
            isEnabled: updated.isEnabled,
          },
        });
      }

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          `A milestone already exists at visit #${validatedData.visitNumber} for this program`,
          409
        );
      }
      throw error;
    }
  }

  /**
   * Enable or disable a milestone (isEnabled toggle).
   * Disabled milestones are skipped by the loyalty engine.
   */
  static async updateMilestoneStatus(
    milestoneId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateMilestoneStatusSchema.parse(input);
    const milestone = await verifyMilestoneOwnership(milestoneId, businessId);

    // Cannot enable a milestone if its visit number exceeds the program's cycle length
    if (validatedData.isEnabled && milestone.visitNumber > milestone.program.cycleLength) {
      throw new AppError(
        `Cannot enable reward for visit #${milestone.visitNumber}: the loyalty program only has ${milestone.program.cycleLength} visits to complete. Increase visits to complete first or edit this reward.`,
        400
      );
    }

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { isEnabled: validatedData.isEnabled },
      include: {
        _count: { select: { milestoneRewards: true } },
      },
    });

    const mode =
      validatedData.changeMode ??
      (validatedData.isEnabled ? RewardChangeMode.NEW_CYCLES_ONLY : RewardChangeMode.STOP_REWARD);

    await syncMilestoneChangeToActiveCycles({
      programId: milestone.programId,
      milestoneId: updated.id,
      targetVisitNumber: updated.visitNumber,
      mode,
      updatedMilestone: {
        id: updated.id,
        visitNumber: updated.visitNumber,
        rewardType: updated.rewardType,
        rewardName: updated.rewardName,
        rewardDescription: updated.rewardDescription,
        rewardValue: updated.rewardValue ? updated.rewardValue.toString() : null,
        isEnabled: updated.isEnabled,
      },
    });

    return updated;
  }

  /**
   * Dedicated domain method for reward change impact (Phase 1 backend architecture).
   * Supports NEW_CYCLES_ONLY, EXISTING_AND_NEW, and STOP_REWARD.
   */
  static async applyMilestoneRewardChange(
    milestoneId: string,
    businessId: string,
    mode: RewardChangeMode,
    updates?: {
      rewardType?: RewardType;
      rewardName?: string | null;
      rewardDescription?: string | null;
      rewardValue?: number | null;
      visitNumber?: number;
      isEnabled?: boolean;
    }
  ) {
    const milestone = await verifyMilestoneOwnership(milestoneId, businessId);

    let updatedMilestone = milestone;

    if (mode === RewardChangeMode.STOP_REWARD) {
      updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { isEnabled: false },
        include: {
          program: true,
          _count: { select: { milestoneRewards: true } },
        },
      });
    } else if (updates) {
      if (updates.visitNumber !== undefined && updates.visitNumber > milestone.program.cycleLength) {
        throw new AppError(
          `visitNumber (${updates.visitNumber}) exceeds the program's cycleLength (${milestone.program.cycleLength})`,
          409
        );
      }

      updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(updates.visitNumber !== undefined ? { visitNumber: updates.visitNumber } : {}),
          ...(updates.rewardType !== undefined ? { rewardType: updates.rewardType } : {}),
          ...(updates.rewardName !== undefined ? { rewardName: updates.rewardName } : {}),
          ...(updates.rewardDescription !== undefined ? { rewardDescription: updates.rewardDescription } : {}),
          ...(updates.rewardValue !== undefined
            ? {
                rewardValue:
                  updates.rewardValue != null
                    ? new Prisma.Decimal(updates.rewardValue)
                    : null,
              }
            : {}),
          ...(updates.isEnabled !== undefined ? { isEnabled: updates.isEnabled } : {}),
        },
        include: {
          program: true,
          _count: { select: { milestoneRewards: true } },
        },
      });
    }

    await syncMilestoneChangeToActiveCycles({
      programId: updatedMilestone.programId,
      milestoneId: updatedMilestone.id,
      targetVisitNumber: updatedMilestone.visitNumber,
      mode,
      updatedMilestone: {
        id: updatedMilestone.id,
        visitNumber: updatedMilestone.visitNumber,
        rewardType: updatedMilestone.rewardType,
        rewardName: updatedMilestone.rewardName,
        rewardDescription: updatedMilestone.rewardDescription,
        rewardValue: updatedMilestone.rewardValue ? updatedMilestone.rewardValue.toString() : null,
        isEnabled: updatedMilestone.isEnabled,
      },
    });

    return updatedMilestone;
  }

  /**
   * Hard-delete a milestone if it has no associated MilestoneReward records.
   * Prisma's Restrict FK will prevent deletion if rewards exist (caught and re-thrown as 409).
   */
  static async deleteMilestone(milestoneId: string, businessId: string) {
    await verifyMilestoneOwnership(milestoneId, businessId);

    // Explicit pre-check for better error message than a raw FK violation
    const rewardCount = await prisma.milestoneReward.count({
      where: { milestoneId },
    });

    if (rewardCount > 0) {
      throw new AppError(
        'Cannot delete this milestone: it has associated customer reward records. Disable it instead.',
        409
      );
    }

    await prisma.milestone.delete({ where: { id: milestoneId } });
  }

  /**
   * Activate or deactivate a loyalty program by its own ID.
   * For activation: verifies no OTHER program is already active for the same branch.
   * The PostgreSQL partial unique index provides the final concurrency guarantee.
   */
  static async setProgramStatus(
    programId: string,
    businessId: string,
    input: unknown
  ) {
    const { isActive } = updateLoyaltyProgramStatusSchema.parse(input);

    // Verify ownership
    const program = await prisma.loyaltyProgram.findFirst({
      where: { id: programId, businessId },
    });
    if (!program) {
      throw new AppError('Loyalty program not found', 404);
    }

    if (isActive) {
      // Check for a DIFFERENT active program on the same branch
      const conflicting = await prisma.loyaltyProgram.findFirst({
        where: {
          branchId: program.branchId,
          isActive: true,
          id: { not: programId },
        },
      });
      if (conflicting) {
        throw new AppError(
          `Cannot activate: this branch already has an active loyalty program ("${conflicting.name}"). Deactivate it first.`,
          409
        );
      }
    }

    try {
      const updated = await prisma.loyaltyProgram.update({
        where: { id: programId },
        data: { isActive },
      });
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'Another program is already active for this branch.',
          409
        );
      }
      throw error;
    }
  }
}
