import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import { deriveRedemptionTokenForReward } from '../utils/redemptionToken';

export class CustomerLoyaltyService {
  /**
   * Idempotently resolves or creates a CustomerProfile for customer + business.
   * CustomerProfile represents the customer's relationship with the business.
   */
  static async resolveCustomerProfile(customerId: string, businessId: string) {
    return prisma.customerProfile.upsert({
      where: {
        customerId_businessId: { customerId, businessId },
      },
      update: {},
      create: {
        customerId,
        businessId,
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Read-only view of customer loyalty status for a branch identified by qrToken.
   * Strictly read-only for loyalty state: does NOT create or modify LoyaltyCycle,
   * VisitRequest, Visit, or MilestoneReward.
   * Idempotently ensures CustomerProfile exists.
   */
  static async getLoyaltyStatus(customerId: string, qrToken: string) {
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

    // Idempotently ensure CustomerProfile exists for this customer and business
    const customerProfile = await this.resolveCustomerProfile(customerId, branch.businessId);

    // Read active LoyaltyCycle (if any exists)
    const activeCycle = await prisma.loyaltyCycle.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        programId: activeProgram.id,
        status: 'ACTIVE',
      },
      include: {
        milestoneRewards: {
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    // Read latest completed LoyaltyCycle (to handle rollover when active cycle completed)
    const latestCompletedCycle = await prisma.loyaltyCycle.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        programId: activeProgram.id,
        status: 'COMPLETED',
      },
      orderBy: { cycleNumber: 'desc' },
    });

    // Check for any PENDING VisitRequest for this branch
    const pendingRequest = await prisma.visitRequest.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        branchId: branch.id,
        status: 'PENDING',
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Fetch ALL milestone rewards earned by this customer for this program across ALL cycles (active and completed)
    const allMilestoneRewards = await prisma.milestoneReward.findMany({
      where: {
        loyaltyCycle: {
          customerProfileId: customerProfile.id,
          programId: activeProgram.id,
        },
      },
      include: {
        loyaltyCycle: {
          select: {
            id: true,
            cycleNumber: true,
            status: true,
          },
        },
      },
      orderBy: { unlockedAt: 'desc' },
    });

    const earnedRewards = allMilestoneRewards.map((r) => {
      let redemptionToken: string | null = null;
      if (r.status === 'UNLOCKED') {
        redemptionToken = deriveRedemptionTokenForReward(r.id);
      }

      return {
        id: r.id,
        milestoneId: r.milestoneId,
        rewardType: r.snapshotRewardType,
        rewardName: r.snapshotRewardName,
        rewardDescription: r.snapshotRewardDescription,
        rewardValue: r.snapshotRewardValue ? r.snapshotRewardValue.toString() : null,
        status: r.status,
        unlockedAt: r.unlockedAt,
        redeemedAt: r.redeemedAt,
        cycleNumber: r.loyaltyCycle.cycleNumber,
        isCurrentCycle: activeCycle ? r.loyaltyCycle.id === activeCycle.id : false,
        redemptionToken,
      };
    });

    const unlockedRewards = earnedRewards.filter((r) => r.status === 'UNLOCKED');
    const redeemedRewards = earnedRewards.filter((r) => r.status === 'REDEEMED');

    // Compute status of current cycle milestones (for current active cycle progress)
    const currentVisitCount = activeCycle ? activeCycle.visitCount : 0;
    const activeCycleRewardsMap = new Map<string, any>();
    if (activeCycle) {
      for (const reward of activeCycle.milestoneRewards) {
        activeCycleRewardsMap.set(reward.milestoneId, reward);
      }
    }

    const milestonesWithStatus = activeProgram.milestones.map((m) => {
      const rewardRecord = activeCycleRewardsMap.get(m.id);
      let status: 'LOCKED' | 'UNLOCKED' | 'REDEEMED' = 'LOCKED';

      if (rewardRecord) {
        status = rewardRecord.status;
      } else if (currentVisitCount >= m.visitNumber) {
        status = 'UNLOCKED';
      }

      return {
        id: m.id,
        visitNumber: m.visitNumber,
        rewardType: m.rewardType,
        rewardName: m.rewardName,
        rewardDescription: m.rewardDescription,
        rewardValue: m.rewardValue ? m.rewardValue.toString() : null,
        status,
      };
    });

    // Compute cycle status for display (handles lazy rollover 0/N display)
    const cycleDisplay = activeCycle
      ? {
          hasStarted: true,
          id: activeCycle.id,
          cycleNumber: activeCycle.cycleNumber,
          visitCount: activeCycle.visitCount,
          cycleLength: activeProgram.cycleLength,
          status: activeCycle.status,
          startedAt: activeCycle.startedAt,
        }
      : latestCompletedCycle
      ? {
          hasStarted: true,
          id: null,
          cycleNumber: latestCompletedCycle.cycleNumber + 1,
          visitCount: 0,
          cycleLength: activeProgram.cycleLength,
          status: 'ACTIVE',
          startedAt: null,
        }
      : {
          hasStarted: false,
          id: null,
          cycleNumber: 1,
          visitCount: 0,
          cycleLength: activeProgram.cycleLength,
          status: null,
          startedAt: null,
        };

    return {
      customer: {
        id: customerProfile.customer.id,
        name: customerProfile.customer.name,
        phone: customerProfile.customer.phone,
      },
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
      },
      cycle: cycleDisplay,
      milestones: milestonesWithStatus,
      rewards: earnedRewards,
      unlockedRewards,
      redeemedRewards,
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            status: pendingRequest.status,
            requestedAt: pendingRequest.requestedAt,
          }
        : null,
    };
  }

