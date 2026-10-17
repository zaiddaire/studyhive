import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Booking progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300',
                done && 'border-sage-700 bg-sage-700 text-white',
                active && 'border-sage-700 bg-card text-sage-700 ring-4 ring-sage-100',
                !done && !active && 'border-line-strong bg-card text-muted',
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn('hidden text-sm font-medium sm:block', active || done ? 'text-ink' : 'text-muted')}>
              {label}
              <span className="sr-only">{done ? ' (completed)' : active ? ' (current step)' : ''}</span>
            </span>
            {i < steps.length - 1 && (
              <span className="relative h-0.5 flex-1 overflow-hidden rounded bg-line" aria-hidden>
                <motion.span
                  className="absolute inset-y-0 left-0 bg-sage-700"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
