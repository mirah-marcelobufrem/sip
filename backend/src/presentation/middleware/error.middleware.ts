import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

interface AppError extends Error {
  code?: string;
  statusCode?: number;
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  const statusMap: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    EMAIL_TAKEN: 409,
    INVALID_CREDENTIALS: 401,
    INVALID_TOKEN: 401,
    USER_NOT_FOUND: 404,
  };

  const status = err.statusCode ?? statusMap[err.code ?? ''] ?? 500;

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({
    error: err.message,
    code: err.code ?? 'INTERNAL_ERROR',
  });
}
