import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required'),
  address: z.string().trim().nullable().optional(),
});

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1, 'Branch name cannot be empty').optional(),
    address: z.string().trim().nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.address !== undefined, {
    message: 'At least one field (name or address) must be provided for update',
  });

export const updateBranchStatusSchema = z.object({
  isActive: z.boolean({
    message: 'isActive must be a boolean',
  }),
});


export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type UpdateBranchStatusInput = z.infer<typeof updateBranchStatusSchema>;

export class BranchService {
  /**
   * Generates a cryptographically random, URL-safe QR token.
   * Ensures global uniqueness before returning.
   */
  private static async generateUniqueQrToken(): Promise<string> {
    let token = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      attempts++;
      token = crypto.randomBytes(16).toString('hex');
      const found = await prisma.branch.findUnique({
        where: { qrToken: token },
      });
      if (!found) {
        exists = false;
      }
    }

    if (exists) {
      throw new AppError('Failed to generate unique QR token, please try again', 500);
    }

    return token;
  }

  /**
   * Create a new branch for the authenticated owner's business.
   */
  static async createBranch(businessId: string, input: unknown) {
    const validatedData = createBranchSchema.parse(input);
    const qrToken = await this.generateUniqueQrToken();

    const branch = await prisma.branch.create({
      data: {
        businessId,
        name: validatedData.name,
        address: validatedData.address ?? null,
        qrToken,
        isActive: true,
      },
    });

    return branch;
  }

  /**
   * List all branches for the authenticated owner's business.
   */
  static async getBranches(businessId: string) {
    const branches = await prisma.branch.findMany({
      where: {
        businessId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return branches;
  }

  /**
   * Get a specific branch by ID, verifying tenant ownership.
   */
  static async getBranchById(branchId: string, businessId: string) {
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
      },
    });

    if (!branch) {
      throw new AppError('Branch not found', 404);
    }

    return branch;
  }

  /**
   * Update branch details (name, address), verifying tenant ownership.
   */
  static async updateBranch(
    branchId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateBranchSchema.parse(input);

    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
      },
    });

    if (!existingBranch) {
      throw new AppError('Branch not found', 404);
    }

    const updated = await prisma.branch.update({
      where: {
        id: branchId,
      },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
        ...(validatedData.address !== undefined ? { address: validatedData.address } : {}),
      },
    });

    return updated;
  }

  /**
   * Update branch status (soft activate/deactivate), verifying tenant ownership.
   */
  static async updateBranchStatus(
    branchId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateBranchStatusSchema.parse(input);

    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
      },
    });

    if (!existingBranch) {
      throw new AppError('Branch not found', 404);
    }

    const updated = await prisma.branch.update({
      where: {
        id: branchId,
      },
      data: {
        isActive: validatedData.isActive,
      },
    });

    return updated;
  }
}
