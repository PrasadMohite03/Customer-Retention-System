export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address?: string | null;
  qrToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  name: string;
  address?: string | null;
}

export interface UpdateBranchRequest {
  name?: string;
  address?: string | null;
}

export interface UpdateBranchStatusRequest {
  isActive: boolean;
}
