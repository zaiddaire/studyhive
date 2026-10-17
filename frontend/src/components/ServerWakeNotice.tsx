import { useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { isWakeUpError } from '@/lib/api'
import { LogoMark } from './ui/Logo'

/**
 * On free hosting the API sleeps when idle. While queries are retrying because the server is waking up,
 * show a calm notice instead of an error.
 */
export function ServerWakeNotice() {
  const queryClient = useQueryClient()
  const cache = queryClient.getQueryCache()
  const waking = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => cache.getAll().some((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount > 0 && isWakeUpError(q.state.fetchFailureReason)),
    () => false,
  )
  return (
    <AnimatePresence>
      {waking && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-3 shadow-panel"
        >
          <LogoMark className="size-7 shrink-0 animate-spin [animation-duration:2.4s]" />
          <p className="text-sm">
            <span className="font-semibold">Waking up StudyHive…</span>
            <span className="block text-xs text-muted">The server sleeps when idle on the free plan. Waking it can take a minute or two.</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
