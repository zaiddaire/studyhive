import { useState, type ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

/** Fades content up when it scrolls into view. Disabled when the user prefers reduced motion. */
export function Reveal({ children, delay = 0, className, y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

/**
 * Router outlet with a short cross-fade between pages. Layout chrome (navbar, sidebar) stays mounted;
 * AnimatePresence keeps the previous page's element while it fades out.
 */
function FrozenOutlet() {
  // Capture the outlet once so the exiting page keeps rendering its own route, not the next one.
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

export function AnimatedOutlet() {
  const location = useLocation()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={{ duration: reduce ? 0 : 0.26, ease }}
      >
        <FrozenOutlet />
      </motion.div>
    </AnimatePresence>
  )
}
