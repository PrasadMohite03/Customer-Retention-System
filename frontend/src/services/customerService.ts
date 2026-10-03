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
   * Retrieves past history and cycles.
   */
  async getCustomerHistory(): Promise<any[]> {
    const res = await api.get<ApiResponse<any[]>>('/customer/history');
    return res.data.data ?? [];
  },
};
