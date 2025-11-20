"use client";
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-dex-bg p-6">
          <div className="max-w-md w-full bg-dex-surface rounded border border-dex-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-dex-danger/20 flex items-center justify-center">
                <span className="text-dex-danger text-xl">⚠</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
            </div>
            <p className="text-sm text-slate-400">
              The application encountered an unexpected error. Please refresh the page or contact support if this persists.
            </p>
            {this.state.error && (
              <details className="text-xs text-slate-500 bg-dex-bg rounded p-3">
                <summary className="cursor-pointer">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 rounded bg-dex-accent text-white text-sm font-medium hover:bg-dex-accentAlt transition"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
