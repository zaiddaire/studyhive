import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Spinner, EmptyState } from '@/components/ui/Feedback'
import { ButtonLink } from '@/components/ui/Button'

/** Client-side guard for UX only; every protected endpoint is also enforced by the backend. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <Spinner label="Checking your session" />
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth()
  const location = useLocation()
  if (isLoading) return <Spinner label="Checking your session" />
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (!isAdmin) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<ShieldAlert className="size-6" aria-hidden />}
          title="Administrators only"
          description="Your account does not have access to the admin area."
          action={<ButtonLink to="/dashboard">Go to my dashboard</ButtonLink>}
        />
      </div>
    )
  }
  return <>{children}</>
}

/** Keeps signed-in users away from the login/sign-up pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner label="Checking your session" />
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  return <>{children}</>
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeRedirect(value: string | null, fallback: string): string {
  if (!value) return fallback
  const decoded = decodeURIComponent(value)
  return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : fallback
}
