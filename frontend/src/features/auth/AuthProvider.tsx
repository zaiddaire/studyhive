import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, resetCsrfToken, retryDelay, shouldRetry } from '@/lib/api'
import { authApi, queryKeys } from '@/services'
import type { User } from '@/types/api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
  /** Store the user returned by login/registration and refresh session-scoped caches. */
  signedIn: (user: User) => void
  signOut: () => Promise<void>
  refresh: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** The session lives in an HTTP-only cookie; the current user is simply GET /api/auth/me (401 = signed out). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
    retryDelay,
  })

  const signedIn = useCallback(
    (user: User) => {
      resetCsrfToken()
      queryClient.setQueryData(queryKeys.me, user)
      queryClient.removeQueries({ queryKey: ['my-bookings'] })
      queryClient.removeQueries({ queryKey: ['admin'] })
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      resetCsrfToken()
      queryClient.setQueryData(queryKeys.me, null)
      queryClient.removeQueries({ queryKey: ['my-bookings'] })
      queryClient.removeQueries({ queryKey: ['booking'] })
      queryClient.removeQueries({ queryKey: ['admin'] })
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending,
      isAdmin: meQuery.data?.role === 'ADMIN',
      signedIn,
      signOut,
      refresh: () => meQuery.refetch(),
    }),
    [meQuery, signedIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
