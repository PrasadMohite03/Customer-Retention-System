import { Request, Response, NextFunction } from 'express';
import { StaffVisitService } from '../services/staffVisit.service';
import { AppError } from '../utils/errors';

export async function getPendingRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const filterBranchId = req.query.branchId as string | undefined;
    const result = await StaffVisitService.getPendingRequests(req.user, filterBranchId);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveVisitRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const id = String(req.params.id);
    const result = await StaffVisitService.approveVisitRequest(req.user, id);

    return res.status(200).json({
      status: 'success',
      message: 'Visit approved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectVisitRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const id = String(req.params.id);
    const result = await StaffVisitService.rejectVisitRequest(req.user, id);

    return res.status(200).json({
      status: 'success',
      message: 'Visit request rejected',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function redeemRewardHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const rewardId = String(req.params.rewardId);
    const result = await StaffVisitService.redeemReward(req.user, rewardId);

    return res.status(200).json({
      status: 'success',
      message: 'Reward marked as redeemed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnlockedRewardsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const filterBranchId = req.query.branchId as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await StaffVisitService.getUnlockedRewards(
      req.user,
      filterBranchId,
      search
    );

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const filterBranchId = req.query.branchId as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await StaffVisitService.getDashboard(
      req.user,
      filterBranchId,
      search
    );

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function validateRewardTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const { rewardToken } = req.body;
    const result = await StaffVisitService.validateRewardToken(req.user, rewardToken);

    return res.status(200).json({
      status: 'success',
      message: 'Reward token validated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function redeemRewardByTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const { rewardToken } = req.body;
    const result = await StaffVisitService.redeemRewardByToken(req.user, rewardToken);

    return res.status(200).json({
      status: 'success',
      message: 'Reward redeemed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function validateRewardClaimTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const { claimToken } = req.body;
    const result = await StaffVisitService.validateRewardClaimToken(req.user, claimToken);

    return res.status(200).json({
      status: 'success',
      message: 'Reward claim token validated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmRewardClaimHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized: User context missing', 401);
    }

    const { claimToken } = req.body;
    const result = await StaffVisitService.confirmRewardClaim(req.user, claimToken);

    return res.status(200).json({
      status: 'success',
      message: 'Reward visit confirmed and redeemed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

