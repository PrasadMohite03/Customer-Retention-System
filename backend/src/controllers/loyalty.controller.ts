import { Request, Response, NextFunction } from 'express';
import { LoyaltyService } from '../services/loyalty.service';
import { AppError } from '../utils/errors';

/** Safely extract a single string from an Express route param (which can be string | string[]) */
function extractParam(raw: string | string[] | undefined): string | undefined {
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

// ── Loyalty Program Handlers ──────────────────────────────────────────────

export async function createLoyaltyProgramHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branchId = extractParam(req.params.id);

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const program = await LoyaltyService.createLoyaltyProgram(
      branchId,
      businessId,
      req.body
    );

    return res.status(201).json({
      status: 'success',
      data: { program },
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoyaltyProgramHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branchId = extractParam(req.params.id);

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const program = await LoyaltyService.getLoyaltyProgram(branchId, businessId);

    return res.status(200).json({
      status: 'success',
      data: { program },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLoyaltyProgramHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branchId = extractParam(req.params.id);

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const program = await LoyaltyService.updateLoyaltyProgram(
      branchId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: { program },
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoyaltyProgramsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const branchId = extractParam(req.params.id);

    if (!branchId) {
      throw new AppError('Branch ID parameter is required', 400);
    }

    const programs = await LoyaltyService.getLoyaltyPrograms(branchId, businessId);

    return res.status(200).json({
      status: 'success',
      data: { programs },
    });
  } catch (error) {
    next(error);
  }
}

export async function setProgramStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const programId = extractParam(req.params.programId);

    if (!programId) {
      throw new AppError('Program ID parameter is required', 400);
    }

    const program = await LoyaltyService.setProgramStatus(
      programId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: { program },
    });
  } catch (error) {
    next(error);
  }
}

// ── Milestone Handlers ────────────────────────────────────────────────────

export async function createMilestoneHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const programId = extractParam(req.params.programId);

    if (!programId) {
      throw new AppError('Program ID parameter is required', 400);
    }

    const milestone = await LoyaltyService.createMilestone(
      programId,
      businessId,
      req.body
    );

    return res.status(201).json({
      status: 'success',
      data: { milestone },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMilestoneHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const milestoneId = extractParam(req.params.milestoneId);

    if (!milestoneId) {
      throw new AppError('Milestone ID parameter is required', 400);
    }

    const milestone = await LoyaltyService.updateMilestone(
      milestoneId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: { milestone },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMilestoneStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const milestoneId = extractParam(req.params.milestoneId);

    if (!milestoneId) {
      throw new AppError('Milestone ID parameter is required', 400);
    }

    const milestone = await LoyaltyService.updateMilestoneStatus(
      milestoneId,
      businessId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: { milestone },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMilestoneHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const milestoneId = extractParam(req.params.milestoneId);

    if (!milestoneId) {
      throw new AppError('Milestone ID parameter is required', 400);
    }

    await LoyaltyService.deleteMilestone(milestoneId, businessId);

    return res.status(200).json({
      status: 'success',
      message: 'Milestone deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
