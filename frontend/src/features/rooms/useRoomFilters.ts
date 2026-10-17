import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RoomSearchParams } from '@/services'

export interface RoomFilters {
  q: string
  groupSize?: number
  amenities: string[]
  date?: string
  start?: string
  duration?: number
  availableOnly: boolean
  sort: NonNullable<RoomSearchParams['sort']>
  page: number
}

const SORTS = ['name', 'capacity', 'capacity_desc', 'room_number'] as const

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** Room search state is kept in the URL so results are shareable and survive refresh/back. */
export function useRoomFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<RoomFilters>(() => {
    const date = params.get('date') ?? undefined
    const start = params.get('start') ?? undefined
    const sort = params.get('sort') as RoomFilters['sort'] | null
    return {
      q: params.get('q') ?? '',
      groupSize: positiveInt(params.get('size')),
      amenities: (params.get('amenities') ?? '').split(',').filter(Boolean),
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      start: start && /^\d{2}:\d{2}$/.test(start) ? start : undefined,
      duration: positiveInt(params.get('duration')),
      availableOnly: params.get('available') === '1',
      sort: sort && SORTS.includes(sort) ? sort : 'name',
      page: Math.max(0, (positiveInt(params.get('page')) ?? 1) - 1),
    }
  }, [params])

  const update = useCallback(
    (patch: Partial<RoomFilters>, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key))
          if ('q' in patch) set('q', patch.q?.trim() || undefined)
          if ('groupSize' in patch) set('size', patch.groupSize ? String(patch.groupSize) : undefined)
          if ('amenities' in patch) set('amenities', patch.amenities?.length ? patch.amenities.join(',') : undefined)
          if ('date' in patch) {
            set('date', patch.date)
            if (!patch.date) {
              next.delete('start')
              next.delete('duration')
              next.delete('available')
            }
          }
          if ('start' in patch) {
            set('start', patch.start)
            if (!patch.start) next.delete('duration')
          }
          if ('duration' in patch) set('duration', patch.duration ? String(patch.duration) : undefined)
          if ('availableOnly' in patch) set('available', patch.availableOnly ? '1' : undefined)
          if ('sort' in patch) set('sort', patch.sort && patch.sort !== 'name' ? patch.sort : undefined)
          if ('page' in patch) set('page', patch.page ? String(patch.page + 1) : undefined)
          else if (resetPage) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  const activeCount =
    (filters.q ? 1 : 0) + (filters.groupSize ? 1 : 0) + filters.amenities.length + (filters.date ? 1 : 0) + (filters.availableOnly ? 1 : 0)

  /** Query string to carry the chosen date/time into the room page. */
  const carry = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.date) p.set('date', filters.date)
    if (filters.start) p.set('start', filters.start)
    if (filters.duration) p.set('duration', String(filters.duration))
    if (filters.groupSize) p.set('size', String(filters.groupSize))
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [filters])

  return { filters, update, clear, activeCount, carry }
}
