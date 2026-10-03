import crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { maskPhone } from '../utils/phone.utils';
import {
  deriveRedemptionTokenForReward,
  hashRedemptionToken,
} from '../utils/redemptionToken';

export interface AuthenticatedUserContext {
  userId: string;
  role: UserRole;
  businessId: string;
}

export class StaffVisitService {
  /**
   * Helper to resolve the operational staff record for the current user.
   * If the user is STAFF, verifies they are active and returns their staff record.
   * If the user is OWNER, finds or creates an owner operational staff record for that branch.
   */
  private static async resolveStaffRecord(
    user: AuthenticatedUserContext,
    branchId?: string
  ) {
    if (user.role === UserRole.STAFF) {
      const staff = await prisma.staff.findFirst({
        where: {
          userId: user.userId,
          businessId: user.businessId,
        },
      });

      if (!staff || !staff.isActive) {
        throw new AppError('Staff account is inactive or not found', 403);
      }

      return staff;
    }

    // Role is OWNER
    if (branchId) {
      // Find or create an owner Staff record for this branch to satisfy FK
      let ownerStaff = await prisma.staff.findFirst({
        where: {
          userId: user.userId,
          branchId,
          businessId: user.businessId,
        },
      });

      if (!ownerStaff) {
        ownerStaff = await prisma.staff.create({
          data: {
            userId: user.userId,
            branchId,
            businessId: user.businessId,
            isActive: true,
          },
        });
      }

      return ownerStaff;
    }

    return null;
  }

  /**
   * List pending visit requests for a branch.
   * For STAFF: branchId is derived strictly from the Staff record (never client input).
   * For OWNER: can view pending requests for their own business, with optional branchId filter.
   */
  static async getPendingRequests(
    user: AuthenticatedUserContext,
    filterBranchId?: string
  ) {
    let targetBranchId: string | undefined;

    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (!staff) {
        throw new AppError('Unauthorized staff context', 403);
      }
      targetBranchId = staff.branchId;
    } else if (user.role === UserRole.OWNER) {
      if (filterBranchId) {
        // Verify branch belongs to the owner's business
        const branch = await prisma.branch.findFirst({
          where: { id: filterBranchId, businessId: user.businessId },
        });
        if (!branch) {
          throw new AppError('Branch not found or unauthorized', 404);
        }
        targetBranchId = branch.id;
      }
    }

