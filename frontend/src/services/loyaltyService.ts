import api from './api';
import type { ApiResponse } from '../types/auth';
import type {
  LoyaltyProgram,
  Milestone,
  CreateLoyaltyProgramRequest,
  UpdateLoyaltyProgramRequest,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  RewardChangeMode,
} from '../types/loyalty';

export const loyaltyService = {
  // ── Loyalty Program ──────────────────────────────────────────────────

  async getLoyaltyProgram(branchId: string): Promise<LoyaltyProgram> {
    const response = await api.get<ApiResponse<{ program: LoyaltyProgram }>>(
      `/branches/${branchId}/loyalty-program`
    );
    if (!response.data.data?.program) {
      throw new Error(response.data.message || 'Loyalty program not found');
    }
    return response.data.data.program;
  },

  /** Owner management view: returns ALL programs (active + inactive), newest first */
  async getLoyaltyPrograms(branchId: string): Promise<LoyaltyProgram[]> {
    const response = await api.get<ApiResponse<{ programs: LoyaltyProgram[] }>>(
      `/branches/${branchId}/loyalty-programs`
    );
    return response.data.data?.programs ?? [];
  },

  async createLoyaltyProgram(
    branchId: string,
    payload: CreateLoyaltyProgramRequest
  ): Promise<LoyaltyProgram> {
    const response = await api.post<ApiResponse<{ program: LoyaltyProgram }>>(
      `/branches/${branchId}/loyalty-program`,
      payload
    );
    if (!response.data.data?.program) {
      throw new Error(response.data.message || 'Failed to create loyalty program');
    }
    return response.data.data.program;
  },

  async updateLoyaltyProgram(
    branchId: string,
    payload: UpdateLoyaltyProgramRequest
  ): Promise<LoyaltyProgram> {
    const response = await api.patch<ApiResponse<{ program: LoyaltyProgram }>>(
      `/branches/${branchId}/loyalty-program`,
      payload
    );
    if (!response.data.data?.program) {
      throw new Error(response.data.message || 'Failed to update loyalty program');
    }
    return response.data.data.program;
  },

  /** Activate or deactivate a program by its own ID (PATCH /loyalty-programs/:programId/status) */
  async updateLoyaltyProgramStatus(
    programId: string,
    isActive: boolean
  ): Promise<LoyaltyProgram> {
    const response = await api.patch<ApiResponse<{ program: LoyaltyProgram }>>(
      `/loyalty-programs/${programId}/status`,
      { isActive }
    );
    if (!response.data.data?.program) {
      throw new Error(response.data.message || 'Failed to update program status');
    }
    return response.data.data.program;
  },

  // ── Milestones ───────────────────────────────────────────────────────

  async createMilestone(
    programId: string,
    payload: CreateMilestoneRequest
  ): Promise<Milestone> {
    const response = await api.post<ApiResponse<{ milestone: Milestone }>>(
      `/loyalty-programs/${programId}/milestones`,
      payload
    );
    if (!response.data.data?.milestone) {
      throw new Error(response.data.message || 'Failed to create milestone');
    }
    return response.data.data.milestone;
  },

  async updateMilestone(
    milestoneId: string,
    payload: UpdateMilestoneRequest
  ): Promise<Milestone> {
    const response = await api.patch<ApiResponse<{ milestone: Milestone }>>(
      `/milestones/${milestoneId}`,
      payload
    );
    if (!response.data.data?.milestone) {
      throw new Error(response.data.message || 'Failed to update milestone');
    }
    return response.data.data.milestone;
  },

  async updateMilestoneStatus(
    milestoneId: string,
    isEnabled: boolean,
    changeMode?: RewardChangeMode
  ): Promise<Milestone> {
    const response = await api.patch<ApiResponse<{ milestone: Milestone }>>(
      `/milestones/${milestoneId}/status`,
      { isEnabled, ...(changeMode ? { changeMode } : {}) }
    );
    if (!response.data.data?.milestone) {
      throw new Error(response.data.message || 'Failed to update milestone status');
    }
    return response.data.data.milestone;
  },

  async deleteMilestone(milestoneId: string): Promise<void> {
    await api.delete(`/milestones/${milestoneId}`);
  },
};
