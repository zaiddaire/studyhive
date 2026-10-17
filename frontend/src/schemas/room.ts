import { z } from 'zod'
import { wholeNumber } from './search'

export const roomSchema = z
  .object({
    roomNumber: z
      .string()
      .trim()
      .min(1, 'Room number is required.')
      .max(20, 'Use 20 characters or fewer.')
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Use letters, numbers and dashes only.'),
    name: z.string().trim().min(1, 'Name is required.').max(100),
    description: z.string().trim().min(1, 'Description is required.').max(5000),
    location: z.string().trim().max(150),
    accessibilityInfo: z.string().trim().max(500),
    minimumCapacity: wholeNumber('a minimum capacity', 1, 50),
    maximumCapacity: wholeNumber('a maximum capacity', 1, 50),
    /** NaN = left empty (free room). */
    hourlyPrice: z.union([z.nan(), z.number().min(0, 'Price cannot be negative.').max(100000, 'Price is too high.')]),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    amenityIds: z.array(z.number()),
    images: z
      .array(
        z.object({
          url: z
            .string()
            .trim()
            .regex(/^(https:\/\/\S+|\/api\/images\/[0-9a-f-]{36})$/, 'Use an https:// image URL or upload a photo.'),
          altText: z.string().trim().min(1, 'Describe the photo for screen-reader users.').max(200),
        }),
      )
      .max(8, 'A room can have up to 8 photos.'),
  })
  .refine((v) => Number.isNaN(v.minimumCapacity) || Number.isNaN(v.maximumCapacity) || v.maximumCapacity >= v.minimumCapacity, {
    path: ['maximumCapacity'],
    message: 'Maximum capacity must be at least the minimum capacity.',
  })

export type RoomFormValues = z.infer<typeof roomSchema>
