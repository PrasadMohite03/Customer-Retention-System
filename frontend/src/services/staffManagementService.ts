import api from './api';
import type { ApiResponse } from '../types/auth';

export interface StaffMember {
  id: string;
  userId: string;
  email: string;
  branchId: string;
  branchName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffPayload {
  email: string;
  password: string;
  branchId: string;
}

export interface UpdateStaffPayload {
  email?: string;
  password?: string;
  branchId?: string;
}

export const staffManagementService = {
  /**
   * List all staff members for the authenticated owner's business.
   */
  async getStaffList(): Promise<StaffMember[]> {
    const res = await api.get<ApiResponse<StaffMember[]>>('/staff');
    return res.data.data ?? [];
  },

  /**
   * Get a specific staff member by ID.
   */
  async getStaffById(id: string): Promise<StaffMember> {
    const res = await api.get<ApiResponse<StaffMember>>(`/staff/${id}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Staff member not found');
    }
    return res.data.data;
  },

  /**
   * Create a new staff account under owner's business.
   */
  async createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
    const res = await api.post<ApiResponse<StaffMember>>('/staff', payload);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to create staff member');
    }
    return res.data.data;
  },

  /**
   * Update staff details (email, password, or branch).
   */
  async updateStaff(id: string, payload: UpdateStaffPayload): Promise<StaffMember> {
    const res = await api.patch<ApiResponse<StaffMember>>(`/staff/${id}`, payload);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff member');
    }
    return res.data.data;
  },

  /**
   * Deactivate or reactivate a staff member.
   */
  async updateStaffStatus(id: string, isActive: boolean): Promise<StaffMember> {
    const res = await api.patch<ApiResponse<StaffMember>>(`/staff/${id}/status`, { isActive });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff status');
    }
    return res.data.data;
  },
};