  /**
   * Customer creates a VisitRequest for a branch identified by qrToken.
   * Enforces: At most ONE pending request per (customerProfileId, branchId).
   */
  static async createVisitRequest(customerId: string, qrToken: string) {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('QR token is required', 400);
    }

    const branch = await prisma.branch.findUnique({
      where: { qrToken: qrToken.trim() },
      include: {
        loyaltyPrograms: {
          where: { isActive: true },
        },
      },
    });

    if (!branch) {
      throw new AppError('Invalid or expired QR code', 404);
    }

    if (!branch.isActive) {
      throw new AppError('This branch location is currently inactive', 400);
    }

    if (!branch.loyaltyPrograms || branch.loyaltyPrograms.length === 0) {
      throw new AppError('No active loyalty program is configured for this branch', 422);
    }

    // Resolve or create CustomerProfile for this customer & business
    const customerProfile = await this.resolveCustomerProfile(customerId, branch.businessId);

    // Enforce branch-scoped pending request restriction
    const existingPending = await prisma.visitRequest.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        branchId: branch.id,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new AppError(
        'You already have a pending visit stamp request for this branch. Please wait for staff approval.',
        409
      );
    }

    const visitRequest = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfile.id,
        branchId: branch.id,
        status: 'PENDING',
        requestedAt: new Date(),
      },
    });

    return {
      id: visitRequest.id,
      status: visitRequest.status,
      requestedAt: visitRequest.requestedAt,
    };
  }

  /**
   * Retrieve customer's loyalty history across businesses / programs.
   */
  static async getCustomerHistory(customerId: string) {
    const profiles = await prisma.customerProfile.findMany({
      where: { customerId },
      include: {
        business: true,
        loyaltyCycles: {
          orderBy: { startedAt: 'desc' },
          include: {
            program: true,
            visits: {
              orderBy: { createdAt: 'desc' },
              include: { branch: true },
            },
            milestoneRewards: {
              orderBy: { unlockedAt: 'desc' },
            },
          },
        },
      },
    });

    const history = profiles.map((p) => ({
      business: {
        id: p.business.id,
        name: p.business.name,
      },
      cycles: p.loyaltyCycles.map((c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        status: c.status,
        visitCount: c.visitCount,
        cycleLength: c.program.cycleLength,
        programName: c.program.name,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        visits: c.visits.map((v) => ({
          id: v.id,
          visitNumberInCycle: v.visitNumberInCycle,
          branchName: v.branch.name,
          createdAt: v.createdAt,
        })),
        rewards: c.milestoneRewards.map((r) => ({
          id: r.id,
          rewardType: r.snapshotRewardType,
          rewardName: r.snapshotRewardName,
          rewardValue: r.snapshotRewardValue ? r.snapshotRewardValue.toString() : null,
          status: r.status,
          unlockedAt: r.unlockedAt,
          redeemedAt: r.redeemedAt,
        })),
      })),
    }));

    return history;
  }
}
