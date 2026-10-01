import api from './api';
import type { ApiResponse } from '../types/auth';
import type { Business, UpdateBusinessRequest } from '../types/business';


export const businessService = {
  async getBusiness(): Promise<Business> {
    const response = await api.get<ApiResponse<{ business: Business }>>('/business');
    if (!response.data.data?.business) {
      throw new Error(response.data.message || 'Failed to fetch business details');
    }
    return response.data.data.business;
  },

  async updateBusiness(payload: UpdateBusinessRequest): Promise<Business> {
    const response = await api.patch<ApiResponse<{ business: Business }>>('/business', payload);
    if (!response.data.data?.business) {
      throw new Error(response.data.message || 'Failed to update business');
    }
    return response.data.data.business;
  },
};
