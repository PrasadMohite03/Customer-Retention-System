import { Request, Response, NextFunction } from 'express';
import { StaffService } from '../services/staff.service';
import { AppError } from '../utils/errors';

export async function createStaffHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.businessId) {
      throw new AppError('Unauthorized: Business context missing', 401);
    }

    const result = await StaffService.createStaff(req.user.businessId, req.body);
    return res.status(201).json({
      status: 'success',
      message: 'Staff account created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStaffListHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.businessId) {
      throw new AppError('Unauthorized: Business context missing', 401);
    }

    const result = await StaffService.getStaffList(req.user.businessId);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStaffByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.businessId) {
      throw new AppError('Unauthorized: Business context missing', 401);
    }

    const id = String(req.params.id);
    const result = await StaffService.getStaffById(id, req.user.businessId);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStaffHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.businessId) {
      throw new AppError('Unauthorized: Business context missing', 401);
    }

    const id = String(req.params.id);
    const result = await StaffService.updateStaff(id, req.user.businessId, req.body);
    return res.status(200).json({
      status: 'success',
      message: 'Staff details updated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStaffStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.user.businessId) {
      throw new AppError('Unauthorized: Business context missing', 401);
    }

    const id = String(req.params.id);
    const result = await StaffService.updateStaffStatus(id, req.user.businessId, req.body);
    return res.status(200).json({
      status: 'success',
      message: `Staff account ${result.isActive ? 'activated' : 'deactivated'} successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
