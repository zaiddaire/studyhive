import type { ReactNode } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { LogoMark } from './Logo'
import { errorMessage } from '@/lib/api'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-sage-100/80', className)} />
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-muted">
      <LogoMark className="size-6 animate-spin [animation-duration:2.4s]" />
      <span>{label}…</span>
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'honeycomb-bg flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-card/60 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-sage-100 text-sage-700">
        {icon ?? <LogoMark className="size-7" />}
      </div>
      <h3 className="display text-2xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'We could not load this', className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-[14px] border border-danger/20 bg-danger-soft/50 px-6 py-10 text-center', className)}>
      <CircleAlert className="size-8 text-danger" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
      )}
    </div>
  )
}
