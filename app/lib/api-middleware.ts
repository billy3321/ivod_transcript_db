import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from './logger';

export interface APIResponse<T = any> {
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  success: boolean;
  error?: string;
  fallback?: boolean;
}

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function withErrorHandler<T = any>(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<T>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const result = await handler(req, res);
      
      // If handler already sent response, don't send again
      if (res.headersSent) {
        return;
      }

      // If result is a response object, send it
      if (result && typeof result === 'object' && 'success' in result) {
        return res.status(200).json(result);
      }

      // Otherwise, wrap result in success response
      const response: APIResponse<T> = {
        data: result,
        success: true,
      };

      return res.status(200).json(response);
    } catch (error) {
      return handleAPIError(error, req, res);
    }
  };
}

export function handleAPIError(
  error: unknown,
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log the error
  const errorToLog = error instanceof Error ? error : new Error(String(error));
  logger.logApiError(errorToLog, req, {
    endpoint: req.url || 'unknown',
    method: req.method || 'unknown',
    userAgent: req.headers?.['user-agent'] || 'unknown',
  });

  // Handle different error types
  if (error instanceof APIError) {
    const response: APIResponse = {
      success: false,
      error: error.message,
    };
    return res.status(error.statusCode).json(response);
  }

  if (error instanceof Error) {
    // In development, show detailed error messages
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response: APIResponse = {
      success: false,
      error: isDevelopment ? error.message : 'Internal server error',
    };
    
    return res.status(500).json(response);
  }

  // Unknown error type
  const response: APIResponse = {
    success: false,
    error: 'An unexpected error occurred',
  };

  return res.status(500).json(response);
}

export function createSuccessResponse<T>(
  data: T,
  meta?: APIResponse<T>['meta']
): APIResponse<T> {
  return {
    data,
    meta,
    success: true,
  };
}

export function createErrorResponse(
  message: string,
  statusCode: number = 500
): APIError {
  return new APIError(statusCode, message);
}

// Validation helpers
export function validateRequired(
  params: Record<string, any>,
  requiredFields: string[]
): void {
  for (const field of requiredFields) {
    if (!params[field]) {
      throw new APIError(400, `Missing required parameter: ${field}`);
    }
  }
}

export function validateMethod(
  req: NextApiRequest,
  allowedMethods: string[]
): void {
  if (!req.method || !allowedMethods.includes(req.method)) {
    throw new APIError(405, `Method ${req.method} not allowed`);
  }
}

export function parseIntParam(
  value: string | string[] | undefined,
  paramName: string,
  defaultValue?: number
): number {
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new APIError(400, `Missing required parameter: ${paramName}`);
  }

  const strValue = Array.isArray(value) ? value[0] : value;
  const intValue = parseInt(strValue, 10);

  if (isNaN(intValue)) {
    throw new APIError(400, `Invalid ${paramName}: must be a number`);
  }

  return intValue;
}

export function parseStringParam(
  value: string | string[] | undefined,
  paramName: string,
  defaultValue?: string
): string {
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new APIError(400, `Missing required parameter: ${paramName}`);
  }

  return Array.isArray(value) ? value[0] : value;
}