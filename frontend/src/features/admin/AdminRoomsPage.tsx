import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, DoorOpen, Pencil, Plus, Power, Trash, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, FormError, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/ui/SmartImage'
import { errorMessage } from '@/lib/api'
import { adminApi, queryKeys } from '@/services'
import type { AdminRoom } from '@/types/api'

function StatusDialog({ room, onClose }: { room: AdminRoom; onClose: () => void }) {
  const queryClient = useQueryClient()
  const deactivating = room.status === 'ACTIVE'
  const [cancelFuture, setCancelFuture] = useState(false)
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => adminApi.setRoomStatus(room.id, { status: deactivating ? 'INACTIVE' : 'ACTIVE', cancelFutureBookings: deactivating && cancelFuture, reason: reason.trim() || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room', room.id] })
      toast.success(deactivating ? `${room.name} deactivated` : `${room.name} is accepting bookings`, {
        description: res.cancelledBookings ? `${res.cancelledBookings} future booking(s) cancelled.` : res.futureBookings && deactivating ? `${res.futureBookings} existing booking(s) kept.` : undefined,
      })
      onClose()
    },
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !mutation.isPending && onClose()}
      title={deactivating ? `Deactivate ${room.name}?` : `Reactivate ${room.name}?`}
      description={deactivating ? 'Students will no longer be able to book this room. It stays in booking history.' : 'The room will appear in search and accept new bookings.'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Keep as is
          </Button>
          <Button variant={deactivating ? 'danger' : 'primary'} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {deactivating ? 'Deactivate room' : 'Reactivate room'}
          </Button>
        </>
      }
    >
      {deactivating && (
        <div className="flex flex-col gap-4">
          {room.upcomingBookings > 0 ? (
            <>
              <p className="rounded-[10px] bg-warning-soft p-3 text-sm text-warning">
                This room has {room.upcomingBookings} upcoming booking{room.upcomingBookings === 1 ? '' : 's'}. They are kept unless you cancel them below.
              </p>
              <Checkbox label="Cancel all future bookings for this room" checked={cancelFuture} onChange={(e) => setCancelFuture(e.target.checked)} />
              {cancelFuture && (
                <Field label="Reason shown to students" hint="Optional - a default apology is used if left blank.">
                  {(a) => <Textarea {...a} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
                </Field>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">There are no upcoming bookings for this room.</p>
          )}
        </div>
      )}
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
    </Dialog>
  )
}

function DeleteDialog({ room, onClose }: { room: AdminRoom; onClose: () => void }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => adminApi.deleteRoom(room.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success(`${room.name} deleted`)
      onClose()
    },
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !mutation.isPending && onClose()}
      title={`Delete ${room.name}?`}
      description="Rooms can only be deleted if they have never been booked. Otherwise, deactivate them to keep booking history intact."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Delete permanently
          </Button>
        </>
      }
    >
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      {!mutation.isError && <p className="text-sm text-muted">This also removes its photos, amenities and custom hours.</p>}
    </Dialog>
  )
}

export default function AdminRoomsPage() {
  const rooms = useQuery({ queryKey: queryKeys.admin.rooms, queryFn: adminApi.rooms })
  const [statusRoom, setStatusRoom] = useState<AdminRoom | null>(null)
  const [deleteRoom, setDeleteRoom] = useState<AdminRoom | null>(null)

  return (
    <>
      <AdminPageHeader
        title="Rooms"
        description="Create rooms, set capacity and amenities, and control whether they accept bookings."
        actions={
          <ButtonLink to="/admin/rooms/new" icon={<Plus className="size-4" aria-hidden />}>
            New room
          </ButtonLink>
        }
      />
      {rooms.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[14px]" />
          ))}
        </div>
      ) : rooms.isError ? (
        <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
      ) : rooms.data.length === 0 ? (
        <EmptyState icon={<DoorOpen className="size-6" aria-hidden />} title="No rooms yet" description="Add your first study room to start taking bookings." action={<ButtonLink to="/admin/rooms/new">Create a room</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {rooms.data.map((room) => (
            <li key={room.id} className="flex flex-col gap-4 rounded-[16px] border border-line bg-card p-4 shadow-soft md:flex-row md:items-center">
              <SmartImage src={room.images[0]?.url} alt="" width={240} className="aspect-[16/9] w-full shrink-0 rounded-[10px] md:h-20 md:w-32 md:aspect-auto" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{room.name}</h2>
                  <span className="text-xs text-muted">{room.roomNumber}</span>
                  {room.status === 'ACTIVE' ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>}
                  {room.customHours && <Badge tone="champagne">Custom hours</Badge>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" aria-hidden /> {room.minimumCapacity}–{room.maximumCapacity}
                  </span>
                  <span>{room.amenities.length} amenities</span>
                  <Link to={`/admin/bookings?roomId=${room.id}&sort=start_asc`} className="inline-flex items-center gap-1.5 text-sage-700 hover:underline">
                    <CalendarRange className="size-4" aria-hidden /> {room.upcomingBookings} upcoming
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink to={`/admin/rooms/${room.id}`} variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />}>
                  Edit
                </ButtonLink>
                <Button variant="secondary" size="sm" onClick={() => setStatusRoom(room)} icon={<Power className="size-4" aria-hidden />}>
                  {room.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setDeleteRoom(room)} aria-label={`Delete ${room.name}`}>
                  <Trash className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {statusRoom && <StatusDialog room={statusRoom} onClose={() => setStatusRoom(null)} />}
      {deleteRoom && <DeleteDialog room={deleteRoom} onClose={() => setDeleteRoom(null)} />}
    </>
  )
}
