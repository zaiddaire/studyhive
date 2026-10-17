import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function Pagination({ page, totalPages, onChange, label = 'Pagination' }: { page: number; totalPages: number; onChange: (page: number) => void; label?: string }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-2">
      <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="size-4" aria-hidden />}>
        Previous
      </Button>
      <p className="text-sm text-muted" aria-live="polite">
        Page <span className="font-medium text-ink">{page + 1}</span> of {totalPages}
      </p>
      <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  )
}
