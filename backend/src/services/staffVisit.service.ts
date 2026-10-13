import crypto from 'crypto';
import { Prisma, UserRole, VisitType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { maskPhone } from '../utils/phone.utils';
import {
  deriveRedemptionTokenForReward,
  hashRedemptionToken,
  isValidRewardClaimTokenFormat,
  hashRewardClaimToken,
} from '../utils/redemptionToken';
import {
  serializeMilestonesForSnapshot,
  getEffectiveCycleMilestones,
  getEffectiveCycleLength,
} from '../utils/cycleSnapshot';

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
              snapshotCycleLength: activeProgram.cycleLength,
              snapshotMilestones: serializeMilestonesForSnapshot(activeProgram.milestones) as any,
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
          visitType: VisitType.QUALIFYING,
          visitNumberInCycle: newVisitCount,
          approvedByStaffId: operationalStaff.id,
          createdAt: new Date(),
        },
      });

      // 7. Evaluate Milestone & create Snapshot MilestoneReward
      const effectiveMilestones = getEffectiveCycleMilestones(activeCycle, activeProgram.milestones);
      const matchingMilestone = effectiveMilestones.find(
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
                snapshotRewardValue:
                  matchingMilestone.rewardValue != null
                    ? new Prisma.Decimal(matchingMilestone.rewardValue)
                    : null,
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
      const effectiveCycleLength = getEffectiveCycleLength(activeCycle, activeProgram.cycleLength);
      const isCycleCompleted = newVisitCount >= effectiveCycleLength;

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

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.milestoneReward.updateMany({
        where: {
          id: rewardId,
          status: 'UNLOCKED',
        },
        data: {
          status: 'REDEEMED',
          redeemedAt: now,
          redeemedByStaffId: operationalStaff?.id ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          'Reward has already been redeemed or is no longer unlocked',
          409
        );
      }

      // Record real physical store visit for redemption
      const redemptionVisit = await tx.visit.create({
        data: {
          loyaltyCycleId: reward.loyaltyCycleId,
          visitRequestId: null,
          branchId: reward.loyaltyCycle.program.branchId,
          visitType: VisitType.REWARD_REDEMPTION,
          visitNumberInCycle: null,
          approvedByStaffId: operationalStaff!.id,
          createdAt: now,
        },
      });

      return {
        id: rewardId,
        status: 'REDEEMED',
        redeemedAt: now,
        visitId: redemptionVisit.id,
      };
    });

    return result;
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

    // 2. Atomic conditional update: UNLOCKED -> REDEEMED + Record physical store Visit
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.milestoneReward.updateMany({
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
        const current = await tx.milestoneReward.findUnique({
          where: { redemptionTokenHash: tokenHash },
          select: { status: true, redeemedAt: true },
        });

        if (current?.status === 'REDEEMED') {
          throw new AppError('Reward has already been redeemed', 409);
        }
        throw new AppError('Reward is not available for redemption', 400);
      }

      // Record real physical store visit for redemption
      const redemptionVisit = await tx.visit.create({
        data: {
          loyaltyCycleId: reward.loyaltyCycleId,
          visitRequestId: null,
          branchId: reward.loyaltyCycle.program.branchId,
          visitType: VisitType.REWARD_REDEMPTION,
          visitNumberInCycle: null,
          approvedByStaffId: operationalStaff!.id,
          createdAt: now,
        },
      });

      return {
        id: reward.id,
        status: 'REDEEMED',
        redeemedAt: now,
        rewardName: reward.snapshotRewardName,
        rewardType: reward.snapshotRewardType,
        rewardValue: reward.snapshotRewardValue ? reward.snapshotRewardValue.toString() : null,
        visitId: redemptionVisit.id,
      };
    });

    return result;
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

  /**
   * Validate a customer-presented RewardClaim token for a "Claim Reward Visit".
   * - Token must never appear in GET URL.
   * - Hashes token using deterministic SHA-256 for lookup.
   * - Checks tenant isolation (business and branch).
   * - Validates token status: exists, not expired, not consumed.
   * - Checks active loyalty cycle exists and expectedVisitNumber matches.
   * - Checks milestone exists and has reward attached, reward not already claimed.
   * - Returns safe confirmation details (customer name/phone masked, reward name/desc, expected visit, cycle length).
   * - NEVER mutates the database.
   */
  static async validateRewardClaimToken(
    user: AuthenticatedUserContext,
    claimToken: string
  ) {
    if (!claimToken || typeof claimToken !== 'string') {
      throw new AppError('Reward claim token is required', 400);
    }

    const trimmed = claimToken.trim();
    if (!trimmed.startsWith('RC-')) {
      throw new AppError('Invalid reward claim token format', 400);
    }

    const tokenHash = hashRewardClaimToken(trimmed);

    const claim = await prisma.rewardClaim.findUnique({
      where: { tokenHash },
      include: {
        branch: {
          include: {
            business: true,
          },
        },
        program: {
          include: {
            milestones: {
              where: { isEnabled: true },
            },
          },
        },
        customerProfile: {
          include: {
            customer: true,
          },
        },
        milestone: true,
      },
    });

    if (!claim) {
      throw new AppError('Reward claim not found or invalid token', 404);
    }

    // Business authorization
    if (claim.branch.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Reward claim belongs to another business', 403);
    }

    // Branch authorization for STAFF
    if (user.role === UserRole.STAFF) {
      const staff = await this.resolveStaffRecord(user);
      if (claim.branchId !== staff?.branchId) {
        throw new AppError('Forbidden: Staff cannot process claims for other branches', 403);
      }
    }

    // Status check
    if (claim.status === 'CONSUMED') {
      throw new AppError('This reward claim has already been redeemed', 409);
    }

    if (claim.status === 'EXPIRED' || claim.expiresAt < new Date()) {
      throw new AppError('This reward claim token has expired', 410);
    }

    if (claim.status !== 'PENDING') {
      throw new AppError('Reward claim is not available for processing', 400);
    }

    // Milestone check
    if (!claim.milestone || claim.milestone.rewardType === 'NONE') {
      throw new AppError('Milestone does not have an attached reward', 400);
    }

    // Customer visit progress validation
    const activeCycle = await prisma.loyaltyCycle.findFirst({
      where: {
        customerProfileId: claim.customerProfileId,
        programId: claim.programId,
        status: 'ACTIVE',
      },
      include: {
        milestoneRewards: true,
      },
    });

    const currentVisitCount = activeCycle ? activeCycle.visitCount : 0;
    if (currentVisitCount + 1 !== claim.expectedVisitNumber) {
      throw new AppError(
        `Customer visit state has changed. Expected visit ${claim.expectedVisitNumber}, but customer is currently at visit ${currentVisitCount}.`,
        409
      );
    }

    // Reward not already claimed
    if (
      activeCycle &&
      activeCycle.milestoneRewards.some((r) => r.milestoneId === claim.milestoneId)
    ) {
      throw new AppError('Reward for this milestone has already been claimed', 409);
    }

    const customer = claim.customerProfile.customer;

    return {
      claimId: claim.id,
      customerName: customer.name || 'Valued Customer',
      customerPhone: maskPhone(customer.phone),
      expectedVisitNumber: claim.expectedVisitNumber,
      cycleLength: claim.program.cycleLength,
      rewardName: claim.milestone.rewardName || claim.milestone.rewardType.replace(/_/g, ' '),
      rewardDescription: claim.milestone.rewardDescription,
      rewardType: claim.milestone.rewardType,
      rewardValue: claim.milestone.rewardValue ? claim.milestone.rewardValue.toString() : null,
      branchName: claim.branch.name,
      businessName: claim.branch.business.name,
      expiresAt: claim.expiresAt,
    };
  }

  /**
   * Complete Reward Visit via ONE Atomic Transaction.
   * Steps:
   * 1. Create Visit: visitType = QUALIFYING, visitNumberInCycle = expectedVisitNumber.
   * 2. Increment LoyaltyCycle.visitCount.
   * 3. If this completes the cycle: mark cycle COMPLETED.
   * 4. Create MilestoneReward using existing snapshot mechanism.
   * 5. Immediately set MilestoneReward.status = REDEEMED.
   * 6. Set redeemedAt, redeemedByStaffId.
   * 7. Create another Visit: visitType = REWARD_REDEMPTION (analytics only, visitNumberInCycle = null).
   * 8. Mark RewardClaim: status = CONSUMED, consumedAt, consumedByStaffId.
   * 9. Commit. Rollback everything on failure.
   */
  static async confirmRewardClaim(
    user: AuthenticatedUserContext,
    claimToken: string
  ) {
    if (!claimToken || typeof claimToken !== 'string') {
      throw new AppError('Reward claim token is required', 400);
    }

    const trimmed = claimToken.trim();
    if (!trimmed.startsWith('RC-')) {
      throw new AppError('Invalid reward claim token format', 400);
    }

    const tokenHash = hashRewardClaimToken(trimmed);

    // Pre-transaction check of business & staff permissions
    const claimPre = await prisma.rewardClaim.findUnique({
      where: { tokenHash },
      include: {
        branch: true,
        program: true,
      },
    });

    if (!claimPre) {
      throw new AppError('Reward claim not found or invalid token', 404);
    }

    if (claimPre.branch.businessId !== user.businessId) {
      throw new AppError('Unauthorized: Claim belongs to another business', 403);
    }

    let operationalStaff = null;
    if (user.role === UserRole.STAFF) {
      operationalStaff = await this.resolveStaffRecord(user);
      if (claimPre.branchId !== operationalStaff?.branchId) {
        throw new AppError('Forbidden: Staff cannot confirm claims for other branches', 403);
      }
    } else {
      operationalStaff = await this.resolveStaffRecord(user, claimPre.branchId);
    }

    if (!operationalStaff) {
      throw new AppError('Failed to resolve operational staff context', 500);
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // Step A: Atomic conditional claim consumption (prevents race / double consumption)
      const claimUpdate = await tx.rewardClaim.updateMany({
        where: {
          id: claimPre.id,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        data: {
          status: 'CONSUMED',
          consumedAt: now,
          consumedByStaffId: operationalStaff.id,
        },
      });

      if (claimUpdate.count === 0) {
        const current = await tx.rewardClaim.findUnique({
          where: { id: claimPre.id },
          select: { status: true, expiresAt: true },
        });

        if (current?.status === 'CONSUMED') {
          throw new AppError('This reward claim has already been redeemed', 409);
        }
        if (current?.status === 'EXPIRED' || (current?.expiresAt && current.expiresAt <= now)) {
          throw new AppError('This reward claim token has expired', 410);
        }
        throw new AppError('Reward claim is not available for processing', 409);
      }

      // Step B: Resolve active LoyaltyProgram for this branch
      const activeProgram = await tx.loyaltyProgram.findFirst({
        where: {
          branchId: claimPre.branchId,
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

      // Step C: Resolve or lazily create active LoyaltyCycle
      let activeCycle = await tx.loyaltyCycle.findFirst({
        where: {
          customerProfileId: claimPre.customerProfileId,
          programId: activeProgram.id,
          status: 'ACTIVE',
        },
      });

      if (!activeCycle) {
        const lastCycle = await tx.loyaltyCycle.findFirst({
          where: {
            customerProfileId: claimPre.customerProfileId,
            programId: activeProgram.id,
          },
          orderBy: { cycleNumber: 'desc' },
        });

        const nextCycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;

        try {
          activeCycle = await tx.loyaltyCycle.create({
            data: {
              customerProfileId: claimPre.customerProfileId,
              programId: activeProgram.id,
              cycleNumber: nextCycleNumber,
              visitCount: 0,
              status: 'ACTIVE',
              snapshotCycleLength: activeProgram.cycleLength,
              snapshotMilestones: serializeMilestonesForSnapshot(activeProgram.milestones) as any,
              startedAt: now,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            activeCycle = await tx.loyaltyCycle.findFirst({
              where: {
                customerProfileId: claimPre.customerProfileId,
                programId: activeProgram.id,
                status: 'ACTIVE',
              },
            });
            if (!activeCycle) throw error;
          } else {
            throw error;
          }
        }
      }

      // Step D: Verify expected visit number & milestone
      const newVisitCount = activeCycle.visitCount + 1;
      if (newVisitCount !== claimPre.expectedVisitNumber) {
        throw new AppError(
          `Customer visit progress mismatch. Expected visit ${claimPre.expectedVisitNumber}, but customer is currently at visit ${activeCycle.visitCount}`,
          409
        );
      }

      const effectiveMilestones = getEffectiveCycleMilestones(activeCycle, activeProgram.milestones);
      const matchingMilestone = effectiveMilestones.find(
        (m) => m.id === claimPre.milestoneId && m.visitNumber === newVisitCount
      );

      if (!matchingMilestone || matchingMilestone.rewardType === 'NONE') {
        throw new AppError('Milestone not found or has no attached reward', 400);
      }

      // Step E: Verify milestone reward not already created in this cycle
      const existingReward = await tx.milestoneReward.findUnique({
        where: {
          loyaltyCycleId_milestoneId: {
            loyaltyCycleId: activeCycle.id,
            milestoneId: matchingMilestone.id,
          },
        },
      });

      if (existingReward) {
        throw new AppError('Reward has already been created for this milestone in this cycle', 409);
      }

      // 1. Create Visit: visitType = QUALIFYING, visitNumberInCycle = expectedVisitNumber
      const qualifyingVisit = await tx.visit.create({
        data: {
          loyaltyCycleId: activeCycle.id,
          visitRequestId: null,
          branchId: claimPre.branchId,
          visitType: VisitType.QUALIFYING,
          visitNumberInCycle: newVisitCount,
          approvedByStaffId: operationalStaff.id,
          createdAt: now,
        },
      });

      // 2 & 3. Increment LoyaltyCycle.visitCount. If this completes the cycle: mark COMPLETED.
      const effectiveCycleLength = getEffectiveCycleLength(activeCycle, activeProgram.cycleLength);
      const isCycleCompleted = newVisitCount >= effectiveCycleLength;
      await tx.loyaltyCycle.update({
        where: { id: activeCycle.id },
        data: {
          visitCount: newVisitCount,
          ...(isCycleCompleted ? { status: 'COMPLETED', completedAt: now } : {}),
        },
      });

      // 4, 5, 6. Create MilestoneReward with snapshot mechanism and immediately set REDEEMED
      const rewardId = crypto.randomUUID();
      const milestoneReward = await tx.milestoneReward.create({
        data: {
          id: rewardId,
          loyaltyCycleId: activeCycle.id,
          milestoneId: matchingMilestone.id,
          snapshotRewardType: matchingMilestone.rewardType,
          snapshotRewardValue:
            matchingMilestone.rewardValue != null
              ? new Prisma.Decimal(matchingMilestone.rewardValue)
              : null,
          snapshotRewardName: matchingMilestone.rewardName,
          snapshotRewardDescription: matchingMilestone.rewardDescription,
          status: 'REDEEMED',
          unlockedAt: now,
          redeemedAt: now,
          redeemedByStaffId: operationalStaff.id,
        },
      });

      // 7. Create another Visit: visitType = REWARD_REDEMPTION (analytics only, visitNumberInCycle = null)
      const redemptionVisit = await tx.visit.create({
        data: {
          loyaltyCycleId: activeCycle.id,
          visitRequestId: null,
          branchId: claimPre.branchId,
          visitType: VisitType.REWARD_REDEMPTION,
          visitNumberInCycle: null,
          approvedByStaffId: operationalStaff.id,
          createdAt: now,
        },
      });

      // Link loyaltyCycleId on RewardClaim if needed
      if (!claimPre.loyaltyCycleId) {
        await tx.rewardClaim.update({
          where: { id: claimPre.id },
          data: { loyaltyCycleId: activeCycle.id },
        });
      }

      const customerProfile = await tx.customerProfile.findUnique({
        where: { id: claimPre.customerProfileId },
        include: { customer: true },
      });

      return {
        qualifyingVisitId: qualifyingVisit.id,
        redemptionVisitId: redemptionVisit.id,
        visitNumberInCycle: newVisitCount,
        cycleNumber: activeCycle.cycleNumber,
        cycleCompleted: isCycleCompleted,
        reward: {
          id: milestoneReward.id,
          rewardName: milestoneReward.snapshotRewardName,
          rewardType: milestoneReward.snapshotRewardType,
          rewardValue: milestoneReward.snapshotRewardValue ? milestoneReward.snapshotRewardValue.toString() : null,
          status: milestoneReward.status,
          redeemedAt: milestoneReward.redeemedAt,
        },
        customer: {
          id: customerProfile?.customer.id,
          name: customerProfile?.customer.name,
        },
      };
    });
  }
}
