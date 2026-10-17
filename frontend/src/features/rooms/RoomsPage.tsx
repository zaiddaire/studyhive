import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { SearchX, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Field'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { staggerParent } from '@/components/ui/Motion'
import { useAmenities } from '@/hooks/useConfig'
import { formatDate, formatDuration } from '@/lib/time'
import { publicApi, queryKeys, type RoomSearchParams } from '@/services'
import { RoomCard, RoomCardSkeleton } from './RoomCard'
import { RoomFiltersPanel } from './RoomFiltersPanel'
import { useRoomFilters } from './useRoomFilters'

const PAGE_SIZE = 9

export default function RoomsPage() {
  const { filters, update, clear, activeCount, carry } = useRoomFilters()
  const [sheetOpen, setSheetOpen] = useState(false)
  const amenities = useAmenities()

  const params: RoomSearchParams = {
    q: filters.q || undefined,
    groupSize: filters.groupSize,
    amenities: filters.amenities.length ? filters.amenities : undefined,
    date: filters.date,
    startTime: filters.start,
    duration: filters.start ? filters.duration : undefined,
    availableOnly: filters.availableOnly && Boolean(filters.date),
    sort: filters.sort,
    page: filters.page,
    size: PAGE_SIZE,
  }
  const rooms = useQuery({
    queryKey: queryKeys.rooms(params),
    queryFn: () => publicApi.rooms(params),
    placeholderData: keepPreviousData,
  })

  const chips: { label: string; onRemove: () => void }[] = []
  if (filters.q) chips.push({ label: `“${filters.q}”`, onRemove: () => update({ q: '' }) })
  if (filters.date)
    chips.push({
      label: `${formatDate(filters.date, 'short')}${filters.start ? ` · ${filters.start}${filters.duration ? ` · ${formatDuration(filters.duration)}` : ''}` : ''}`,
      onRemove: () => update({ date: undefined }),
    })
  if (filters.groupSize) chips.push({ label: `${filters.groupSize} students`, onRemove: () => update({ groupSize: undefined }) })
  for (const code of filters.amenities) {
    const name = amenities.data?.find((a) => a.code === code)?.name ?? code
    chips.push({ label: name, onRemove: () => update({ amenities: filters.amenities.filter((c) => c !== code) }) })
  }
  if (filters.availableOnly) chips.push({ label: 'Available only', onRemove: () => update({ availableOnly: false }) })

  const total = rooms.data?.totalElements

  return (
    <div className="container-page pb-24 pt-10 lg:pt-14">
      <header className="flex flex-col gap-3 border-b border-line pb-8">
        <p className="eyebrow">Explore rooms</p>
        <h1 className="display text-4xl sm:text-5xl">Find a room for your group</h1>
        <p className="max-w-2xl text-muted">
          Choose a date to see real-time availability. Every room is reserved as a whole for one group.
        </p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[290px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6 pr-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              {activeCount > 0 && (
                <button type="button" onClick={clear} className="text-sm font-medium text-sage-700 hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <RoomFiltersPanel filters={filters} update={update} />
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="results-heading" className="text-sm text-muted" aria-live="polite">
              {rooms.isPending ? 'Loading rooms…' : total !== undefined ? `${total} ${total === 1 ? 'room' : 'rooms'} found` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)} icon={<SlidersHorizontal className="size-4" aria-hidden />}>
                Filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </Button>
              <label className="sr-only" htmlFor="sort">
                Sort rooms
              </label>
              <Select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as typeof filters.sort })} className="h-9 !w-auto text-sm">
                <option value="name">Sort: Name</option>
                <option value="capacity">Sort: Capacity (small first)</option>
                <option value="capacity_desc">Sort: Capacity (large first)</option>
                <option value="room_number">Sort: Room number</option>
              </Select>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-sage-50 py-1 pl-3 pr-2 text-sm text-sage-800 transition hover:border-sage-400"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    {chip.label}
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clear} className="px-2 py-1 text-sm font-medium text-sage-700 hover:underline">
                  Clear all
                </button>
              </li>
            </ul>
          )}

          <div className="mt-6">
            {rooms.isPending ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <RoomCardSkeleton key={i} />
                ))}
              </div>
            ) : rooms.isError ? (
              <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
            ) : rooms.data.content.length === 0 ? (
              <EmptyState
                icon={<SearchX className="size-6" aria-hidden />}
                title="No rooms match"
                description={
                  filters.availableOnly
                    ? 'Every matching room is taken for that time. Try a different start time or date.'
                    : 'Try removing a filter or searching for a different room.'
                }
                action={
                  <Button variant="secondary" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <>
                <motion.div
                  key={`${filters.page}-${rooms.data.totalElements}`}
                  className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  style={{ opacity: rooms.isPlaceholderData ? 0.6 : 1 }}
                >
                  {rooms.data.content.map((room) => (
                    <RoomCard key={room.id} room={room} linkSearch={carry} />
                  ))}
                </motion.div>
                <div className="mt-10">
                  <Pagination page={filters.page} totalPages={rooms.data.totalPages} onChange={(page) => update({ page }, { resetPage: false })} label="Room results pages" />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <Dialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filters"
        description="Results update as you change filters."
        footer={
          <>
            <Button variant="ghost" onClick={clear}>
              Clear all
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Show {total ?? ''} rooms</Button>
          </>
        }
      >
        <RoomFiltersPanel filters={filters} update={update} />
      </Dialog>
    </div>
  )
}
