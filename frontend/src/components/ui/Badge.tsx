import type { ReactNode } from 'react'
import { Ban, CircleCheck, Clock, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/types/api'

type Tone = 'neutral' | 'sage' | 'success' | 'danger' | 'warning' | 'champagne'

const tones: Record<Tone, string> = {
  neutral: 'bg-sage-50 text-muted border-line',
  sage: 'bg-sage-100 text-sage-800 border-sage-200',
  success: 'bg-success-soft text-success border-success/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  champagne: 'bg-champagne-100 text-champagne-600 border-champagne-400/40',
}

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

/** Status is conveyed by icon + text, never colour alone. */
export function BookingStatusBadge({ status, upcoming }: { status: BookingStatus; upcoming?: boolean }) {
  if (status === 'CANCELLED') {
    return (
      <Badge tone="danger" icon={<Ban className="size-3.5" aria-hidden />}>
        Cancelled
      </Badge>
    )
  }
  if (status === 'COMPLETED' || (status === 'CONFIRMED' && upcoming === false)) {
    return (
      <Badge tone="neutral" icon={<CalendarCheck className="size-3.5" aria-hidden />}>
        Completed
      </Badge>
    )
  }
  return (
    <Badge tone="success" icon={<CircleCheck className="size-3.5" aria-hidden />}>
      Confirmed
    </Badge>
  )
}

export function PendingBadge({ children }: { children: ReactNode }) {
  return (
    <Badge tone="warning" icon={<Clock className="size-3.5" aria-hidden />}>
      {children}
    </Badge>
  )
}
