import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotGrid } from './SlotPicker'
import { RoomCard } from './RoomCard'
import { MemoryRouter } from 'react-router-dom'
import type { Slot } from '@/types/api'

const slots: Slot[] = [
  { start: '2031-03-04T09:00:00', end: '2031-03-04T10:00:00', status: 'AVAILABLE' },
  { start: '2031-03-04T10:00:00', end: '2031-03-04T11:00:00', status: 'BOOKED' },
  { start: '2031-03-04T11:00:00', end: '2031-03-04T12:00:00', status: 'BLOCKED' },
  { start: '2031-03-04T12:00:00', end: '2031-03-04T13:00:00', status: 'PAST' },
]

describe('SlotGrid', () => {
  it('labels every slot with text, not just colour, and disables unavailable ones', () => {
    render(<SlotGrid slots={slots} selection={null} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: '09:00–10:00, Available' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '10:00–11:00, Booked' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '11:00–12:00, Unavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '12:00–13:00, Past' })).toBeDisabled()
    expect(screen.getByText('Booked')).toBeVisible()
  })

  it('reports clicks on available slots and marks the selection as pressed', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<SlotGrid slots={slots} selection={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: '09:00–10:00, Available' }))
    expect(onSelect).toHaveBeenCalledWith(0)
    rerender(<SlotGrid slots={slots} selection={{ startIndex: 0, endIndex: 0 }} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: '09:00–10:00, selected' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('RoomCard', () => {
  it('shows capacity, amenities and server-provided availability', () => {
    render(
      <MemoryRouter>
        <RoomCard
          room={{
            id: 2,
            roomNumber: 'G-102',
            name: 'The Hive Room',
            summary: 'Our signature group room.',
            minimumCapacity: 3,
            maximumCapacity: 8,
            status: 'ACTIVE',
            amenities: [
              { id: 1, code: 'wifi', name: 'Wi-Fi', category: 'FACILITY' },
              { id: 2, code: 'display', name: 'Display screen', category: 'EQUIPMENT' },
            ],
            availability: { status: 'UNAVAILABLE', message: 'Already booked at this time' },
          }}
          linkSearch="?date=2031-03-04"
        />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/rooms/2?date=2031-03-04')
    expect(link).toHaveAccessibleName(/seats 3 to 8\. Already booked at this time/)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument()
  })
})
