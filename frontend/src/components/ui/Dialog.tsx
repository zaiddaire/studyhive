import type { ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

/** Accessible modal (focus trap, Escape, aria) from Radix, with a soft entrance animation. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-sage-900/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </RadixDialog.Overlay>
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <RadixDialog.Content asChild forceMount>
                <motion.div
                  className={cn(
                    'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-card shadow-panel sm:rounded-[18px]',
                    size === 'sm' && 'sm:max-w-md',
                    size === 'md' && 'sm:max-w-lg',
                    size === 'lg' && 'sm:max-w-2xl',
                  )}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
                    <div>
                      <RadixDialog.Title className="display text-2xl leading-tight">{title}</RadixDialog.Title>
                      {description ? (
                        <RadixDialog.Description className="mt-1.5 text-sm leading-relaxed text-muted">{description}</RadixDialog.Description>
                      ) : (
                        <RadixDialog.Description className="sr-only">Dialog</RadixDialog.Description>
                      )}
                    </div>
                    <RadixDialog.Close
                      className="-mr-2 rounded-full p-2 text-muted transition hover:bg-sage-50 hover:text-ink"
                      aria-label="Close dialog"
                    >
                      <X className="size-5" aria-hidden />
                    </RadixDialog.Close>
                  </div>
                  {children && <div className="overflow-y-auto px-6 py-5">{children}</div>}
                  {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
