import { NextApiRequest, NextApiResponse } from 'next';
import {
  APIError,
  APIResponse,
  withErrorHandler,
  handleAPIError,
  createSuccessResponse,
  createErrorResponse,
  validateRequired,
  validateMethod,
  parseIntParam,
  parseStringParam
} from '@/lib/api-middleware';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    logApiError: jest.fn()
  }
}));

import { logger } from '@/lib/logger';
const mockLogApiError = logger.logApiError as jest.MockedFunction<typeof logger.logApiError>;

// Helper function to create mock request/response
function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: any;
} = {}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/api/test',
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || {}
  } as NextApiRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false
  } as unknown as NextApiResponse;

  return { req, res };
}

describe('API Middleware Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('APIError class', () => {
    it('creates APIError with status code and message', () => {
      const error = new APIError(404, 'Not found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('APIError');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.details).toBeUndefined();
    });

    it('creates APIError with additional details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new APIError(400, 'Validation failed', details);
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(details);
    });
  });

  describe('withErrorHandler', () => {
    it('wraps successful handler result in success response', async () => {
      const { req, res } = createMockReqRes();
      const handler = jest.fn().mockResolvedValue({ id: 1, name: 'test' });
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { id: 1, name: 'test' },
        success: true
      });
    });

    it('returns result as-is if already a response object', async () => {
      const { req, res } = createMockReqRes();
      const responseObject: APIResponse = {
        data: { items: [] },
        success: true,
        meta: { total: 0 }
      };
      const handler = jest.fn().mockResolvedValue(responseObject);
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(responseObject);
    });

    it('does not send response if headers already sent', async () => {
      const { req, res } = createMockReqRes();
      (res as any).headersSent = true;
      const handler = jest.fn().mockResolvedValue({ data: 'test' });
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('handles handler errors through error handler', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const { req, res } = createMockReqRes();
      const error = new Error('Bad request');
      const handler = jest.fn().mockRejectedValue(error);
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Bad request'
      });
      expect(mockLogApiError).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('handles null handler result', async () => {
      const { req, res } = createMockReqRes();
      const handler = jest.fn().mockResolvedValue(null);
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: null,
        success: true
      });
    });

    it('handles undefined handler result', async () => {
      const { req, res } = createMockReqRes();
      const handler = jest.fn().mockResolvedValue(undefined);
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: undefined,
        success: true
      });
    });
  });

  describe('handleAPIError', () => {
    it('handles APIError instances', async () => {
      const { req, res } = createMockReqRes();
      
      // Test through withErrorHandler which properly calls handleAPIError
      const error = new APIError(404, 'Resource not found');
      const handler = jest.fn().mockRejectedValue(error);
      
      const wrappedHandler = withErrorHandler(handler);
      await wrappedHandler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found'
      });
      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        req,
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'GET'
        })
      );
    });

    it('handles regular Error instances in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const { req, res } = createMockReqRes();
      const error = new Error('Detailed error message');
      
      handleAPIError(error, req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Detailed error message'
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('handles regular Error instances in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const { req, res } = createMockReqRes();
      const error = new Error('Detailed error message');
      
      handleAPIError(error, req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('handles unknown error types', () => {
      const { req, res } = createMockReqRes();
      const error = 'String error';
      
      handleAPIError(error, req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred'
      });
      expect(mockLogApiError).toHaveBeenCalledWith(
        expect.any(Error),
        req,
        expect.any(Object)
      );
    });

    it('logs error with proper context', () => {
      const { req, res } = createMockReqRes({
        url: '/api/users',
        method: 'POST',
        headers: { 'user-agent': 'Test Browser' }
      });
      const error = new Error('Test error');
      
      handleAPIError(error, req, res);
      
      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        req,
        {
          endpoint: '/api/users',
          method: 'POST',
          userAgent: 'Test Browser'
        }
      );
    });

    it('handles missing request properties gracefully', () => {
      const { req, res } = createMockReqRes();
      delete (req as any).url;
      delete (req as any).method;
      delete (req as any).headers;
      
      const error = new Error('Test error');
      handleAPIError(error, req, res);
      
      expect(mockLogApiError).toHaveBeenCalledWith(
        error,
        req,
        {
          endpoint: 'unknown',
          method: 'unknown',
          userAgent: 'unknown'
        }
      );
    });
  });

  describe('createSuccessResponse', () => {
    it('creates success response with data only', () => {
      const data = { id: 1, name: 'test' };
      const response = createSuccessResponse(data);
      
      expect(response).toEqual({
        data,
        success: true
      });
    });

    it('creates success response with data and meta', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { total: 10, page: 1, pageSize: 2 };
      const response = createSuccessResponse(data, meta);
      
      expect(response).toEqual({
        data,
        meta,
        success: true
      });
    });

    it('handles null data', () => {
      const response = createSuccessResponse(null);
      
      expect(response).toEqual({
        data: null,
        success: true
      });
    });
  });

  describe('createErrorResponse', () => {
    it('creates APIError with default status code', () => {
      const error = createErrorResponse('Something went wrong');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('APIError');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Something went wrong');
    });

    it('creates APIError with custom status code', () => {
      const error = createErrorResponse('Invalid input', 400);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('APIError');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });
  });

  describe('validateRequired', () => {
    it('passes validation when all required fields are present', () => {
      const params = { name: 'test', email: 'test@example.com', age: 25 };
      const requiredFields = ['name', 'email'];
      
      expect(() => {
        validateRequired(params, requiredFields);
      }).not.toThrow();
    });

    it('throws APIError when required field is missing', () => {
      const params = { name: 'test' };
      const requiredFields = ['name', 'email'];
      
      expect(() => {
        validateRequired(params, requiredFields);
      }).toThrow('Missing required parameter: email');
      
      try {
        validateRequired(params, requiredFields);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).name).toBe('APIError');
        expect((error as any).statusCode).toBe(400);
        expect((error as Error).message).toBe('Missing required parameter: email');
      }
    });

    it('throws APIError when required field is null', () => {
      const params = { name: 'test', email: null };
      const requiredFields = ['name', 'email'];
      
      expect(() => {
        validateRequired(params, requiredFields);
      }).toThrow('Missing required parameter: email');
    });

    it('throws APIError when required field is empty string', () => {
      const params = { name: 'test', email: '' };
      const requiredFields = ['name', 'email'];
      
      expect(() => {
        validateRequired(params, requiredFields);
      }).toThrow('Missing required parameter: email');
    });

    it('handles empty required fields array', () => {
      const params = { name: 'test' };
      const requiredFields: string[] = [];
      
      expect(() => {
        validateRequired(params, requiredFields);
      }).not.toThrow();
    });
  });

  describe('validateMethod', () => {
    it('passes validation when method is allowed', () => {
      const { req } = createMockReqRes({ method: 'POST' });
      const allowedMethods = ['GET', 'POST'];
      
      expect(() => {
        validateMethod(req, allowedMethods);
      }).not.toThrow();
    });

    it('throws APIError when method is not allowed', () => {
      const { req } = createMockReqRes({ method: 'DELETE' });
      const allowedMethods = ['GET', 'POST'];
      
      expect(() => {
        validateMethod(req, allowedMethods);
      }).toThrow('Method DELETE not allowed');
      
      try {
        validateMethod(req, allowedMethods);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).name).toBe('APIError');
        expect((error as any).statusCode).toBe(405);
        expect((error as Error).message).toBe('Method DELETE not allowed');
      }
    });

    it('throws APIError when method is undefined', () => {
      const { req } = createMockReqRes();
      delete (req as any).method;
      const allowedMethods = ['GET', 'POST'];
      
      expect(() => {
        validateMethod(req, allowedMethods);
      }).toThrow('Method undefined not allowed');
    });
  });

  describe('parseIntParam', () => {
    it('parses valid integer string', () => {
      const result = parseIntParam('123', 'page');
      expect(result).toBe(123);
    });

    it('parses integer from array', () => {
      const result = parseIntParam(['456', '789'], 'limit');
      expect(result).toBe(456);
    });

    it('returns default value when parameter is undefined', () => {
      const result = parseIntParam(undefined, 'page', 1);
      expect(result).toBe(1);
    });

    it('throws APIError when parameter is missing and no default', () => {
      expect(() => {
        parseIntParam(undefined, 'page');
      }).toThrow('Missing required parameter: page');
    });

    it('throws APIError when parameter is not a valid number', () => {
      expect(() => {
        parseIntParam('abc', 'page');
      }).toThrow('Invalid page: must be a number');
    });

    it('throws APIError when parameter is empty string', () => {
      expect(() => {
        parseIntParam('', 'page');
      }).toThrow('Missing required parameter: page');
    });

    it('parses negative integers', () => {
      const result = parseIntParam('-5', 'offset');
      expect(result).toBe(-5);
    });

    it('parses zero', () => {
      const result = parseIntParam('0', 'count');
      expect(result).toBe(0);
    });
  });

  describe('parseStringParam', () => {
    it('returns string parameter', () => {
      const result = parseStringParam('hello', 'name');
      expect(result).toBe('hello');
    });

    it('returns first element from array', () => {
      const result = parseStringParam(['first', 'second'], 'query');
      expect(result).toBe('first');
    });

    it('returns default value when parameter is undefined', () => {
      const result = parseStringParam(undefined, 'category', 'all');
      expect(result).toBe('all');
    });

    it('throws APIError when parameter is missing and no default', () => {
      expect(() => {
        parseStringParam(undefined, 'query');
      }).toThrow('Missing required parameter: query');
    });

    it('handles empty string parameter', () => {
      const result = parseStringParam('', 'search', 'default');
      expect(result).toBe('default');
    });

    it('handles empty array parameter', () => {
      const result = parseStringParam([], 'search');
      expect(result).toBeUndefined();
    });

    it('handles whitespace-only strings', () => {
      const result = parseStringParam('   ', 'name');
      expect(result).toBe('   ');
    });
  });
});