import { NextFunction, Request, Response } from 'express';
import logger from './logger';

type ErrorLike = { status?: number | string; message?: unknown };

function isErrorLike(obj: unknown): obj is ErrorLike {
  return typeof obj === 'object' && obj !== null && ('message' in obj || 'status' in obj);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // mark _next as intentionally unused so linters know it's used
  void _next;
  logger.error(err, 'Unhandled error');
  let status = 500;
  let message = 'Internal Server Error';
  if (isErrorLike(err)) {
    if (typeof err.status === 'number' || typeof err.status === 'string') status = Number(err.status);
    if (typeof err.message === 'string') message = err.message;
  }
  res.status(status).json({ error: message });
}
