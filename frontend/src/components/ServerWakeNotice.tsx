import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { onServerWaking } from '@/lib/api'
import { LogoMark } from './ui/Logo'

/**
 * On free hosting the API sleeps when idle. While a request is waiting for it to boot (held open or being
 * retried), show a calm notice instead of an error. The page finishes loading by itself.
 */
export function ServerWakeNotice() {
  const [waking, setWaking] = useState(false)
  useEffect(() => onServerWaking(setWaking), [])
  return (
    <AnimatePresence>
      {waking && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-3 shadow-panel"
        >
          <LogoMark className="size-7 shrink-0 animate-spin [animation-duration:2.4s]" />
          <p className="text-sm">
            <span className="font-semibold">Waking up StudyHive…</span>
            <span className="block text-xs text-muted">
              The server sleeps when idle on the free plan. This can take up to 2–3 minutes; the page will load by itself.
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
