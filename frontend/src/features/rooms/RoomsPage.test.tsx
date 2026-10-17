import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoomsPage from './RoomsPage'
import { config, mockApi, renderApp, student } from '@/test/utils'

const amenities = [
  { id: 1, code: 'wifi', name: 'Wi-Fi', category: 'FACILITY' },
  { id: 2, code: 'whiteboard', name: 'Whiteboard', category: 'EQUIPMENT' },
]

function roomsPage(names: string[]) {
  return {
    content: names.map((name, i) => ({
      id: i + 1,
      roomNumber: `R-${i + 1}`,
      name,
      summary: 'A room.',
      minimumCapacity: 2,
      maximumCapacity: 8,
      status: 'ACTIVE',
      amenities: [],
    })),
    page: 0,
    size: 9,
    totalElements: names.length,
    totalPages: 1,
  }
}

describe('RoomsPage', () => {
  it('passes URL filters to the API and refines the search as filters change', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: student },
      'GET /api/config': { body: config },
      'GET /api/amenities': { body: amenities },
      'GET /api/rooms': (_body, url) => ({ body: roomsPage(url.searchParams.getAll('amenities').includes('whiteboard') ? ['The Idea Lab'] : ['The Hive Room', 'The Idea Lab']) }),
    })
    renderApp(<RoomsPage />, { route: '/rooms?size=6&date=2031-03-04' })

    expect(await screen.findByText('2 rooms found')).toBeInTheDocument()
    expect(api.calls.some((c) => c.path === '/api/rooms')).toBe(true)
    const firstQuery = (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls
      .map(([u]) => String(u))
      .find((u) => u.startsWith('/api/rooms?'))!
    expect(firstQuery).toContain('groupSize=6')
    expect(firstQuery).toContain('date=2031-03-04')

    const [whiteboard] = await screen.findAllByRole('checkbox', { name: 'Whiteboard' })
    await userEvent.click(whiteboard)
    await waitFor(() => expect(screen.getByText('1 room found')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Remove filter Whiteboard' })).toBeInTheDocument()
  })

  it('shows an empty state with a clear-filters action', async () => {
    mockApi({
      'GET /api/auth/me': { body: student },
      'GET /api/config': { body: config },
      'GET /api/amenities': { body: amenities },
      'GET /api/rooms': { body: roomsPage([]) },
    })
    renderApp(<RoomsPage />, { route: '/rooms?q=nothing' })
    expect(await screen.findByText('No rooms match')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument()
  })
})
