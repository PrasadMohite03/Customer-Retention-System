import api from './api';
import type { ApiResponse } from '../types/auth';

export interface PublicQrData {
  business: {
    name: string;
    type?: string | null;
  };
  branch: {
    name: string;
    address?: string | null;
  };
  program: {
    name: string;
    description?: string | null;
    cycleLength: number;
    milestones: Array<{
      visitNumber: number;
      rewardType: string;
      rewardName?: string | null;
      rewardDescription?: string | null;
      rewardValue?: string | null;
    }>;
  };
}

export interface CustomerRewardItem {
  id: string;
  milestoneId?: string;
  rewardType: string;
  rewardName?: string | null;
  rewardDescription?: string | null;
  rewardValue?: string | null;
  unlockedAt: string;
  redeemedAt?: string | null;
  cycleNumber: number;
  isCurrentCycle?: boolean;
  status: 'UNLOCKED' | 'REDEEMED';
  redemptionToken?: string | null;
}

export interface CustomerLoyaltyData {
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  business: {
    name: string;
    type?: string | null;
  };
  branch: {
    name: string;
    address?: string | null;
  };
  program: {
    name: string;
    description?: string | null;
    cycleLength: number;
  };
  cycle: {
    hasStarted: boolean;
    id: string | null;
    cycleNumber: number | null;
    visitCount: number;
    cycleLength: number;
    status: string | null;
    startedAt?: string | null;
  };
  milestones: Array<{
    id: string;
    visitNumber: number;
    rewardType: string;
    rewardName?: string | null;
    rewardDescription?: string | null;
    rewardValue?: string | null;
    status: 'LOCKED' | 'UNLOCKED' | 'REDEEMED';
  }>;
  rewards: CustomerRewardItem[];
  unlockedRewards: CustomerRewardItem[];
  redeemedRewards: CustomerRewardItem[];
  pendingRequest: {
    id: string;
    status: string;
    requestedAt: string;
  } | null;
}

export interface RewardClaimData {
  claimId: string;
  claimToken: string;
  expiresAt: string;
  expectedVisitNumber: number;
  cycleLength: number;
  reward: {
    id: string;
    name: string;
    description?: string | null;
    type: string;
    value?: string | null;
  };
  business: {
    name: string;
  };
  branch: {
    name: string;
  };
}

export interface CustomerHistoryCycleReward {
  id: string;
  rewardType: string;
  rewardName?: string | null;
  rewardValue?: string | null;
  status: 'UNLOCKED' | 'REDEEMED';
  unlockedAt: string;
  redeemedAt?: string | null;
  redemptionToken?: string | null;
}

export interface CustomerHistoryCycleVisit {
  id: string;
  visitType?: 'QUALIFYING' | 'REWARD_REDEMPTION';
  visitNumberInCycle?: number | null;
  branchName: string;
  createdAt: string;
}

export interface CustomerHistoryCycleMilestone {
  id: string;
  visitNumber: number;
  rewardType: string;
  rewardName?: string | null;
  rewardDescription?: string | null;
  rewardValue?: string | null;
}

export interface CustomerHistoryCycle {
  id: string;
  cycleNumber: number;
  status: string;
  visitCount: number;
  cycleLength: number;
  programName: string;
  qrToken?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  milestones?: CustomerHistoryCycleMilestone[];
  visits: CustomerHistoryCycleVisit[];
  rewards: CustomerHistoryCycleReward[];
}

export interface CustomerHistoryItem {
  business: {
    id: string;
    name: string;
    type?: string | null;
    branches?: Array<{
      id: string;
      name: string;
      address?: string | null;
      qrToken: string;
      program?: {
        id: string;
        name: string;
        cycleLength: number;
        milestones: CustomerHistoryCycleMilestone[];
      } | null;
    }>;
  };
  cycles: CustomerHistoryCycle[];
}

export interface ExploreBusinessItem {
  id: string;
  name: string;
  type: string | null;
  branch: {
    id: string;
    name: string;
    address?: string | null;
    qrToken: string;
  } | null;
  program: {
    id: string;
    name: string;
    description?: string | null;
    cycleLength: number;
    milestones: Array<{
      id: string;
      visitNumber: number;
      rewardType: string;
      rewardName?: string | null;
      rewardDescription?: string | null;
      rewardValue?: string | null;
    }>;
  } | null;
  isEnrolled: boolean;
  currentVisitCount: number;
}

export interface ExplorePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ExploreResponse {
  items: ExploreBusinessItem[];
  pagination: ExplorePagination;
}

export interface ExploreQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export const customerService = {
  /**
   * Resolves public QR token info (does not require auth).
   */
  async resolvePublicQr(qrToken: string): Promise<PublicQrData> {
    const res = await api.get<ApiResponse<PublicQrData>>(`/public/qr/${qrToken}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to resolve QR token');
    }
    return res.data.data;
  },

  /**
   * Reads authenticated customer's loyalty pass status.
   * Strictly read-only for loyalty cycles.
   */
  async getLoyaltyStatus(qrToken: string): Promise<CustomerLoyaltyData> {
    const res = await api.get<ApiResponse<CustomerLoyaltyData>>(`/customer/loyalty/${qrToken}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve loyalty status');
    }
    return res.data.data;
  },

  /**
   * Submits a visit stamp request.
   */
  async createVisitRequest(qrToken: string): Promise<{ id: string; status: string; requestedAt: string }> {
    const res = await api.post<ApiResponse<{ id: string; status: string; requestedAt: string }>>(
      '/customer/visit-requests',
      { qrToken }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to submit visit request');
    }
    return res.data.data;
  },

  /**
   * Generates a temporary Reward Claim token for the next qualifying visit that has a reward.
   * Does NOT create a VisitRequest.
   */
  async createRewardClaim(qrToken: string): Promise<RewardClaimData> {
    const res = await api.post<ApiResponse<RewardClaimData>>(
      '/customer/reward-claims',
      { qrToken }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to generate reward claim token');
    }
    return res.data.data;
  },

  /**
   * Retrieves past history and cycles.
   */
  async getCustomerHistory(): Promise<CustomerHistoryItem[]> {
    const res = await api.get<ApiResponse<CustomerHistoryItem[]>>('/customer/history');
    return res.data.data ?? [];
  },

  /**
   * Retrieves active participating businesses for exploration with server-side pagination, category, and search.
   */
  async getExploreBusinesses(params?: ExploreQueryParams): Promise<ExploreResponse> {
    const res = await api.get<ApiResponse<ExploreResponse>>('/customer/explore', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 12,
        category: params?.category && params.category !== 'ALL' ? params.category : undefined,
        search: params?.search?.trim() ? params.search.trim() : undefined,
      },
    });
    return (
      res.data.data ?? {
        items: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }
    );
  },
};


