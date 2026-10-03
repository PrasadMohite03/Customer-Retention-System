import { Request, Response, NextFunction } from 'express';
import { QrService } from '../services/qr.service';

export async function resolvePublicQrHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const qrToken = String(req.params.qrToken);
    const result = await QrService.resolvePublicQr(qrToken);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