    const pendingRequests = await prisma.visitRequest.findMany({
      where: {
        status: 'PENDING',
        ...(targetBranchId
          ? { branchId: targetBranchId }
          : { branch: { businessId: user.businessId } }),
      },
      orderBy: { requestedAt: 'asc' },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        customerProfile: {
          include: {
            customer: true,
            loyaltyCycles: {
              where: { status: 'ACTIVE' },
              select: { visitCount: true },
            },
          },
        },
      },
    });

    return pendingRequests.map((req) => {
      const customer = req.customerProfile.customer;
      const activeCycle = req.customerProfile.loyaltyCycles[0];
      return {
        id: req.id,
        status: req.status,
        requestedAt: req.requestedAt,
        branch: req.branch,
        customer: {
          id: customer.id,
          name: customer.name,
          maskedPhone: maskPhone(customer.phone),
        },
        currentCycleVisitCount: activeCycle ? activeCycle.visitCount : 0,
      };
    });
  }

  /**
   * Atomic Approval Transaction.
   * - Atomically claims PENDING request (prevents double approval).
   * - Resolves active LoyaltyProgram.
   * - Lazily creates or increments active LoyaltyCycle (gracefully handling creation races).
   * - Creates Visit record.
   * - Evaluates Milestone & creates MilestoneReward snapshot if applicable.
   * - Completes cycle if visitCount reaches cycleLength (lazy rollover: does not create empty cycle).
   */
  static async approveVisitRequest(
    user: AuthenticatedUserContext,
    requestId: string
  ) {
    if (!requestId || typeof requestId !== 'string') {
      throw new AppError('Invalid request ID', 400);
    }

    // Verify staff permissions prior to transaction
    let staffBranchId: string | undefined;
    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (!staff) {
        throw new AppError('Unauthorized staff context', 403);
      }
      staffBranchId = staff.branchId;
    }

    return prisma.$transaction(async (tx) => {
      // 1. Fetch the request first to know which branch it belongs to and verify business ownership
      const requestToApprove = await tx.visitRequest.findUnique({
        where: { id: requestId },
        include: { branch: true },
      });

      if (!requestToApprove) {
        throw new AppError('Visit request not found', 404);
      }

      if (requestToApprove.branch.businessId !== user.businessId) {
        throw new AppError('Unauthorized: Request belongs to another business', 403);
      }

      if (user.role === UserRole.STAFF && requestToApprove.branchId !== staffBranchId) {
        throw new AppError('Forbidden: Staff cannot approve requests for other branches', 403);
      }

      // Resolve operational staff record to attribute the approval
      const operationalStaff = await this.resolveStaffRecord(user, requestToApprove.branchId);
      if (!operationalStaff) {
        throw new AppError('Failed to resolve operational staff context', 500);
      }

      // 2. ATOMIC CLAIM: conditionally update request status from PENDING to APPROVED
      const claimResult = await tx.visitRequest.updateMany({
        where: {
          id: requestId,
          status: 'PENDING',
          branchId: requestToApprove.branchId,
        },
        data: {
          status: 'APPROVED',
          resolvedAt: new Date(),
          resolvedByStaffId: operationalStaff.id,
        },
      });

      if (claimResult.count === 0) {
        throw new AppError(
          'Visit request has already been resolved or is not pending',
          409
        );
      }

      // 3. Resolve active LoyaltyProgram for this branch
      const activeProgram = await tx.loyaltyProgram.findFirst({
        where: {
          branchId: requestToApprove.branchId,
          isActive: true,
        },
        include: {
          milestones: {
            where: { isEnabled: true },
          },
        },
      });

      if (!activeProgram) {
        throw new AppError('No active loyalty program found for this branch', 422);
      }

      // 4. Resolve or lazily create active LoyaltyCycle
      let activeCycle = await tx.loyaltyCycle.findFirst({
        where: {
          customerProfileId: requestToApprove.customerProfileId,
          programId: activeProgram.id,
          status: 'ACTIVE',
        },
      });

      if (!activeCycle) {
        // Find highest previous cycle number
        const lastCycle = await tx.loyaltyCycle.findFirst({
          where: {
            customerProfileId: requestToApprove.customerProfileId,
            programId: activeProgram.id,
          },
          orderBy: { cycleNumber: 'desc' },
        });

        const nextCycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;

        try {
          activeCycle = await tx.loyaltyCycle.create({
            data: {
              customerProfileId: requestToApprove.customerProfileId,
              programId: activeProgram.id,
              cycleNumber: nextCycleNumber,
              visitCount: 0,
              status: 'ACTIVE',
              startedAt: new Date(),
            },
          });
        } catch (error) {
          // Handle concurrent active cycle creation race gracefully (P2002 partial index violation)
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            activeCycle = await tx.loyaltyCycle.findFirst({
              where: {
                customerProfileId: requestToApprove.customerProfileId,
                programId: activeProgram.id,
                status: 'ACTIVE',
              },
            });

            if (!activeCycle) {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // 5. Calculate new visit count
      const newVisitCount = activeCycle.visitCount + 1;

      // 6. Record the confirmed Visit
      const visit = await tx.visit.create({
        data: {
          loyaltyCycleId: activeCycle.id,
          visitRequestId: requestToApprove.id,
          branchId: requestToApprove.branchId,
          visitNumberInCycle: newVisitCount,
          approvedByStaffId: operationalStaff.id,
          createdAt: new Date(),
        },
      });

      // 7. Evaluate Milestone & create Snapshot MilestoneReward
      const matchingMilestone = activeProgram.milestones.find(
        (m) => m.visitNumber === newVisitCount
      );

      let newRewardUnlocked: any = null;

      if (matchingMilestone && matchingMilestone.rewardType !== 'NONE') {
        const rewardId = crypto.randomUUID();
        let reward: any = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const rawToken = deriveRedemptionTokenForReward(rewardId, attempt);
            const tokenHash = hashRedemptionToken(rawToken);

            reward = await tx.milestoneReward.create({
              data: {
                id: rewardId,
                loyaltyCycleId: activeCycle.id,
                milestoneId: matchingMilestone.id,
                snapshotRewardType: matchingMilestone.rewardType,
                snapshotRewardValue: matchingMilestone.rewardValue,
                snapshotRewardName: matchingMilestone.rewardName,
                snapshotRewardDescription: matchingMilestone.rewardDescription,
                status: 'UNLOCKED',
                unlockedAt: new Date(),
                redemptionTokenHash: tokenHash,
                redemptionTokenCreatedAt: new Date(),
              },
            });
            break;
          } catch (err: any) {
            if (err.code === 'P2002' && attempt < 4) {
              continue;
            }
            throw err;
          }
        }

        newRewardUnlocked = {
          id: reward.id,
          rewardType: reward.snapshotRewardType,
          rewardName: reward.snapshotRewardName,
          rewardValue: reward.snapshotRewardValue ? reward.snapshotRewardValue.toString() : null,
          rewardDescription: reward.snapshotRewardDescription,
        };
      }

      // 8. Cycle Completion check (Lazy rollover: do NOT create next cycle immediately)
      const isCycleCompleted = newVisitCount >= activeProgram.cycleLength;

      if (isCycleCompleted) {
        await tx.loyaltyCycle.update({
          where: { id: activeCycle.id },
          data: {
            visitCount: newVisitCount,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      } else {
        await tx.loyaltyCycle.update({
          where: { id: activeCycle.id },
          data: {
            visitCount: newVisitCount,
          },
        });
      }

      return {
        visitId: visit.id,
        visitNumberInCycle: newVisitCount,
        cycleNumber: activeCycle.cycleNumber,
        cycleCompleted: isCycleCompleted,
        newRewardUnlocked,
      };
    });
  }

  /**
   * Reject a VisitRequest.
   * Atomically sets status to REJECTED.
   * Does NOT create Visit, does NOT touch LoyaltyCycle or MilestoneReward.
   */
  static async rejectVisitRequest(
    user: AuthenticatedUserContext,
    requestId: string
  ) {
    if (!requestId || typeof requestId !== 'string') {
      throw new AppError('Invalid request ID', 400);
    }

    const requestToReject = await prisma.visitRequest.findUnique({
      where: { id: requestId },
      include: { branch: true },
    });

    if (!requestToReject) {
      throw new AppError('Visit request not found', 404);
    }

    if (requestToReject.branch.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Request belongs to another business', 403);
    }

    let operationalStaff = null;
    if (user.role === UserRole.STAFF) {
      operationalStaff = await this.resolveStaffRecord(user);
      if (requestToReject.branchId !== operationalStaff?.branchId) {
        throw new AppError('Forbidden: Staff cannot reject requests for other branches', 403);
      }
    } else {
      operationalStaff = await this.resolveStaffRecord(user, requestToReject.branchId);
    }

    const claimResult = await prisma.visitRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
        branchId: requestToReject.branchId,
      },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        resolvedByStaffId: operationalStaff?.id ?? null,
      },
    });

    if (claimResult.count === 0) {
      throw new AppError(
        'Visit request has already been resolved or is not pending',
        409
      );
    }

    return {
      id: requestId,
      status: 'REJECTED',
    };
  }

  /**
   * Mark an unlocked MilestoneReward as REDEEMED.
   * Enforces: Reward must belong to staff/owner business, status must be UNLOCKED.
   * Already REDEEMED rewards throw 409 Conflict.
   */
  static async redeemReward(
    user: AuthenticatedUserContext,
    rewardId: string
  ) {
    if (!rewardId || typeof rewardId !== 'string') {
      throw new AppError('Invalid reward ID', 400);
    }

    const reward = await prisma.milestoneReward.findUnique({
      where: { id: rewardId },
      include: {
        loyaltyCycle: {
          include: {
            program: true,
          },
        },
      },
    });

    if (!reward) {
      throw new AppError('Reward not found', 404);
    }

    if (reward.loyaltyCycle.program.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Reward belongs to another business', 403);
    }

    let operationalStaff = null;
    if (user.role === UserRole.STAFF) {
      operationalStaff = await this.resolveStaffRecord(user);
      if (reward.loyaltyCycle.program.branchId !== operationalStaff?.branchId) {
        throw new AppError('Forbidden: Staff cannot redeem rewards for other branches', 403);
      }
    } else {
      operationalStaff = await this.resolveStaffRecord(user, reward.loyaltyCycle.program.branchId);
    }

    const updateResult = await prisma.milestoneReward.updateMany({
      where: {
        id: rewardId,
        status: 'UNLOCKED',
      },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedByStaffId: operationalStaff?.id ?? null,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        'Reward has already been redeemed or is no longer unlocked',
        409
      );
    }

    return {
      id: rewardId,
      status: 'REDEEMED',
      redeemedAt: new Date(),
    };
  }

  /**
   * Validate a customer-presented reward redemption token.
   * - Token must never appear in GET URL.
   * - Hashes token using deterministic SHA-256 for O(1) lookup.
   * - Checks tenant isolation (business and branch).
   * - Returns safe confirmation details (customer name/phone masked, reward name/desc).
   * - NEVER redeems the reward.
   */
  static async validateRewardToken(
    user: AuthenticatedUserContext,
    rewardToken: string
  ) {
    if (!rewardToken || typeof rewardToken !== 'string') {
      throw new AppError('Reward token is required', 400);
    }

    const trimmed = rewardToken.trim();
    if (!trimmed.startsWith('RP-')) {
      throw new AppError('Invalid reward token format', 400);
    }

    const tokenHash = hashRedemptionToken(trimmed);

    const reward = await prisma.milestoneReward.findUnique({
      where: { redemptionTokenHash: tokenHash },
      include: {
        loyaltyCycle: {
          include: {
            program: true,
            customerProfile: {
              include: {
                customer: true,
              },
            },
          },
        },
      },
    });

    if (!reward) {
      throw new AppError('Reward not found or invalid token', 404);
    }

    // Business authorization
    if (reward.loyaltyCycle.program.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Reward belongs to another business', 403);
    }

    // Branch authorization for STAFF
    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (reward.loyaltyCycle.program.branchId !== staff?.branchId) {
        throw new AppError('Forbidden: Staff cannot validate rewards for other branches', 403);
      }
    }

    // Check status
    if (reward.status === 'REDEEMED') {
      throw new AppError('This reward has already been redeemed', 409);
    }

    if (reward.status !== 'UNLOCKED') {
      throw new AppError('Reward is not available for redemption', 400);
    }

    const customer = reward.loyaltyCycle.customerProfile.customer;

    return {
      rewardId: reward.id,
      rewardName: reward.snapshotRewardName,
      rewardDescription: reward.snapshotRewardDescription,
      rewardType: reward.snapshotRewardType,
      rewardValue: reward.snapshotRewardValue ? reward.snapshotRewardValue.toString() : null,
      customerName: customer.name || 'Valued Customer',
      customerPhone: maskPhone(customer.phone),
      unlockedAt: reward.unlockedAt,
      status: reward.status,
    };
  }

  /**
   * Redeem a customer-presented reward using its opaque redemption token.
   * - Atomically updates UNLOCKED -> REDEEMED.
   * - Concurrency safe: only one request can succeed.
   * - Reuses resolveStaffRecord() to associate operational Staff ID (including for OWNER).
   * - Enforces branch/business isolation.
   */
  static async redeemRewardByToken(
    user: AuthenticatedUserContext,
    rewardToken: string
  ) {
    if (!rewardToken || typeof rewardToken !== 'string') {
      throw new AppError('Reward token is required', 400);
    }

    const trimmed = rewardToken.trim();
    if (!trimmed.startsWith('RP-')) {
      throw new AppError('Invalid reward token format', 400);
    }

    const tokenHash = hashRedemptionToken(trimmed);

    // 1. Fetch reward to verify business and branch authorization
    const reward = await prisma.milestoneReward.findUnique({
      where: { redemptionTokenHash: tokenHash },
      include: {
        loyaltyCycle: {
          include: {
            program: true,
          },
        },
      },
    });

    if (!reward) {
      throw new AppError('Reward not found or invalid token', 404);
    }

    // Business authorization
    if (reward.loyaltyCycle.program.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Reward belongs to another business', 403);
    }

    // Resolve operational staff record for redemption attribution
    let operationalStaff = null;
    if (user.role === UserRole.STAFF) {
      operationalStaff = await this.resolveStaffRecord(user);
      if (reward.loyaltyCycle.program.branchId !== operationalStaff?.branchId) {
        throw new AppError('Forbidden: Staff cannot redeem rewards for other branches', 403);
      }
    } else {
      // OWNER redemption: resolve operational Staff record on target branch
      operationalStaff = await this.resolveStaffRecord(user, reward.loyaltyCycle.program.branchId);
    }

    // 2. Atomic conditional update: UNLOCKED -> REDEEMED
    const now = new Date();
    const updateResult = await prisma.milestoneReward.updateMany({
      where: {
        redemptionTokenHash: tokenHash,
        status: 'UNLOCKED',
      },
      data: {
        status: 'REDEEMED',
        redeemedAt: now,
        redeemedByStaffId: operationalStaff?.id ?? null,
      },
    });

    if (updateResult.count === 0) {
      // Check current status to return accurate status code
      const current = await prisma.milestoneReward.findUnique({
        where: { redemptionTokenHash: tokenHash },
        select: { status: true, redeemedAt: true },
      });

      if (current?.status === 'REDEEMED') {
        throw new AppError('Reward has already been redeemed', 409);
      }
      throw new AppError('Reward is not available for redemption', 400);
    }

    return {
      id: reward.id,
      status: 'REDEEMED',
      redeemedAt: now,
      rewardName: reward.snapshotRewardName,
      rewardType: reward.snapshotRewardType,
      rewardValue: reward.snapshotRewardValue ? reward.snapshotRewardValue.toString() : null,
    };
  }

  /**
   * Fetch all active UNLOCKED customer rewards ready for redemption.
   * For STAFF: strictly scoped to assigned branchId.
   * For OWNER: scoped to businessId, with optional branchId filter.
   * Supports optional search query for customer name or phone.
   */
  static async getUnlockedRewards(
    user: AuthenticatedUserContext,
    filterBranchId?: string,
    search?: string
  ) {
    let targetBranchId: string | undefined;

    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (!staff) {
        throw new AppError('Unauthorized staff context', 403);
      }
      targetBranchId = staff.branchId;
    } else if (user.role === UserRole.OWNER) {
      if (filterBranchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: filterBranchId, businessId: user.businessId },
        });
        if (!branch) {
          throw new AppError('Branch not found or unauthorized', 404);
        }
        targetBranchId = branch.id;
      }
    }

    const trimmedSearch = search?.trim();

    const rewards = await prisma.milestoneReward.findMany({
      where: {
        status: 'UNLOCKED',
        loyaltyCycle: {
          program: {
            businessId: user.businessId,
            ...(targetBranchId ? { branchId: targetBranchId } : {}),
          },
          ...(trimmedSearch
            ? {
                customerProfile: {
                  customer: {
                    OR: [
                      { name: { contains: trimmedSearch, mode: 'insensitive' } },
                      { phone: { contains: trimmedSearch } },
                    ],
                  },
                },
              }
            : {}),
        },
      },
      include: {
        loyaltyCycle: {
          include: {
            program: {
              include: { branch: true },
            },
            customerProfile: {
              include: { customer: true },
            },
          },
        },
      },
      orderBy: { unlockedAt: 'desc' },
    });

    return rewards.map((r) => {
      const customer = r.loyaltyCycle.customerProfile.customer;
      const branch = r.loyaltyCycle.program.branch;
      return {
        id: r.id,
        rewardType: r.snapshotRewardType,
        rewardName: r.snapshotRewardName,
        rewardDescription: r.snapshotRewardDescription,
        rewardValue: r.snapshotRewardValue ? r.snapshotRewardValue.toString() : null,
        unlockedAt: r.unlockedAt,
        cycleNumber: r.loyaltyCycle.cycleNumber,
        branch: {
          id: branch.id,
          name: branch.name,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          maskedPhone: maskPhone(customer.phone),
        },
      };
    });
  }

  /**
   * Unified staff dashboard data:
   * - Pending visit stamp requests
   * - Active unlocked customer rewards (with optional search)
   * - Dashboard stats (pendingRequests count, activeRewards count)
   *
   * Scoping:
   * - STAFF: restricted strictly to assigned branchId. Rejects mismatched branchId with 403.
   * - OWNER: scoped to entire business, or optionally filtered by branchId.
   */
  static async getDashboard(
    user: AuthenticatedUserContext,
    filterBranchId?: string,
    search?: string
  ) {
    let targetBranchId: string | undefined;

    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (!staff) {
        throw new AppError('Unauthorized staff context', 403);
      }
      if (filterBranchId && filterBranchId !== staff.branchId) {
        throw new AppError('Unauthorized: Staff cannot access other branches', 403);
      }
      targetBranchId = staff.branchId;
    } else if (user.role === UserRole.OWNER) {
      if (filterBranchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: filterBranchId, businessId: user.businessId },
        });
        if (!branch) {
          throw new AppError('Branch not found or unauthorized', 404);
        }
        targetBranchId = branch.id;
      }
    }

    const [pendingRequests, availableRewards] = await Promise.all([
      this.getPendingRequests(user, targetBranchId),
      this.getUnlockedRewards(user, targetBranchId, search),
    ]);

    return {
      pendingRequests,
      availableRewards,
      stats: {
        pendingRequests: pendingRequests.length,
        activeRewards: availableRewards.length,
      },
    };
  }
}
