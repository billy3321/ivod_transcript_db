import React, { Component, ReactNode } from 'react'
import { logClientError } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.group('🚨 ErrorBoundary caught an error:')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Component Stack:', errorInfo.componentStack)
    console.groupEnd()
    
    // Send error to server for logging
    logClientError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    })
    
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h1 className="text-lg font-medium text-gray-900">
                  發生錯誤
                </h1>
                <p className="text-sm text-gray-500">
                  應用程式遇到未預期的錯誤
                </p>
              </div>
            </div>
            
            {this.state.error && (
              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-900 mb-2">錯誤訊息：</h2>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <code className="text-sm text-red-700 font-mono">
                    {this.state.error.message}
                  </code>
                </div>
              </div>
            )}
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4">
                <summary className="text-sm font-medium text-gray-900 cursor-pointer">
                  詳細錯誤資訊 (開發模式)
                </summary>
                <div className="mt-2 bg-gray-100 border rounded p-3">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-auto max-h-40">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <p className="text-xs font-medium text-gray-700 mb-1">Component Stack:</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                重新載入頁面
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                重試
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary