import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ error: error.issues }, 'Validation error');
        res.status(400).json({
          error: 'Validation error',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        logger.error({ error }, 'Unexpected validation error');
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

/**
 * Middleware to validate request query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ error: error.issues }, 'Query validation error');
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        logger.error({ error }, 'Unexpected validation error');
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

/**
 * Middleware to validate request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ error: error.issues }, 'Params validation error');
        res.status(400).json({
          error: 'Invalid route parameters',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        logger.error({ error }, 'Unexpected validation error');
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

