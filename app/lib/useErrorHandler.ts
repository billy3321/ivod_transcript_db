import { useCallback } from 'react';
import { logClientError } from './logger-client';

export interface UseErrorHandlerOptions {
  component?: string;
  defaultErrorMessage?: string;
  onError?: (error: Error) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    component = 'Unknown',
    defaultErrorMessage = '發生未預期的錯誤',
    onError
  } = options;

  const handleError = useCallback((
    error: Error | string,
    context?: Record<string, any>,
    showToUser = true
  ) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    // Log to server
    logClientError(errorObj, component, {
      ...context,
      showToUser,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    if (onError) {
      onError(errorObj);
    }

    // Show user-friendly error message if needed
    if (showToUser && typeof window !== 'undefined') {
      // You could integrate with a toast notification system here
      console.error(`${component}: ${errorObj.message}`);
    }

    return errorObj;
  }, [component, onError]);

  const handleAsyncError = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T | null> => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error as Error, {
        ...context,
        operation: 'async'
      });
      return null;
    }
  }, [handleError]);

  const wrapEventHandler = useCallback(<T extends (...args: any[]) => any>(
    handler: T,
    context?: Record<string, any>
  ): T => {
    return ((...args: Parameters<T>) => {
      try {
        const result = handler(...args);
        
        // Handle async event handlers
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            handleError(error, {
              ...context,
              operation: 'event_handler_async'
            });
          });
        }
        
        return result;
      } catch (error) {
        handleError(error as Error, {
          ...context,
          operation: 'event_handler_sync'
        });
      }
    }) as T;
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    wrapEventHandler
  };
}