import { z } from 'zod'
import { wholeNumber } from './search'

/** Group details are validated against the chosen room's capacity (the server re-checks everything). */
export function groupDetailsSchema(minCapacity: number, maxCapacity: number) {
  return z.object({
    groupName: z.string().trim().max(100, 'Group name must be 100 characters or fewer.'),
    groupSize: wholeNumber('your group size', 1, 50).refine(
      (n) => n >= minCapacity && n <= maxCapacity,
      `This room is for groups of ${minCapacity}–${maxCapacity} students.`,
    ),
    purpose: z.string().trim().max(500, 'Purpose must be 500 characters or fewer.'),
  })
}

export type GroupDetailsValues = z.infer<ReturnType<typeof groupDetailsSchema>>

export const cancelSchema = z.object({
  reason: z.string().trim().max(500, 'Reason must be 500 characters or fewer.'),
})
