import { Request, Response, NextFunction } from 'express';
import { BranchService } from '../services/branch.service';
import { AppError } from '../utils/errors';

export async function createBranchHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branch = await BranchService.createBranch(businessId, req.body);

    return res.status(201).json({
      status: 'success',
      data: {
        branch,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBranchesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branches = await BranchService.getBranches(businessId);

    return res.status(200).json({
      status: 'success',
      data: {
        branches,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBranchByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const rawId = req.params.id;
    const branchId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const branch = await BranchService.getBranchById(branchId, businessId);

    return res.status(200).json({
      status: 'success',
      data: {
        branch,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBranchHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const rawId = req.params.id;
    const branchId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const branch = await BranchService.updateBranch(
      branchId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: {
        branch,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBranchStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const rawId = req.params.id;
    const branchId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const branch = await BranchService.updateBranchStatus(
      branchId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: {
        branch,
      },
    });
  } catch (error) {
    next(error);
  }
}
