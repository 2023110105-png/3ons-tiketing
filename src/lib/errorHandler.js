import React from 'react';

// Global Error Handler - Catch and log all errors
export class AppError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export function handleError(error, context = '') {
  const errorInfo = {
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  };
  
  console.error('[ErrorHandler]', context, errorInfo);
  
  // Send to error tracking service (optional)
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', 'exception', { description: errorInfo.message });
  // }
  
  return errorInfo;
}

export function safeAsync(fn, errorMessage = 'Operation failed') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, errorMessage);
      throw error;
    }
  };
}

export function safeCall(fn, defaultValue = null) {
  try {
    return fn();
  } catch (error) {
    handleError(error, 'Safe call failed');
    return defaultValue;
  }
}

export function withLoading(setLoading, fn) {
  return async (...args) => {
    setLoading(true);
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      handleError(error, 'Loading operation failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };
}

export function createErrorBoundary(componentName) {
  return class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      handleError(error, `ErrorBoundary: ${componentName}`);
      console.error('Component stack:', errorInfo.componentStack);
    }
    
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: 20, background: '#fee', borderRadius: 8 }}>
            <h3>Something went wrong in {componentName}</h3>
            <p>{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        );
      }
      return this.props.children;
    }
  };
}

export default {
  AppError,
  handleError,
  safeAsync,
  safeCall,
  withLoading,
  createErrorBoundary
};
