export type RewardType = 'NONE' | 'PERCENT_DISCOUNT' | 'FIXED_DISCOUNT' | 'FREE_ITEM';

export interface Milestone {
  id: string;
  programId: string;
  visitNumber: number;
  rewardType: RewardType;
  rewardName: string | null;
  rewardDescription: string | null;
  /** Decimal fields from Prisma are serialized as strings in JSON */
  rewardValue: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyProgram {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  description: string | null;
  cycleLength: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  milestones: Milestone[];
}

export interface CreateLoyaltyProgramRequest {
  name: string;
  description?: string | null;
  cycleLength: number;
}

export interface UpdateLoyaltyProgramRequest {
  name?: string;
  description?: string | null;
  cycleLength?: number;
}

export interface CreateMilestoneRequest {
  visitNumber: number;
  rewardType: RewardType;
  rewardName?: string | null;
  rewardDescription?: string | null;
  rewardValue?: number | null;
}

export interface UpdateMilestoneRequest {
  visitNumber?: number;
  rewardType?: RewardType;
  rewardName?: string | null;
  rewardDescription?: string | null;
  rewardValue?: number | null;
}
