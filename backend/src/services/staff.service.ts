import { z } from 'zod';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { hashPassword } from '../utils/auth.utils';

export const createStaffSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  branchId: z.string().uuid('Invalid branchId format'),
});

export const updateStaffSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
    branchId: z.string().uuid('Invalid branchId format').optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.password !== undefined ||
      data.branchId !== undefined,
    { message: 'At least one field (email, password, or branchId) must be provided for update' }
  );

export const updateStaffStatusSchema = z.object({
  isActive: z.boolean({ message: 'isActive must be a boolean' }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;

export class StaffService {
  /**
   * Create a new Staff account linked to a User record.
   * Enforces:
   * - Caller is OWNER
   * - branchId belongs to owner's businessId
   * - User role is STAFF
   * - Email uniqueness on User
   * - Password hashed via bcrypt
   */
  static async createStaff(businessId: string, input: unknown) {
    const validatedData = createStaffSchema.parse(input);
    const emailLower = validatedData.email.toLowerCase();

    // Verify branch belongs to owner's business
    const branch = await prisma.branch.findFirst({
      where: {
        id: validatedData.branchId,
        businessId,
      },
    });

    if (!branch) {
      throw new AppError('Branch not found or does not belong to your business', 404);
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      throw new AppError('Email is already registered', 409);
    }

    const passwordHash = await hashPassword(validatedData.password);

    // Create User and Staff in a transaction
    const staff = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          role: UserRole.STAFF,
        },
      });

      const newStaff = await tx.staff.create({
        data: {
          userId: newUser.id,
          businessId,
          branchId: branch.id,
          isActive: true,
        },
        include: {
          user: {
            select: { id: true, email: true, role: true, createdAt: true },
          },
          branch: {
            select: { id: true, name: true, address: true },
          },
        },
      });

      return newStaff;
    });

    return {
      id: staff.id,
      userId: staff.userId,
      email: staff.user.email,
      branchId: staff.branchId,
      branchName: staff.branch.name,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    };
  }

  /**
   * List all staff members for the owner's business.
   * Only returns staff accounts (user.role = STAFF).
   */
  static async getStaffList(businessId: string) {
    const staffList = await prisma.staff.findMany({
      where: {
        businessId,
        user: { role: UserRole.STAFF },
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
        branch: {
          select: { id: true, name: true, address: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return staffList.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user.email,
      branchId: s.branchId,
      branchName: s.branch.name,
      isActive: s.isActive,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Get a specific staff member by ID, verifying tenant boundary.
   */
  static async getStaffById(staffId: string, businessId: string) {
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        businessId,
        user: { role: UserRole.STAFF },
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
        branch: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    if (!staff) {
      throw new AppError('Staff member not found', 404);
    }

    return {
      id: staff.id,
      userId: staff.userId,
      email: staff.user.email,
      branchId: staff.branchId,
      branchName: staff.branch.name,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    };
  }

  /**
   * Update staff details (email, branch, password).
   */
  static async updateStaff(
    staffId: string,
    businessId: string,
    input: unknown
  ) {
    const validatedData = updateStaffSchema.parse(input);

    const existingStaff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        businessId,
        user: { role: UserRole.STAFF },
      },
      include: { user: true },
    });

    if (!existingStaff) {
      throw new AppError('Staff member not found', 404);
    }

    // If updating branchId, verify new branch belongs to business
    if (validatedData.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: validatedData.branchId,
          businessId,
        },
      });

      if (!branch) {
        throw new AppError('Branch not found or does not belong to your business', 404);
      }
    }

    // If updating email, check uniqueness
    if (validatedData.email) {
      const emailLower = validatedData.email.toLowerCase();
      if (emailLower !== existingStaff.user.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email: emailLower },
        });

        if (emailTaken) {
          throw new AppError('Email is already registered', 409);
        }
      }
    }

    // Update in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update User fields if email or password provided
      if (validatedData.email || validatedData.password) {
        await tx.user.update({
          where: { id: existingStaff.userId },
          data: {
            ...(validatedData.email ? { email: validatedData.email.toLowerCase() } : {}),
            ...(validatedData.password
              ? { passwordHash: await hashPassword(validatedData.password) }
              : {}),
          },
        });
      }

      // Update Staff branchId if provided
      const updatedStaff = await tx.staff.update({
        where: { id: staffId },
        data: {
          ...(validatedData.branchId ? { branchId: validatedData.branchId } : {}),
        },
        include: {
          user: {
            select: { id: true, email: true, role: true, createdAt: true },
          },
          branch: {
            select: { id: true, name: true, address: true },
          },
        },
      });

      return updatedStaff;
    });

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      branchId: updated.branchId,
      branchName: updated.branch.name,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Deactivate or reactivate a staff member.
   */
  static async updateStaffStatus(
    staffId: string,
    businessId: string,
    input: unknown
  ) {
    const { isActive } = updateStaffStatusSchema.parse(input);

    const existingStaff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        businessId,
        user: { role: UserRole.STAFF },
      },
    });

    if (!existingStaff) {
      throw new AppError('Staff member not found', 404);
    }

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data: { isActive },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
        branch: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      branchId: updated.branchId,
      branchName: updated.branch.name,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }
}
