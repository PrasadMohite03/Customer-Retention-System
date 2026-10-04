import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    const issues = err.issues || (err as any).errors || [];
    return res.status(400).json({
      status: 'error',
      message: issues[0]?.message || 'Validation error',
      errors: issues,
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode < 500) {
      console.warn(`[AppError ${err.statusCode}] ${err.message}`);
    } else {
      console.error(err);
    }
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Fallback for unhandled errors
  console.error(err);
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};

