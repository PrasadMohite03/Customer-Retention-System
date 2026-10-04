export type UserRole = 'OWNER' | 'STAFF' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  role: UserRole;
  businessId?: string;
  customerId?: string;
}

export interface RegisterOwnerRequest {
  email: string;
  password: string;
  businessName: string;
  businessType?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}

export interface OwnerRegisterData {
  user: {
    id: string;
    email: string;
    role: 'OWNER';
    createdAt: string;
  };
  business: {
    id: string;
    name: string;
    type?: string;
  };
  accessToken: string;
  refreshToken?: string;
}

export interface LoginData {
  user: {
    id: string;
    email: string;
    role: 'OWNER' | 'STAFF';
  };
  businessId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface VerifyOtpData {
  customer: {
    id: string;
    phone: string;
    name: string;
  };
  accessToken: string;
  refreshToken?: string;
}

export interface RefreshData {
  accessToken: string;
  refreshToken?: string;
}
