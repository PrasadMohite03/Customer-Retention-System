import api, {
  refreshAccessToken,
  setSessionType,
  setFallbackRefreshToken,
  getFallbackRefreshToken,
} from './api';
import type {
  LoginRequest,
  RegisterOwnerRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  ApiResponse,
  LoginData,
  OwnerRegisterData,
  VerifyOtpData,
  RefreshData,
} from '../types/auth';

export const authService = {
  async registerOwner(data: RegisterOwnerRequest): Promise<OwnerRegisterData> {
    const response = await api.post<ApiResponse<OwnerRegisterData>>('/auth/register', data);
    if (!response.data.data) {
      throw new Error(response.data.message || 'Registration failed');
    }
    setSessionType('USER');
    if (response.data.data.refreshToken) {
      setFallbackRefreshToken(response.data.data.refreshToken);
    }
    return response.data.data;
  },

  async loginOwnerOrStaff(data: LoginRequest): Promise<LoginData> {
    const response = await api.post<ApiResponse<LoginData>>('/auth/login', data);
    if (!response.data.data) {
      throw new Error(response.data.message || 'Login failed');
    }
    setSessionType('USER');
    if (response.data.data.refreshToken) {
      setFallbackRefreshToken(response.data.data.refreshToken);
    }
    return response.data.data;
  },

  async sendCustomerOtp(data: SendOtpRequest): Promise<string> {
    const response = await api.post<ApiResponse<never>>('/auth/customer/otp/send', data);
    return response.data.message || 'OTP sent successfully';
  },

  async verifyCustomerOtp(data: VerifyOtpRequest): Promise<VerifyOtpData> {
    const response = await api.post<ApiResponse<VerifyOtpData>>('/auth/customer/otp/verify', data);
    if (!response.data.data) {
      throw new Error(response.data.message || 'OTP verification failed');
    }
    setSessionType('CUSTOMER');
    if (response.data.data.refreshToken) {
      setFallbackRefreshToken(response.data.data.refreshToken);
    }
    return response.data.data;
  },

  async refreshUser(): Promise<RefreshData> {
    const accessToken = await refreshAccessToken('USER');
    return { accessToken };
  },

  async refreshCustomer(): Promise<RefreshData> {
    const accessToken = await refreshAccessToken('CUSTOMER');
    return { accessToken };
  },

  async logoutUser(): Promise<void> {
    try {
      const fallbackToken = getFallbackRefreshToken();
      await api.post('/auth/logout', fallbackToken ? { refreshToken: fallbackToken } : {});
    } finally {
      setSessionType(null);
      setFallbackRefreshToken(null);
    }
  },

  async logoutCustomer(): Promise<void> {
    try {
      const fallbackToken = getFallbackRefreshToken();
      await api.post('/auth/customer/logout', fallbackToken ? { refreshToken: fallbackToken } : {});
    } finally {
      setSessionType(null);
      setFallbackRefreshToken(null);
    }
  },
};
