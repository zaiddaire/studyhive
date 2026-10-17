import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Textarea } from '@/components/ui/Field'
import { errorMessage } from '@/lib/api'
import { formatDate, formatDateTime, formatTimeRange, datePart } from '@/lib/time'
import { bookingsApi, queryKeys } from '@/services'
import type { Booking } from '@/types/api'

/** Confirmation step before a student cancels; the server re-checks ownership and the deadline. */
export function CancelBookingDialog({ booking, open, onOpenChange }: { booking: Booking; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => bookingsApi.cancel(booking.id, reason.trim() || undefined),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.booking(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['availability', updated.room.id] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Booking cancelled', { description: `${booking.bookingReference} - the room is free for other groups again.` })
      onOpenChange(false)
      setReason('')
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!mutation.isPending) {
          onOpenChange(o)
          if (!o) mutation.reset()
        }
      }}
      title="Cancel this booking?"
      description={`${booking.room.name} · ${formatDate(datePart(booking.startTime), 'medium')} · ${formatTimeRange(booking.startTime, booking.endTime)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Keep booking
          </Button>
          <Button variant="danger" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          This cannot be undone. Your group will lose the room for this time and another group may book it.
          {booking.cancellationDeadline && <> You can cancel until {formatDateTime(booking.cancellationDeadline)}.</>}
        </p>
        <Field label="Reason (optional)">
          {(a) => <Textarea {...a} value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Our exam was rescheduled" />}
        </Field>
        <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      </div>
    </Dialog>
  )
}
