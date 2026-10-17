import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LogoMark } from './ui/Logo'

interface State {
  hasError: boolean
}

/** Last-resort boundary so an unexpected rendering error shows a calm recovery screen, not a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <LogoMark className="size-12" />
        <h1 className="display text-3xl">Something went off-script</h1>
        <p className="max-w-md text-muted">An unexpected error stopped this page from loading. Your bookings are safe.</p>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="mt-2 rounded-[10px] bg-sage-700 px-5 py-2.5 font-medium text-white hover:bg-sage-800"
        >
          Back to StudyHive
        </button>
      </main>
    )
  }
}
