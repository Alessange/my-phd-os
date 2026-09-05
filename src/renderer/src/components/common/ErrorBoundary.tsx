import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { logError } from '@renderer/lib/log'
import { ErrorState } from './ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Rendered instead of the default full-page error state. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error?: Error
}

/** Catches render errors, logs them locally and offers reload / retry. Data is never touched. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError('Renderer crashed', error, { componentStack: info.componentStack ?? undefined })
  }

  reset = (): void => this.setState({ error: undefined })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-background p-6">
        <ErrorState
          error={error}
          title="The interface hit an unexpected error"
          onRetry={this.reset}
          retryLabel="Try again"
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload window
          </Button>
        </ErrorState>
      </div>
    )
  }
}
