import { Request, Response, NextFunction } from 'express';
import { CustomerLoyaltyService } from '../services/customerLoyalty.service';
import { AppError } from '../utils/errors';

export async function getLoyaltyStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = req.customer?.customerId;
    if (!customerId) {
      throw new AppError('Unauthorized: Customer context missing', 401);
    }

    const qrToken = String(req.params.qrToken);
    const result = await CustomerLoyaltyService.getLoyaltyStatus(customerId, qrToken);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createVisitRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = req.customer?.customerId;
    if (!customerId) {
      throw new AppError('Unauthorized: Customer context missing', 401);
    }

    const { qrToken } = req.body;
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('qrToken is required in request body', 400);
    }

    const result = await CustomerLoyaltyService.createVisitRequest(customerId, qrToken);

    return res.status(201).json({
      status: 'success',
      message: 'Visit stamp requested successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createRewardClaimHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = req.customer?.customerId;
    if (!customerId) {
      throw new AppError('Unauthorized: Customer context missing', 401);
    }

    const { qrToken } = req.body;
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('qrToken is required in request body', 400);
    }

    const result = await CustomerLoyaltyService.createRewardClaim(customerId, qrToken);

    return res.status(201).json({
      status: 'success',
      message: 'Reward claim token generated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = req.customer?.customerId;
    if (!customerId) {
      throw new AppError('Unauthorized: Customer context missing', 401);
    }

    const result = await CustomerLoyaltyService.getCustomerHistory(customerId);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerExploreHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = req.customer?.customerId;
    if (!customerId) {
      throw new AppError('Unauthorized: Customer context missing', 401);
    }

    const { page, limit, category, search } = req.query;

    const result = await CustomerLoyaltyService.getCustomerExplore(customerId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


