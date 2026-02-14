/**
 * Error Handling Middleware
 * 
 * Centralized error handling for Express routes.
 * Provides consistent error responses and logging.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger';

// Custom API Error class
export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, unknown>;
  
  constructor(
    message: string,
    status: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export const Errors = {
  // 400 Bad Request
  BadRequest: (message: string, details?: Record<string, unknown>) => 
    new ApiError(message, 400, 'BAD_REQUEST', details),
  
  ValidationError: (message: string, details?: Record<string, unknown>) => 
    new ApiError(message, 400, 'VALIDATION_ERROR', details),
  
  // 401 Unauthorized
  Unauthorized: (message: string = 'Authentication required') => 
    new ApiError(message, 401, 'UNAUTHORIZED'),
  
  // 403 Forbidden
  Forbidden: (message: string = 'Access denied') => 
    new ApiError(message, 403, 'FORBIDDEN'),
  
  // 404 Not Found
  NotFound: (resource: string = 'Resource') => 
    new ApiError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  // 409 Conflict
  Conflict: (message: string) => 
    new ApiError(message, 409, 'CONFLICT'),
  
  // 422 Unprocessable Entity
  Unprocessable: (message: string, details?: Record<string, unknown>) => 
    new ApiError(message, 422, 'UNPROCESSABLE_ENTITY', details),
  
  // 429 Too Many Requests
  TooManyRequests: (message: string = 'Rate limit exceeded') => 
    new ApiError(message, 429, 'TOO_MANY_REQUESTS'),
  
  // 500 Internal Server Error
  Internal: (message: string = 'Internal server error') => 
    new ApiError(message, 500, 'INTERNAL_ERROR'),
  
  // 502 Bad Gateway
  BadGateway: (message: string = 'External service error') => 
    new ApiError(message, 502, 'BAD_GATEWAY'),
  
  // 503 Service Unavailable
  ServiceUnavailable: (message: string = 'Service temporarily unavailable') => 
    new ApiError(message, 503, 'SERVICE_UNAVAILABLE'),
};

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    status: number;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

// Main error handling middleware
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default error values
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: Record<string, unknown> | undefined;
  
  // Handle custom ApiError
  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } 
  // Handle validation errors from express-validator
  else if (err.name === 'ValidationError' || err.name === 'express-validator') {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = { errors: validationErrors.array() };
    }
  }
  // Handle syntax errors (malformed JSON)
  else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    code = 'SYNTAX_ERROR';
    message = 'Invalid JSON in request body';
  }
  
  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      status,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };
  
  // Log error (don't log stack trace in production for 4xx errors)
  if (status >= 500 || process.env.NODE_ENV !== 'production') {
    logger.error({
      err: err.message,
      stack: err.stack,
      status,
      code,
      path: req.path,
      method: req.method,
    }, 'Request error');
  } else {
    logger.warn({
      message: err.message,
      status,
      code,
      path: req.path,
      method: req.method,
    }, 'Client error');
  }
  
  // Send response
  res.status(status).json(errorResponse);
}

// 404 Not Found handler
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
      status: 404,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };
  
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  
  res.status(404).json(errorResponse);
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
