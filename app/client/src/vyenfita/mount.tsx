/**
 * VYENFITA Mount Point
 * 
 * Self-contained mount with error boundary.
 * 
 * @version 1.0.0
 */

import React, { Component, ReactNode } from 'react';
import VYENFITARoutes from './routes';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class VYENFITAErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[VYENFITA] Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            background: '#f5f6fa',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2
            style={{ fontSize: '20px', marginBottom: '8px', color: '#333' }}
          >
            VYENFITA encountered an error
          </h2>
          <p
            style={{
              color: '#666',
              marginBottom: '24px',
              maxWidth: '500px',
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function VYENFITAMount() {
  return (
    <VYENFITAErrorBoundary>
      <VYENFITARoutes />
    </VYENFITAErrorBoundary>
  );
}
