import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { retryDelay, shouldRetry } from '@/lib/api'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { PublicLayout, ScrollManager } from '@/components/layout/PublicLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Spinner } from '@/components/ui/Feedback'
import { ServerWakeNotice } from '@/components/ServerWakeNotice'
import { GuestOnly, RequireAdmin, RequireAuth } from '@/routes/guards'
import { LandingPage } from '@/features/landing/LandingPage'

// Public, frequently visited pages load eagerly; account and admin areas are split into separate chunks.
const RoomsPage = lazy(() => import('@/features/rooms/RoomsPage'))
const RoomDetailPage = lazy(() => import('@/features/rooms/RoomDetailPage'))
const BookingFlowPage = lazy(() => import('@/features/bookings/BookingFlowPage'))
const BookingDetailPage = lazy(() => import('@/features/bookings/BookingDetailPage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const ProfilePage = lazy(() => import('@/features/auth/ProfilePage'))
const DashboardPage = lazy(() => import('@/features/student-dashboard/DashboardPage'))
const AboutPage = lazy(() => import('@/features/landing/AboutPage'))
const LegalPage = lazy(() => import('@/features/landing/LegalPage'))
const NotFoundPage = lazy(() => import('@/features/landing/NotFoundPage'))
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminOverviewPage = lazy(() => import('@/features/admin/AdminOverviewPage'))
const AdminRoomsPage = lazy(() => import('@/features/admin/AdminRoomsPage'))
const AdminRoomFormPage = lazy(() => import('@/features/admin/AdminRoomFormPage'))
const AdminBookingsPage = lazy(() => import('@/features/admin/AdminBookingsPage'))
const AdminSchedulePage = lazy(() => import('@/features/admin/AdminSchedulePage'))
const AdminUsersPage = lazy(() => import('@/features/admin/AdminUsersPage'))

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry client errors (4xx); wait out a sleeping free-tier API; retry other failures briefly.
      retry: shouldRetry,
      retryDelay,
    },
    mutations: { retry: false },
  },
})

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

function AppRoutes() {
  return (
    <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Page><LandingPage /></Page>} />
          <Route path="rooms" element={<Page><RoomsPage /></Page>} />
          <Route path="rooms/:id" element={<Page><RoomDetailPage /></Page>} />
          <Route path="rooms/:id/book" element={<Page><RequireAuth><BookingFlowPage /></RequireAuth></Page>} />
          <Route path="bookings/:id" element={<Page><RequireAuth><BookingDetailPage /></RequireAuth></Page>} />
          <Route path="dashboard" element={<Page><RequireAuth><DashboardPage /></RequireAuth></Page>} />
          <Route path="profile" element={<Page><RequireAuth><ProfilePage /></RequireAuth></Page>} />
          <Route path="login" element={<Page><GuestOnly><LoginPage /></GuestOnly></Page>} />
          <Route path="signup" element={<Page><GuestOnly><RegisterPage /></GuestOnly></Page>} />
          <Route path="forgot-password" element={<Page><ForgotPasswordPage /></Page>} />
          <Route path="reset-password" element={<Page><ResetPasswordPage /></Page>} />
          <Route path="about" element={<Page><AboutPage /></Page>} />
          <Route path="privacy" element={<Page><LegalPage kind="privacy" /></Page>} />
          <Route path="terms" element={<Page><LegalPage kind="terms" /></Page>} />
          <Route path="*" element={<Page><NotFoundPage /></Page>} />
        </Route>
        <Route
          path="admin"
          element={
            <Suspense fallback={<Spinner />}>
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            </Suspense>
          }
        >
          <Route index element={<Page><AdminOverviewPage /></Page>} />
          <Route path="rooms" element={<Page><AdminRoomsPage /></Page>} />
          <Route path="rooms/new" element={<Page><AdminRoomFormPage /></Page>} />
          <Route path="rooms/:id" element={<Page><AdminRoomFormPage /></Page>} />
          <Route path="bookings" element={<Page><AdminBookingsPage /></Page>} />
          <Route path="schedule" element={<Page><AdminSchedulePage /></Page>} />
          <Route path="users" element={<Page><AdminUsersPage /></Page>} />
        </Route>
    </Routes>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <AuthProvider>
              <ScrollManager />
              <ServerWakeNotice />
              <AppRoutes />
              <Toaster
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast: '!rounded-[12px] !border-line !bg-card !text-ink !shadow-panel !font-sans',
                    description: '!text-muted',
                  },
                }}
              />
            </AuthProvider>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
