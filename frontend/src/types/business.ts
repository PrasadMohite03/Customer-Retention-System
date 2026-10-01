export interface Business {
  id: string;
  name: string;
  type?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  branchCount?: number;
}

export interface UpdateBusinessRequest {
  name?: string;
  type?: string | null;
}
