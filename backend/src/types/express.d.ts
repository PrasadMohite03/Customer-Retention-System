import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  businessId: string;
}

export interface AuthenticatedCustomer {
  customerId: string;
  role: 'CUSTOMER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      customer?: AuthenticatedCustomer;
    }
  }
}
