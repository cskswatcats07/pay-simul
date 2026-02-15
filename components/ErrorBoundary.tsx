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

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = 'An error occurred'
      try {
        errorMessage = this.state.error?.message ?? errorMessage
      } catch {
        // ignore serialization issues
      }
      return this.props.fallback ?? (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
            <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">Something went wrong</h1>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
