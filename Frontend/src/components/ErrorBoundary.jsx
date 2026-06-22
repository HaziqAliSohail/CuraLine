import { Component } from 'react'

/**
 * Catches render-time errors anywhere in the tree and shows a recoverable
 * fallback instead of a white screen. In production builds React does not
 * expose component stacks to the user, so nothing sensitive is shown.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Hook for an error-reporting service (e.g. Sentry) later.
    // Intentionally not console.logging PII-bearing props.
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
          <div className="card max-w-sm w-full text-center py-10">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <button onClick={this.handleReload} className="btn-primary mt-6">
              Reload CuraLine
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
