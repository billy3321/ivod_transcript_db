import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Mock the logger-client
jest.mock('@/lib/logger-client', () => ({
  logClientError: jest.fn(),
}));

import { logClientError } from '@/lib/logger-client';
const mockLogClientError = logClientError as jest.MockedFunction<typeof logClientError>;

// Mock console methods to avoid noise in test output
const mockConsoleGroup = jest.spyOn(console, 'group').mockImplementation();
const mockConsoleGroupEnd = jest.spyOn(console, 'groupEnd').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Test component that throws an error
const ThrowError = ({ shouldError }: { shouldError: boolean }) => {
  if (shouldError) {
    throw new Error('Test error message');
  }
  return <div>All good!</div>;
};

// Test component with detailed error
const ThrowDetailedError = ({ shouldError }: { shouldError: boolean }) => {
  if (shouldError) {
    const error = new Error('Detailed test error');
    error.stack = 'Error: Detailed test error\n    at ThrowDetailedError\n    at TestComponent';
    throw error;
  }
  return <div>Working component</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset NODE_ENV to test for each test
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    mockConsoleGroup.mockRestore();
    mockConsoleGroupEnd.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('does not call error logging when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('All good!')).toBeInTheDocument();
      expect(mockLogClientError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('renders default error UI when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('發生錯誤')).toBeInTheDocument();
      expect(screen.getByText('應用程式遇到未預期的錯誤')).toBeInTheDocument();
      expect(screen.getByText('錯誤訊息：')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders custom fallback UI when provided', () => {
      const customFallback = <div>Custom error UI</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('發生錯誤')).not.toBeInTheDocument();
    });

    it('calls logClientError when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(mockLogClientError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error message'
        }),
        'ErrorBoundary',
        expect.objectContaining({
          componentStack: expect.any(String),
          errorMessage: 'Test error message',
          errorStack: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('logs error details to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(mockConsoleGroup).toHaveBeenCalledWith('🚨 ErrorBoundary caught an error:');
      expect(mockConsoleError).toHaveBeenCalledWith('Error:', expect.any(Error));
      expect(mockConsoleError).toHaveBeenCalledWith('Error Info:', expect.any(Object));
      expect(mockConsoleError).toHaveBeenCalledWith('Component Stack:', expect.any(String));
      expect(mockConsoleGroupEnd).toHaveBeenCalled();
    });
  });

  describe('Development Mode Features', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('shows detailed error information in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowDetailedError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('詳細錯誤資訊 (開發模式)')).toBeInTheDocument();
      
      // Check if details element is present (can be expanded)
      const detailsElement = screen.getByRole('group');
      expect(detailsElement.tagName).toBe('DETAILS');
    });

    it('does not show detailed error information in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      render(
        <ErrorBoundary>
          <ThrowDetailedError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('詳細錯誤資訊 (開發模式)')).not.toBeInTheDocument();
    });

    it('displays error stack in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowDetailedError shouldError={true} />
        </ErrorBoundary>
      );

      // The stack trace should be in the document
      expect(screen.getByText(/Error: Detailed test error/)).toBeInTheDocument();
    });
  });

  describe('Error UI Components', () => {
    beforeEach(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );
    });

    it('displays error icon', () => {
      const svgIcon = document.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
      expect(svgIcon).toHaveClass('h-12', 'w-12', 'text-red-500');
    });

    it('displays error message in proper container', () => {
      const errorMessage = screen.getByText('Test error message');
      expect(errorMessage.tagName).toBe('CODE');
      expect(errorMessage).toHaveClass('text-sm', 'text-red-700', 'font-mono');
    });

    it('has proper styling structure', () => {
      const container = screen.getByText('發生錯誤').closest('div[class*="min-h-screen"]');
      expect(container).toHaveClass('min-h-screen flex items-center justify-center bg-gray-50');
    });

    it('displays reload button', () => {
      const reloadButton = screen.getByRole('button', { name: '重新載入頁面' });
      expect(reloadButton).toBeInTheDocument();
      expect(reloadButton).toHaveClass('bg-indigo-600', 'text-white');
    });
  });

  describe('Error Information Structure', () => {
    it('preserves error object properties', () => {
      const customError = new Error('Custom error with properties');
      (customError as any).customProperty = 'test value';
      
      const ThrowCustomError = () => {
        throw customError;
      };

      render(
        <ErrorBoundary>
          <ThrowCustomError />
        </ErrorBoundary>
      );

      expect(mockLogClientError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom error with properties'
        }),
        'ErrorBoundary',
        expect.any(Object)
      );
    });

    it('handles error without stack trace', () => {
      const errorWithoutStack = new Error('Error without stack');
      delete (errorWithoutStack as any).stack;
      
      const ThrowStacklessError = () => {
        throw errorWithoutStack;
      };

      render(
        <ErrorBoundary>
          <ThrowStacklessError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error without stack')).toBeInTheDocument();
      expect(mockLogClientError).toHaveBeenCalled();
    });

    it('includes timestamp in error context', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      const call = mockLogClientError.mock.calls[0];
      const context = call[2];
      expect(context.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );
    });

    it('has proper heading structure', () => {
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('發生錯誤');
      
      const subHeading = screen.getByRole('heading', { level: 2 });
      expect(subHeading).toHaveTextContent('錯誤訊息：');
    });

    it('uses semantic HTML elements', () => {
      // Error message should be in a code element for screen readers
      const codeElement = screen.getByText('Test error message');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('provides meaningful alt text for SVG icon', () => {
      const svgIcon = document.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles multiple errors gracefully', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldError={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('All good!')).toBeInTheDocument();

      rerender(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('發生錯誤')).toBeInTheDocument();
    });

    it('handles null/undefined children', () => {
      render(
        <ErrorBoundary>
          {null}
          {undefined}
          <div>Valid content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Valid content')).toBeInTheDocument();
    });

    it('handles empty error message', () => {
      const EmptyError = () => {
        throw new Error('');
      };

      render(
        <ErrorBoundary>
          <EmptyError />
        </ErrorBoundary>
      );

      expect(screen.getByText('錯誤訊息：')).toBeInTheDocument();
      // Empty message should still be rendered (even if empty)
      const codeElement = screen.getByText('錯誤訊息：').closest('div')?.querySelector('code');
      expect(codeElement).toBeInTheDocument();
    });
  });
});