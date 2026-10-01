import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { getRefreshCookieOptions, config } from '../utils/auth.utils';

export async function registerOwnerHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await AuthService.registerOwner(req.body);

    res.cookie(config.REFRESH_COOKIE_NAME, result.refreshTokenValue, getRefreshCookieOptions());

    return res.status(201).json({
      status: 'success',
      data: {
        user: result.user,
        business: result.business,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await AuthService.login(req.body);

    res.cookie(config.REFRESH_COOKIE_NAME, result.refreshTokenValue, getRefreshCookieOptions());

    return res.status(200).json({
      status: 'success',
      data: {
        user: result.user,
        businessId: result.businessId,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieValue = req.cookies?.[config.REFRESH_COOKIE_NAME];
    const result = await AuthService.refresh(cookieValue);

    res.cookie(config.REFRESH_COOKIE_NAME, result.refreshTokenValue, getRefreshCookieOptions());

    return res.status(200).json({
      status: 'success',
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    // If refresh fails, clear invalid refresh cookie
    res.clearCookie(config.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    next(error);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookieValue = req.cookies?.[config.REFRESH_COOKIE_NAME];
    await AuthService.logout(cookieValue);

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
