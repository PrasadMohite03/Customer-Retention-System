import { Request, Response, NextFunction } from 'express';
import { CustomerAuthService } from '../services/customerAuth.service';
import { getRefreshCookieOptions, config } from '../utils/auth.utils';

export async function sendOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await CustomerAuthService.sendOtp(req.body);
    return res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await CustomerAuthService.verifyOtp(req.body);

    res.cookie(config.REFRESH_COOKIE_NAME, result.refreshTokenValue, getRefreshCookieOptions());

    return res.status(200).json({
      status: 'success',
      data: {
        customer: result.customer,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshCustomerHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieValue = req.cookies?.[config.REFRESH_COOKIE_NAME];
    const result = await CustomerAuthService.refreshCustomer(cookieValue);

    res.cookie(config.REFRESH_COOKIE_NAME, result.refreshTokenValue, getRefreshCookieOptions());

    return res.status(200).json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    res.clearCookie(config.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    next(error);
  }
}

export async function logoutCustomerHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieValue = req.cookies?.[config.REFRESH_COOKIE_NAME];
    await CustomerAuthService.logoutCustomer(cookieValue);

    res.clearCookie(config.REFRESH_COOKIE_NAME, getRefreshCookieOptions());

    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.clearCookie(config.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    next(error);
  }
}
