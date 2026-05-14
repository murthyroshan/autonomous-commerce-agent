'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console so errors are visible during development
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            className="p-4 rounded-xl border font-mono text-sm"
            style={{
              borderColor: 'rgba(255,77,77,0.2)',
              background: 'rgba(255,77,77,0.06)',
              color: '#ff4d4d',
            }}
          >
            Something went wrong loading this component.
          </div>
        )
      )
    }
    return this.props.children
  }
}
