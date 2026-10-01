import { Request, Response, NextFunction } from 'express';
import { BusinessService } from '../services/business.service';

export async function getBusinessHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const ownerId = req.user!.userId;

    const business = await BusinessService.getBusiness(businessId, ownerId);

    return res.status(200).json({
      status: 'success',
      data: {
        business,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.user!.businessId;
    const ownerId = req.user!.userId;

    const business = await BusinessService.updateBusiness(
      businessId,
      ownerId,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      data: {
        business,
      },
    });
  } catch (error) {
    next(error);
  }
}
