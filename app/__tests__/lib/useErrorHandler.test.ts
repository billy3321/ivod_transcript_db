import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '@/lib/useErrorHandler';

// Mock the logger-client
jest.mock('@/lib/logger-client', () => ({
  logClientError: jest.fn(),
}));

import { logClientError } from '@/lib/logger-client';
const mockLogClientError = logClientError as jest.MockedFunction<typeof logClientError>;

// Mock fetch
global.fetch = jest.fn();

describe('useErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
    } as Response);
  });

  it('should handle errors with default options', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogClientError).toHaveBeenCalledWith(
      error,
      'Unknown',
      expect.objectContaining({
        showToUser: true,
        timestamp: expect.any(String),
      })
    );
  });

  it('should handle errors with custom component name', () => {
    const { result } = renderHook(() => 
      useErrorHandler({ component: 'TestComponent' })
    );
    const error = new Error('Test error');

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogClientError).toHaveBeenCalledWith(
      error,
      'TestComponent',
      expect.any(Object)
    );
  });

  it('should handle string errors by converting to Error objects', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError('String error message');
    });

    expect(mockLogClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'String error message',
      }),
      'Unknown',
      expect.any(Object)
    );
  });

  it('should call custom onError callback', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => 
      useErrorHandler({ onError })
    );
    const error = new Error('Test error');

    act(() => {
      result.current.handleError(error);
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should include additional context in error logging', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');
    const context = { userId: '123', action: 'button_click' };

    act(() => {
      result.current.handleError(error, context);
    });

    expect(mockLogClientError).toHaveBeenCalledWith(
      error,
      'Unknown',
      expect.objectContaining({
        ...context,
        showToUser: true,
        timestamp: expect.any(String),
      })
    );
  });

  describe('handleAsyncError', () => {
    it('should handle successful async operations', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const successfulOperation = jest.fn().mockResolvedValue('success');

      const returnValue = await act(async () => {
        return result.current.handleAsyncError(successfulOperation);
      });

      expect(returnValue).toBe('success');
      expect(successfulOperation).toHaveBeenCalled();
      expect(mockLogClientError).not.toHaveBeenCalled();
    });

    it('should handle failed async operations', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Async error');
      const failingOperation = jest.fn().mockRejectedValue(error);

      const returnValue = await act(async () => {
        return result.current.handleAsyncError(failingOperation);
      });

      expect(returnValue).toBeNull();
      expect(failingOperation).toHaveBeenCalled();
      expect(mockLogClientError).toHaveBeenCalledWith(
        error,
        'Unknown',
        expect.objectContaining({
          operation: 'async',
        })
      );
    });

    it('should include additional context in async error handling', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Async error');
      const failingOperation = jest.fn().mockRejectedValue(error);
      const context = { requestId: 'req-123' };

      await act(async () => {
        return result.current.handleAsyncError(failingOperation, context);
      });

      expect(mockLogClientError).toHaveBeenCalledWith(
        error,
        'Unknown',
        expect.objectContaining({
          ...context,
          operation: 'async',
        })
      );
    });
  });

  describe('wrapEventHandler', () => {
    it('should wrap synchronous event handlers', () => {
      const { result } = renderHook(() => useErrorHandler());
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const wrappedHandler = result.current.wrapEventHandler(handler);

      act(() => {
        wrappedHandler('arg1', 'arg2');
      });

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockLogClientError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Handler error',
        }),
        'Unknown',
        expect.objectContaining({
          operation: 'event_handler_sync',
        })
      );
    });

    it('should wrap asynchronous event handlers', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Async handler error');
      const handler = jest.fn().mockRejectedValue(error);

      const wrappedHandler = result.current.wrapEventHandler(handler);

      await act(async () => {
        await wrappedHandler('arg1', 'arg2');
      });

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockLogClientError).toHaveBeenCalledWith(
        error,
        'Unknown',
        expect.objectContaining({
          operation: 'event_handler_async',
        })
      );
    });

    it('should include context in wrapped event handlers', () => {
      const { result } = renderHook(() => useErrorHandler());
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const context = { buttonId: 'submit-btn' };

      const wrappedHandler = result.current.wrapEventHandler(handler, context);

      act(() => {
        wrappedHandler();
      });

      expect(mockLogClientError).toHaveBeenCalledWith(
        expect.any(Error),
        'Unknown',
        expect.objectContaining({
          ...context,
          operation: 'event_handler_sync',
        })
      );
    });

    it('should return result from successful handlers', () => {
      const { result } = renderHook(() => useErrorHandler());
      const handler = jest.fn().mockReturnValue('handler result');

      const wrappedHandler = result.current.wrapEventHandler(handler);

      let returnValue: any;
      act(() => {
        returnValue = wrappedHandler('test');
      });

      expect(returnValue).toBe('handler result');
      expect(handler).toHaveBeenCalledWith('test');
      expect(mockLogClientError).not.toHaveBeenCalled();
    });
  });
});