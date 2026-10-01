import api from './api';
import type { ApiResponse } from '../types/auth';
import type {
  Branch,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '../types/branch';


export const branchService = {
  async getBranches(): Promise<Branch[]> {
    const response = await api.get<ApiResponse<{ branches: Branch[] }>>('/branches');
    return response.data.data?.branches || [];
  },

  async getBranch(id: string): Promise<Branch> {
    const response = await api.get<ApiResponse<{ branch: Branch }>>(`/branches/${id}`);
    if (!response.data.data?.branch) {
      throw new Error(response.data.message || 'Branch not found');
    }
    return response.data.data.branch;
  },

  async createBranch(payload: CreateBranchRequest): Promise<Branch> {
    const response = await api.post<ApiResponse<{ branch: Branch }>>('/branches', payload);
    if (!response.data.data?.branch) {
      throw new Error(response.data.message || 'Failed to create branch');
    }
    return response.data.data.branch;
  },

  async updateBranch(id: string, payload: UpdateBranchRequest): Promise<Branch> {
    const response = await api.patch<ApiResponse<{ branch: Branch }>>(`/branches/${id}`, payload);
    if (!response.data.data?.branch) {
      throw new Error(response.data.message || 'Failed to update branch');
    }
    return response.data.data.branch;
  },

  async updateBranchStatus(id: string, isActive: boolean): Promise<Branch> {
    const response = await api.patch<ApiResponse<{ branch: Branch }>>(`/branches/${id}/status`, {
      isActive,
    });
    if (!response.data.data?.branch) {
      throw new Error(response.data.message || 'Failed to update branch status');
    }
    return response.data.data.branch;
  },
};
