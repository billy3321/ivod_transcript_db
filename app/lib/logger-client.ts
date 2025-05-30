/**
 * Client-side logging utility for the IVOD transcript web application
 * Provides error logging that sends data to server-side API
 */

// Helper function for client-side logging
export function logClientError(
  error: Error | string, 
  component?: string, 
  context?: Record<string, any>
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;

  // Send to API endpoint for server-side logging
  fetch('/api/logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      level: 'error',
      message: `Client Error: ${errorMessage}`,
      context: {
        component,
        error: errorMessage,
        stack: errorStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metadata: context,
      },
    }),
  }).catch(err => {
    // Fallback to console if API call fails
    console.error('Failed to log client error:', err);
    console.error('Original error:', error);
  });
}