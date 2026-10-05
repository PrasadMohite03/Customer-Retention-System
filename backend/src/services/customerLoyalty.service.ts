import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';
import {
  deriveRedemptionTokenForReward,
  generateRewardClaimToken,
  hashRewardClaimToken,
} from '../utils/redemptionToken';

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
          orderBy: { createdAt: 'desc' },
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
      include: {
        milestoneRewards: {
          orderBy: { unlockedAt: 'desc' },
        },
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

    // Determine effective cycle for current loyalty display:
    // 1. If an ACTIVE cycle exists, it is the effective cycle.
    // 2. If no ACTIVE cycle exists, check if the latest completed cycle has any UNLOCKED reward.
    //    If so, the customer has unlocked a reward in that completed cycle,
    //    so the effective cycle remains the completed cycle (showing full visits and the UNLOCKED reward).
    // 3. Otherwise, if the latest completed cycle exists and its rewards are redeemed,
    //    the previous cycle is completed and customer is ready for next cycle (0 visits towards Cycle N+1).
    const hasUnlockedRewardInCompletedCycle =
      !activeCycle &&
      Boolean(latestCompletedCycle?.milestoneRewards.some((r) => r.status === 'UNLOCKED'));

    const effectiveCycle = activeCycle || (hasUnlockedRewardInCompletedCycle ? latestCompletedCycle : null);
    const effectiveCycleId = effectiveCycle?.id || null;

    const currentVisitCount = effectiveCycle ? effectiveCycle.visitCount : 0;
    const cycleRewardsMap = new Map<string, any>();
    if (effectiveCycle) {
      for (const reward of effectiveCycle.milestoneRewards) {
        cycleRewardsMap.set(reward.milestoneId, reward);
      }
    }

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
        isCurrentCycle: effectiveCycleId ? r.loyaltyCycle.id === effectiveCycleId : false,
        redemptionToken,
      };
    });

    const unlockedRewards = earnedRewards.filter((r) => r.status === 'UNLOCKED');
    const redeemedRewards = earnedRewards.filter((r) => r.status === 'REDEEMED');

    const milestonesWithStatus = activeProgram.milestones.map((m) => {
      const rewardRecord = cycleRewardsMap.get(m.id);
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
          completedAt: null,
          isCycleCompleted: false,
        }
      : hasUnlockedRewardInCompletedCycle && latestCompletedCycle
      ? {
          hasStarted: true,
          id: latestCompletedCycle.id,
          cycleNumber: latestCompletedCycle.cycleNumber,
          visitCount: latestCompletedCycle.visitCount,
          cycleLength: activeProgram.cycleLength,
          status: 'COMPLETED',
          startedAt: latestCompletedCycle.startedAt,
          completedAt: latestCompletedCycle.completedAt,
          isCycleCompleted: true,
        }
      : latestCompletedCycle
      ? {
          hasStarted: true,
          id: null,
          cycleNumber: latestCompletedCycle.cycleNumber + 1,
          visitCount: 0,
          cycleLength: activeProgram.cycleLength,
          status: 'COMPLETED',
          startedAt: null,
          completedAt: latestCompletedCycle.completedAt,
          isCycleCompleted: true,
          previousCycleNumber: latestCompletedCycle.cycleNumber,
        }
      : {
          hasStarted: false,
          id: null,
          cycleNumber: 1,
          visitCount: 0,
          cycleLength: activeProgram.cycleLength,
          status: null,
          startedAt: null,
          completedAt: null,
          isCycleCompleted: false,
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
   * Customer initiates a Reward Claim Visit for the next qualifying visit that has an attached reward.
   * Does NOT create a VisitRequest.
   * Generates a short-lived single-use opaque token, hashes it for storage, and returns raw token to customer.
   */
  static async createRewardClaim(customerId: string, qrToken: string) {
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

    // Resolve or create CustomerProfile for this customer & business
    const customerProfile = await this.resolveCustomerProfile(customerId, branch.businessId);

    // Read active LoyaltyCycle
    const activeCycle = await prisma.loyaltyCycle.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        programId: activeProgram.id,
        status: 'ACTIVE',
      },
      include: {
        milestoneRewards: true,
      },
    });

    const currentVisitCount = activeCycle ? activeCycle.visitCount : 0;
    const expectedVisitNumber = currentVisitCount + 1;

    // Check if expectedVisitNumber matches a configured reward milestone
    const milestone = activeProgram.milestones.find((m) => m.visitNumber === expectedVisitNumber);
    if (!milestone || milestone.rewardType === 'NONE') {
      throw new AppError('The next qualifying visit does not have an attached reward milestone', 400);
    }

    // Check if reward for this milestone in this cycle already exists
    if (activeCycle && activeCycle.milestoneRewards.some((r) => r.milestoneId === milestone.id)) {
      throw new AppError('Reward for this milestone has already been claimed', 409);
    }

    // Expire any existing pending claims for this customerProfile and branch
    await prisma.rewardClaim.updateMany({
      where: {
        customerProfileId: customerProfile.id,
        branchId: branch.id,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const rawToken = generateRewardClaimToken();
    const tokenHash = hashRewardClaimToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const claim = await prisma.rewardClaim.create({
      data: {
        customerProfileId: customerProfile.id,
        loyaltyCycleId: activeCycle ? activeCycle.id : null,
        programId: activeProgram.id,
        branchId: branch.id,
        milestoneId: milestone.id,
        expectedVisitNumber,
        tokenHash,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      claimId: claim.id,
      claimToken: rawToken,
      expiresAt: claim.expiresAt,
      expectedVisitNumber,
      cycleLength: activeProgram.cycleLength,
      reward: {
        id: milestone.id,
        name: milestone.rewardName || milestone.rewardType.replace(/_/g, ' '),
        description: milestone.rewardDescription,
        type: milestone.rewardType,
        value: milestone.rewardValue ? milestone.rewardValue.toString() : null,
      },
      business: {
        name: branch.business.name,
      },
      branch: {
        name: branch.name,
      },
    };
  }

  /**
   * Retrieve customer's loyalty history across businesses / programs.
   */
  static async getCustomerHistory(customerId: string) {
    const profiles = await prisma.customerProfile.findMany({
      where: { customerId },
      include: {
        business: {
          include: {
            branches: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                address: true,
                qrToken: true,
                loyaltyPrograms: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: {
                    milestones: {
                      where: { isEnabled: true },
                      orderBy: { visitNumber: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        loyaltyCycles: {
          orderBy: { startedAt: 'desc' },
          include: {
            program: {
              include: {
                milestones: {
                  where: { isEnabled: true },
                  orderBy: { visitNumber: 'asc' },
                },
              },
            },
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
        type: (p.business as any).type || null,
        branches: p.business.branches.map((br) => ({
          id: br.id,
          name: br.name,
          address: br.address,
          qrToken: br.qrToken,
          program: br.loyaltyPrograms[0]
            ? {
                id: br.loyaltyPrograms[0].id,
                name: br.loyaltyPrograms[0].name,
                cycleLength: br.loyaltyPrograms[0].cycleLength,
                milestones: br.loyaltyPrograms[0].milestones.map((m) => ({
                  id: m.id,
                  visitNumber: m.visitNumber,
                  rewardType: m.rewardType,
                  rewardName: m.rewardName,
                  rewardDescription: m.rewardDescription,
                  rewardValue: m.rewardValue ? m.rewardValue.toString() : null,
                })),
              }
            : null,
        })),
      },
      cycles: p.loyaltyCycles.map((c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        status: c.status,
        visitCount: c.visitCount,
        cycleLength: c.program.cycleLength,
        programName: c.program.name,
        qrToken: p.business.branches[0]?.qrToken || c.visits[0]?.branch?.qrToken || null,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        milestones: c.program.milestones.map((m) => ({
          id: m.id,
          visitNumber: m.visitNumber,
          rewardType: m.rewardType,
          rewardName: m.rewardName,
          rewardDescription: m.rewardDescription,
          rewardValue: m.rewardValue ? m.rewardValue.toString() : null,
        })),
        visits: c.visits.map((v) => ({
          id: v.id,
          visitType: v.visitType,
          visitNumberInCycle: v.visitNumberInCycle,
          branchName: v.branch.name,
          createdAt: v.createdAt,
        })),
        rewards: c.milestoneRewards.map((r) => {
          let redemptionToken: string | null = null;
          if (r.status === 'UNLOCKED') {
            redemptionToken = deriveRedemptionTokenForReward(r.id);
          }
          return {
            id: r.id,
            rewardType: r.snapshotRewardType,
            rewardName: r.snapshotRewardName,
            rewardValue: r.snapshotRewardValue ? r.snapshotRewardValue.toString() : null,
            status: r.status,
            unlockedAt: r.unlockedAt,
            redeemedAt: r.redeemedAt,
            redemptionToken,
          };
        }),
      })),
    }));

    return history;
  }

  /**
   * Retrieves active businesses with active loyalty programs for customer exploration with
   * database-level server-side pagination, category filtering, and search.
   * Real database data only.
   */
  static async getCustomerExplore(
    customerId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
    } = {}
  ) {
    const pageNum = Math.max(1, parseInt(String(options.page || 1), 10) || 1);
    const limitNum = Math.min(20, Math.max(1, parseInt(String(options.limit || 12), 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const andConditions: any[] = [
      {
        branches: {
          some: {
            isActive: true,
            loyaltyPrograms: { some: { isActive: true } },
          },
        },
      },
    ];

    // Search query condition
    const q = options.search?.trim();
    if (q) {
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          {
            branches: {
              some: {
                isActive: true,
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { address: { contains: q, mode: 'insensitive' } },
                  {
                    loyaltyPrograms: {
                      some: {
                        isActive: true,
                        name: { contains: q, mode: 'insensitive' },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    // Category filter condition
    const cat = options.category?.trim().toUpperCase();
    if (cat && cat !== 'ALL') {
      if (cat === 'CAFE') {
        andConditions.push({
          OR: [
            { type: { equals: 'CAFE', mode: 'insensitive' } },
            { type: { equals: 'Cafe', mode: 'insensitive' } },
            {
              AND: [
                { type: null },
                {
                  OR: [
                    { name: { contains: 'coffee', mode: 'insensitive' } },
                    { name: { contains: 'cafe', mode: 'insensitive' } },
                    { name: { contains: 'roaster', mode: 'insensitive' } },
                    { name: { contains: 'bakery', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          ],
        });
      } else if (cat === 'SALON') {
        andConditions.push({
          OR: [
            { type: { equals: 'SALON', mode: 'insensitive' } },
            { type: { equals: 'Salon', mode: 'insensitive' } },
            {
              AND: [
                { type: null },
                {
                  OR: [
                    { name: { contains: 'salon', mode: 'insensitive' } },
                    { name: { contains: 'spa', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          ],
        });
      } else if (cat === 'RESTAURANT') {
        andConditions.push({
          OR: [
            { type: { equals: 'RESTAURANT', mode: 'insensitive' } },
            { type: { equals: 'Restaurant', mode: 'insensitive' } },
            { type: { equals: 'Dining', mode: 'insensitive' } },
            {
              AND: [
                { type: null },
                {
                  OR: [
                    { name: { contains: 'restaurant', mode: 'insensitive' } },
                    { name: { contains: 'dining', mode: 'insensitive' } },
                    { name: { contains: 'bistro', mode: 'insensitive' } },
                    { name: { contains: 'pizza', mode: 'insensitive' } },
                    { name: { contains: 'food', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          ],
        });
      } else if (cat === 'FITNESS') {
        andConditions.push({
          OR: [
            { type: { equals: 'FITNESS', mode: 'insensitive' } },
            { type: { equals: 'Fitness', mode: 'insensitive' } },
            {
              AND: [
                { type: null },
                {
                  OR: [
                    { name: { contains: 'fitness', mode: 'insensitive' } },
                    { name: { contains: 'gym', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          ],
        });
      } else if (cat === 'RETAIL') {
        andConditions.push({
          OR: [
            { type: { equals: 'RETAIL', mode: 'insensitive' } },
            { type: { equals: 'Retail', mode: 'insensitive' } },
            {
              AND: [
                { type: null },
                {
                  OR: [
                    { name: { contains: 'retail', mode: 'insensitive' } },
                    { name: { contains: 'store', mode: 'insensitive' } },
                    { name: { contains: 'shop', mode: 'insensitive' } },
                  ],
                },
              ],
            },
          ],
        });
      } else {
        andConditions.push({
          type: { equals: cat, mode: 'insensitive' },
        });
      }
    }

    const where = { AND: andConditions };

    const [total, businesses] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: {
          branches: {
            where: {
              isActive: true,
              loyaltyPrograms: { some: { isActive: true } },
            },
            orderBy: { createdAt: 'asc' },
            include: {
              loyaltyPrograms: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                include: {
                  milestones: {
                    where: { isEnabled: true },
                    orderBy: { visitNumber: 'asc' },
                  },
                },
              },
            },
          },
          customerProfiles: {
            where: { customerId },
            include: {
              loyaltyCycles: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;

    const items = businesses.map((b) => {
      const activeBranch = b.branches[0];
      const activeProgram = activeBranch?.loyaltyPrograms[0];
      const profile = b.customerProfiles[0];
      const activeCycle = profile?.loyaltyCycles[0];

      let normalizedType = b.type ? b.type.trim().toUpperCase() : null;
      if (!normalizedType) {
        const lowerName = b.name.toLowerCase();
        if (
          lowerName.includes('coffee') ||
          lowerName.includes('cafe') ||
          lowerName.includes('roaster') ||
          lowerName.includes('bakery')
        ) {
          normalizedType = 'CAFE';
        } else if (lowerName.includes('spa') || lowerName.includes('salon')) {
          normalizedType = 'SALON';
        } else if (
          lowerName.includes('restaurant') ||
          lowerName.includes('dining') ||
          lowerName.includes('bistro') ||
          lowerName.includes('pizza') ||
          lowerName.includes('food')
        ) {
          normalizedType = 'RESTAURANT';
        } else if (lowerName.includes('gym') || lowerName.includes('fitness')) {
          normalizedType = 'FITNESS';
        } else {
          normalizedType = 'RETAIL';
        }
      }

      return {
        id: b.id,
        name: b.name,
        type: normalizedType,
        branch: activeBranch
          ? {
              id: activeBranch.id,
              name: activeBranch.name,
              address: activeBranch.address,
              qrToken: activeBranch.qrToken,
            }
          : null,
        program: activeProgram
          ? {
              id: activeProgram.id,
              name: activeProgram.name,
              description: activeProgram.description,
              cycleLength: activeProgram.cycleLength,
              milestones: activeProgram.milestones.map((m) => ({
                id: m.id,
                visitNumber: m.visitNumber,
                rewardType: m.rewardType,
                rewardName: m.rewardName,
                rewardDescription: m.rewardDescription,
                rewardValue: m.rewardValue ? m.rewardValue.toString() : null,
              })),
            }
          : null,
        isEnrolled: !!profile,
        currentVisitCount: activeCycle ? activeCycle.visitCount : 0,
      };
    });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }
}


