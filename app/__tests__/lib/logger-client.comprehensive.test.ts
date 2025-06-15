import { logClientError } from '@/lib/logger-client';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location and navigator
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test-page'
  },
  writable: true
});

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Test Browser)',
  writable: true
});

// Mock console.error to verify fallback behavior
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('logger-client Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('logClientError basic functionality', () => {
    it('logs Error object with all parameters', () => {
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n    at test';
      const component = 'TestComponent';
      const context = { userId: '123', action: 'button_click' };

      logClientError(error, component, context);

      expect(global.fetch).toHaveBeenCalledWith('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: 'Client Error: Test error message',
          context: {
            component: 'TestComponent',
            error: 'Test error message',
            stack: 'Error: Test error message\n    at test',
            url: 'http://localhost:3000/test-page',
            userAgent: 'Mozilla/5.0 (Test Browser)',
            metadata: { userId: '123', action: 'button_click' },
          },
        }),
      });
    });

    it('logs string error message', () => {
      const errorMessage = 'String error message';
      const component = 'TestComponent';

      logClientError(errorMessage, component);

      expect(global.fetch).toHaveBeenCalledWith('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: 'Client Error: String error message',
          context: {
            component: 'TestComponent',
            error: 'String error message',
            stack: undefined,
            url: 'http://localhost:3000/test-page',
            userAgent: 'Mozilla/5.0 (Test Browser)',
            metadata: undefined,
          },
        }),
      });
    });

    it('logs error with minimal parameters (only error)', () => {
      const error = new Error('Minimal error');

      logClientError(error);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/logs', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }));
      
      expect(requestBody).toEqual({
        level: 'error',
        message: 'Client Error: Minimal error',
        context: {
          component: undefined,
          error: 'Minimal error',
          stack: expect.any(String),
          url: 'http://localhost:3000/test-page',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          metadata: undefined,
        },
      });
    });

    it('handles Error object without stack property', () => {
      const error = new Error('Error without stack');
      delete (error as any).stack;

      logClientError(error, 'TestComponent');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.stack).toBeUndefined();
      expect(requestBody.context.error).toBe('Error without stack');
    });

    it('includes current URL and user agent in context', () => {
      const error = new Error('Test error');

      logClientError(error);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.url).toBe('http://localhost:3000/test-page');
      expect(requestBody.context.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    });
  });

  describe('error handling and fallback behavior', () => {
    it('falls back to console logging when fetch fails', async () => {
      const fetchError = new Error('Network error');
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(fetchError);

      const originalError = new Error('Original error');
      logClientError(originalError, 'TestComponent');

      // Wait for fetch promise to reject
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to log client error:', fetchError);
      expect(mockConsoleError).toHaveBeenCalledWith('Original error:', originalError);
    });

    it('falls back to console logging when fetch response is not ok', async () => {
      const fetchError = new Error('Server error');
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(fetchError);

      const stringError = 'String error message';
      logClientError(stringError);

      // Wait for fetch promise to reject
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to log client error:', fetchError);
      expect(mockConsoleError).toHaveBeenCalledWith('Original error:', stringError);
    });

    it('handles fetch rejection without throwing', () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Fetch failed'));

      // Should not throw
      expect(() => {
        logClientError(new Error('Test error'));
      }).not.toThrow();
    });
  });

  describe('parameter variations and edge cases', () => {
    it('handles empty component name', () => {
      const error = new Error('Test error');
      logClientError(error, '');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.component).toBe('');
    });

    it('handles complex context objects', () => {
      const error = new Error('Test error');
      const complexContext = {
        user: { id: 123, name: 'Test User' },
        action: 'form_submit',
        formData: { field1: 'value1', field2: 'value2' },
        timestamp: new Date().toISOString(),
        nested: { deep: { value: 'nested data' } }
      };

      logClientError(error, 'FormComponent', complexContext);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.metadata).toEqual(complexContext);
    });

    it('handles null context', () => {
      const error = new Error('Test error');
      logClientError(error, 'TestComponent', null as any);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.metadata).toBeNull();
    });

    it('handles undefined context', () => {
      const error = new Error('Test error');
      logClientError(error, 'TestComponent', undefined);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.metadata).toBeUndefined();
    });

    it('handles empty string error', () => {
      logClientError('', 'TestComponent');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.message).toBe('Client Error: ');
      expect(requestBody.context.error).toBe('');
    });
  });

  describe('request format validation', () => {
    it('sends correct HTTP method and headers', () => {
      logClientError(new Error('Test error'));

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/logs',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('sends valid JSON in request body', () => {
      const error = new Error('Test error');
      error.stack = 'Test stack trace';

      logClientError(error, 'TestComponent', { test: 'data' });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const bodyString = fetchCall[1]?.body as string;
      
      // Should be valid JSON
      expect(() => JSON.parse(bodyString)).not.toThrow();
      
      const parsedBody = JSON.parse(bodyString);
      expect(parsedBody).toHaveProperty('level', 'error');
      expect(parsedBody).toHaveProperty('message');
      expect(parsedBody).toHaveProperty('context');
      expect(parsedBody.context).toHaveProperty('component');
      expect(parsedBody.context).toHaveProperty('error');
      expect(parsedBody.context).toHaveProperty('stack');
      expect(parsedBody.context).toHaveProperty('url');
      expect(parsedBody.context).toHaveProperty('userAgent');
      expect(parsedBody.context).toHaveProperty('metadata');
    });

    it('always sends to /api/logs endpoint', () => {
      logClientError(new Error('Test error'));

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/logs',
        expect.any(Object)
      );
    });
  });

  describe('different error types', () => {
    it('handles TypeError objects', () => {
      const error = new TypeError('Type error message');
      logClientError(error, 'TestComponent');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.error).toBe('Type error message');
      expect(requestBody.message).toBe('Client Error: Type error message');
    });

    it('handles ReferenceError objects', () => {
      const error = new ReferenceError('Reference error message');
      logClientError(error, 'TestComponent');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.error).toBe('Reference error message');
    });

    it('handles custom Error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string, public code: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message', 'CUSTOM_001');
      logClientError(error, 'TestComponent');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.error).toBe('Custom error message');
      expect(requestBody.message).toBe('Client Error: Custom error message');
    });
  });

  describe('browser environment handling', () => {
    it('handles different URL formats', () => {
      // Test with query parameters
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/search?q=test&page=2' },
        writable: true
      });

      logClientError(new Error('Test error'));

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.url).toBe('https://example.com/search?q=test&page=2');
    });

    it('handles different user agent strings', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true
      });

      logClientError(new Error('Test error'));

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.context.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    });
  });
});