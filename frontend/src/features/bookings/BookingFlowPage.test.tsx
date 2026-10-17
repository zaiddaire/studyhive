import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingFlowPage from './BookingFlowPage'
import { availability, booking, config, mockApi, renderApp, room, student } from '@/test/utils'

const base = {
  'GET /api/auth/me': { body: student },
  'GET /api/config': { body: config },
  'GET /api/rooms/2': { body: room },
}

const route = { route: '/rooms/2/book?date=2031-03-04&start=10:00&end=12:00&size=6', path: '/rooms/:id/book' }

async function goToReview() {
  // Step 1: the slot carried from the room page is restored.
  expect(await screen.findByRole('button', { name: '10:00–11:00, selected' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Continue/ }))
  // Step 2: group details (pre-filled with the searched group size).
  const size = await screen.findByLabelText(/Number of students/)
  expect(size).toHaveValue(6)
  await userEvent.type(screen.getByLabelText(/Group name/), 'Thermo circle')
  await userEvent.click(screen.getByRole('button', { name: /Review booking/ }))
  // Step 3: summary.
  expect(await screen.findByRole('heading', { name: 'Review and confirm' })).toBeInTheDocument()
}

describe('BookingFlowPage', () => {
  it('walks through time, group and review, then confirms with an idempotency key', async () => {
    const api = mockApi({
      ...base,
      'GET /api/rooms/2/availability': { body: availability() },
      'POST /api/bookings': { status: 201, body: booking() },
    })
    renderApp(<BookingFlowPage />, route)
    await goToReview()
    expect(screen.getByText('10:00–12:00 (2 hours)')).toBeInTheDocument()
    expect(screen.getByText(/cancel free of charge from your dashboard up to 1 hour before/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }))
    await waitFor(() => expect(screen.getByTestId('other-route')).toBeInTheDocument())

    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/api/bookings')!
    expect(post.body).toEqual({
      roomId: 2,
      startTime: '2031-03-04T10:00:00',
      endTime: '2031-03-04T12:00:00',
      groupName: 'Thermo circle',
      groupSize: 6,
    })
    expect(post.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })

  it('blocks groups larger than the room before calling the API', async () => {
    const api = mockApi({ ...base, 'GET /api/rooms/2/availability': { body: availability() } })
    renderApp(<BookingFlowPage />, route)
    expect(await screen.findByRole('button', { name: '10:00–11:00, selected' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Continue/ }))
    const size = await screen.findByLabelText(/Number of students/)
    await userEvent.clear(size)
    await userEvent.type(size, '9')
    await userEvent.click(screen.getByRole('button', { name: /Review booking/ }))
    expect(await screen.findByText('This room is for groups of 3–8 students.')).toBeInTheDocument()
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('returns to the time step with fresh availability when the slot was just taken', async () => {
    let taken = false
    mockApi({
      ...base,
      'GET /api/rooms/2/availability': () => ({ body: availability(taken ? ['10', '11'] : []) }),
      'POST /api/bookings': () => {
        taken = true
        return { status: 409, body: { code: 'SLOT_TAKEN', message: 'Sorry - this room has just been booked for an overlapping time.' } }
      },
    })
    renderApp(<BookingFlowPage />, route)
    await goToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(await screen.findByRole('heading', { name: 'When would you like the room?' })).toBeInTheDocument()
    expect(screen.getByText(/just been booked/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '10:00–11:00, Booked' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Continue/ })).toBeDisabled()
  })

  it('keeps the user on review with a safe-retry message after a network failure', async () => {
    mockApi({
      ...base,
      'GET /api/rooms/2/availability': { body: availability() },
      'POST /api/bookings': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    renderApp(<BookingFlowPage />, route)
    await goToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText(/safe to press “Confirm booking” again/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeEnabled()
  })
})
