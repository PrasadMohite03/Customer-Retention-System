import { z } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(1, 'Business name cannot be empty').optional(),
    type: z.string().trim().nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.type !== undefined, {
    message: 'At least one field (name or type) must be provided for update',
  });

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export class BusinessService {
  /**
   * Get the business profile for an authenticated owner.
   * Strictly isolated to req.user.businessId and req.user.userId.
   */
  static async getBusiness(businessId: string, ownerId: string) {
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: ownerId,
      },
      include: {
        _count: {
          select: {
            branches: true,
          },
        },
      },
    });

    if (!business) {
      throw new AppError('Business not found', 404);
    }

    return {
      id: business.id,
      name: business.name,
      type: business.type,
      ownerId: business.ownerId,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      branchCount: business._count.branches,
    };
  }

  /**
   * Update the business profile for an authenticated owner.
   * Strictly isolated to req.user.businessId and req.user.userId.
   */
  static async updateBusiness(
    businessId: string,
    ownerId: string,
    input: unknown
  ) {
    const validatedData = updateBusinessSchema.parse(input);

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: ownerId,
      },
    });

    if (!business) {
      throw new AppError('Business not found', 404);
    }

    const updated = await prisma.business.update({
      where: {
        id: businessId,
      },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
        ...(validatedData.type !== undefined ? { type: validatedData.type } : {}),
      },
    });

    return updated;
  }
}
