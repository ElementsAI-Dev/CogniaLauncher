'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle: string;
  fallbackDescription: string;
  retryLabel: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary component for the environments page.
 * Catches JavaScript errors in child components and displays a fallback UI.
 */
export class EnvironmentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('EnvironmentErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {this.props.fallbackTitle}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>
                {this.props.fallbackDescription}
              </p>
              {this.state.error && (
                <div className="p-3 rounded-md bg-muted/50 font-mono text-xs text-muted-foreground overflow-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
              <Button 
                onClick={this.handleRetry} 
                variant="outline" 
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {this.props.retryLabel}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component for individual environment cards.
 * Prevents a single card error from breaking the entire page.
 * Accepts optional translation function to support i18n.
 */
export function EnvironmentCardErrorBoundary({ 
  children, 
  envType,
  t,
}: { 
  children: ReactNode; 
  envType: string;
  t?: (key: string) => string;
}) {
  // Use translations if available, otherwise fallback to English
  const fallbackTitle = t 
    ? t('environments.errorBoundary.cardTitle').replace('{envType}', envType)
    : `Error loading ${envType}`;
  const fallbackDescription = t
    ? t('environments.errorBoundary.cardDescription').replace('{envType}', envType)
    : `Failed to render the ${envType} environment card.`;
  const retryLabel = t ? t('environments.errorBoundary.tryAgain') : 'Try Again';

  return (
    <EnvironmentErrorBoundary
      fallbackTitle={fallbackTitle}
      fallbackDescription={fallbackDescription}
      retryLabel={retryLabel}
    >
      {children}
    </EnvironmentErrorBoundary>
  );
}
