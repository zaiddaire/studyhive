import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from './DashboardPage'
import { booking, config, mockApi, renderApp, student } from '@/test/utils'

const page = (content: unknown[]) => ({ content, page: 0, size: 6, totalElements: content.length, totalPages: content.length ? 1 : 0 })

describe('DashboardPage', () => {
  it('shows the next session, counts and upcoming bookings from the API', async () => {
    mockApi({
      'GET /api/auth/me': { body: student },
      'GET /api/config': { body: config },
      'GET /api/bookings/my/summary': { body: { upcomingCount: 1, pastCount: 4, cancelledCount: 2, nextBooking: booking() } },
      'GET /api/bookings/my': { body: page([booking()]) },
    })
    renderApp(<DashboardPage />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: /Asha\./ })).toBeInTheDocument()
    expect(await screen.findByText(/Next session tomorrow/)).toBeInTheDocument()
    expect(screen.getAllByText('SH-7KQ3PA').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: /History/ })).toHaveTextContent('4')
  })

  it('shows a friendly empty state for new students', async () => {
    mockApi({
      'GET /api/auth/me': { body: student },
      'GET /api/config': { body: config },
      'GET /api/bookings/my/summary': { body: { upcomingCount: 0, pastCount: 0, cancelledCount: 0 } },
      'GET /api/bookings/my': { body: page([]) },
    })
    renderApp(<DashboardPage />, { route: '/dashboard' })
    expect(await screen.findByText('Your calendar is wide open')).toBeInTheDocument()
    expect(await screen.findByText('No upcoming sessions')).toBeInTheDocument()
  })

  it('asks for confirmation before cancelling, then cancels via the API', async () => {
    let cancelled = false
    const api = mockApi({
      'GET /api/auth/me': { body: student },
      'GET /api/config': { body: config },
      'GET /api/bookings/my/summary': () => ({ body: { upcomingCount: cancelled ? 0 : 1, pastCount: 0, cancelledCount: cancelled ? 1 : 0 } }),
      'GET /api/bookings/my': () => ({ body: page(cancelled ? [] : [booking()]) }),
      'POST /api/bookings/11/cancel': () => {
        cancelled = true
        return { body: booking({ status: 'CANCELLED', cancellable: false, cancellationReason: 'Exam moved' }) }
      },
    })
    renderApp(<DashboardPage />, { route: '/dashboard' })
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Cancel this booking?')).toBeInTheDocument()
    expect(api.calls.some((c) => c.path.endsWith('/cancel'))).toBe(false)

    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Exam moved')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    await waitFor(() => expect(api.calls.some((c) => c.path === '/api/bookings/11/cancel')).toBe(true))
    expect(api.calls.find((c) => c.path === '/api/bookings/11/cancel')!.body).toEqual({ reason: 'Exam moved' })
    expect(await screen.findByText('No upcoming sessions')).toBeInTheDocument()
  })
})
