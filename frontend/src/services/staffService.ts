import api from './api';
import type { ApiResponse } from '../types/auth';

export interface PendingVisitRequest {
  id: string;
  status: string;
  requestedAt: string;
  branch: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    maskedPhone: string;
  };
  currentCycleVisitCount: number;
}

export interface ApprovalResult {
  visitId: string;
  visitNumberInCycle: number;
  cycleNumber: number;
  cycleCompleted: boolean;
  newRewardUnlocked?: {
    id: string;
    rewardType: string;
    rewardName?: string | null;
    rewardValue?: string | null;
  } | null;
}

export interface UnlockedCustomerReward {
  id: string;
  rewardType: string;
  rewardName?: string | null;
  rewardDescription?: string | null;
  rewardValue?: string | null;
  unlockedAt: string;
  cycleNumber: number;
  branch: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    maskedPhone: string;
  };
}

export interface ValidatedRewardTokenInfo {
  rewardId: string;
  rewardName: string;
  rewardDescription?: string | null;
  rewardType: string;
  rewardValue?: string | null;
  customerName: string;
  customerPhone: string;
  unlockedAt: string;
  status: string;
}

export interface RedeemedRewardTokenResult {
  id: string;
  status: string;
  redeemedAt: string;
  rewardName: string;
  rewardType: string;
  rewardValue?: string | null;
}

export interface StaffDashboardData {
  pendingRequests: PendingVisitRequest[];
  availableRewards: UnlockedCustomerReward[];
  stats: {
    pendingRequests: number;
    activeRewards: number;
  };
}

export const staffService = {
  /**
   * Unified dashboard query: returns pending requests, available customer rewards, and stats.
   * For STAFF: scoped to assigned branch.
   * For OWNER: business-wide, with optional branchId filter.
   */
  async getDashboard(branchId?: string, search?: string): Promise<StaffDashboardData> {
    const res = await api.get<ApiResponse<StaffDashboardData>>('/staff/dashboard', {
      params: {
        ...(branchId ? { branchId } : {}),
        ...(search ? { search } : {}),
      },
    });
    return (
      res.data.data ?? {
        pendingRequests: [],
        availableRewards: [],
        stats: { pendingRequests: 0, activeRewards: 0 },
      }
    );
  },

  /**
   * Fetch live pending requests.
   * For STAFF: branchId is automatic from backend.
   * For OWNER: optional filter by branchId.
   */
  async getPendingRequests(branchId?: string): Promise<PendingVisitRequest[]> {
    const res = await api.get<ApiResponse<PendingVisitRequest[]>>('/staff/visit-requests', {
      params: branchId ? { branchId } : undefined,
    });
    return res.data.data ?? [];
  },

  /**
   * Fetch active UNLOCKED customer rewards ready for redemption.
   * For STAFF: scoped to assigned branch.
   * For OWNER: scoped to business, optional branchId filter.
   */
  async getUnlockedRewards(branchId?: string, search?: string): Promise<UnlockedCustomerReward[]> {
    const res = await api.get<ApiResponse<UnlockedCustomerReward[]>>('/staff/rewards/unlocked', {
      params: {
        ...(branchId ? { branchId } : {}),
        ...(search ? { search } : {}),
      },
    });
    return res.data.data ?? [];
  },

  /**
   * Atomically approve a pending visit request.
   */
  async approveVisitRequest(id: string): Promise<ApprovalResult> {
    const res = await api.post<ApiResponse<ApprovalResult>>(`/staff/visit-requests/${id}/approve`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to approve request');
    }
    return res.data.data;
  },

  /**
   * Atomically reject a pending visit request.
   */
  async rejectVisitRequest(id: string): Promise<void> {
    await api.post(`/staff/visit-requests/${id}/reject`);
  },

  /**
   * Validate a customer-presented reward redemption token.
   * POST /api/staff/rewards/validate
   */
  async validateRewardToken(rewardToken: string): Promise<ValidatedRewardTokenInfo> {
    const res = await api.post<ApiResponse<ValidatedRewardTokenInfo>>('/staff/rewards/validate', {
      rewardToken,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to validate reward token');
    }
    return res.data.data;
  },

  /**
   * Atomically redeem a reward presented by customer token.
   * POST /api/staff/rewards/redeem-by-token
   */
  async redeemRewardByToken(rewardToken: string): Promise<RedeemedRewardTokenResult> {
    const res = await api.post<ApiResponse<RedeemedRewardTokenResult>>('/staff/rewards/redeem-by-token', {
      rewardToken,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to redeem reward');
    }
    return res.data.data;
  },

  /**
   * Mark an unlocked milestone reward as redeemed (legacy fallback).
   */
  async redeemReward(rewardId: string): Promise<{ id: string; status: string; redeemedAt: string }> {
    const res = await api.post<ApiResponse<{ id: string; status: string; redeemedAt: string }>>(
      `/staff/rewards/${rewardId}/redeem`
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to redeem reward');
    }
    return res.data.data;
  },
};
