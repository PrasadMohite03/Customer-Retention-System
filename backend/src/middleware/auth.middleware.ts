import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken, verifyCustomerAccessToken } from '../utils/auth.utils';
import { AppError } from '../utils/errors';

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Missing or invalid token format', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    if (!payload || !payload.userId || !payload.role || !payload.businessId) {
      return next(new AppError('Unauthorized: Invalid token payload', 401));
    }

    if (payload.role !== UserRole.OWNER && payload.role !== UserRole.STAFF) {
      return next(new AppError('Unauthorized: Role not allowed for this service', 403));
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
      businessId: payload.businessId,
    };

    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid or expired access token', 401));
  }
};

export const authenticateCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Missing or invalid token format', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyCustomerAccessToken(token);

    if (!payload || !payload.customerId || payload.role !== 'CUSTOMER') {
      return next(new AppError('Unauthorized: Invalid customer token payload', 401));
    }

    req.customer = {
      customerId: payload.customerId,
      role: 'CUSTOMER',
    };

    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid or expired access token', 401));
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized: User not authenticated', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Insufficient permissions', 403));
    }

    next();
  };
};
