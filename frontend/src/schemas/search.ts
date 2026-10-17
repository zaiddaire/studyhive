import { z } from 'zod'

/** Numeric fields are converted by react-hook-form (valueAsNumber / setValueAs); NaN means "empty". */
const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${label}.` })
    .refine((n) => !Number.isNaN(n), `Enter ${label}.`)
    .refine((n) => Number.isInteger(n), 'Use a whole number.')
    .refine((n) => n >= min, `Must be at least ${min}.`)
    .refine((n) => n <= max, `Must be ${max} or fewer.`)

export const quickSearchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
  /** Optional: without a start time the room list shows how many slots are free that day. */
  start: z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/, 'Choose a valid start time.')]),
  duration: wholeNumber('a duration', 15, 720),
  groupSize: wholeNumber('your group size', 1, 50),
})

export type QuickSearchValues = z.infer<typeof quickSearchSchema>

export { wholeNumber }
