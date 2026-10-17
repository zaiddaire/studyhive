import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './auth'
import { groupDetailsSchema } from './booking'
import { quickSearchSchema } from './search'
import { roomSchema } from './room'

describe('form schemas', () => {
  it('requires a strong, confirmed password at registration', () => {
    const base = { fullName: 'Asha Learner', email: 'asha@example.test', password: 'Password123', confirmPassword: 'Password123' }
    expect(registerSchema.safeParse(base).success).toBe(true)
    const weak = registerSchema.safeParse({ ...base, password: 'password', confirmPassword: 'password' })
    expect(weak.success).toBe(false)
    const mismatch = registerSchema.safeParse({ ...base, confirmPassword: 'Password124' })
    expect(mismatch.success).toBe(false)
    expect(mismatch.error?.issues[0].path).toEqual(['confirmPassword'])
  })

  it('validates login emails', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
  })

  it('checks group size against the room capacity', () => {
    const schema = groupDetailsSchema(3, 8)
    expect(schema.safeParse({ groupName: '', groupSize: 6, purpose: '' }).success).toBe(true)
    const tooMany = schema.safeParse({ groupName: '', groupSize: 9, purpose: '' })
    expect(tooMany.success).toBe(false)
    expect(tooMany.error?.issues[0].message).toBe('This room is for groups of 3–8 students.')
    expect(schema.safeParse({ groupName: '', groupSize: Number.NaN, purpose: '' }).success).toBe(false)
  })

  it('allows a date-only quick search but validates numbers', () => {
    expect(quickSearchSchema.safeParse({ date: '2031-03-04', start: '', duration: 60, groupSize: 6 }).success).toBe(true)
    expect(quickSearchSchema.safeParse({ date: '', start: '', duration: 60, groupSize: 6 }).success).toBe(false)
    expect(quickSearchSchema.safeParse({ date: '2031-03-04', start: '', duration: 60, groupSize: 0 }).success).toBe(false)
  })

  it('validates rooms, including empty price and capacity order', () => {
    const valid = {
      roomNumber: 'G-1',
      name: 'Room',
      description: 'Desc',
      location: '',
      accessibilityInfo: '',
      minimumCapacity: 2,
      maximumCapacity: 6,
      hourlyPrice: Number.NaN,
      status: 'ACTIVE' as const,
      amenityIds: [],
      images: [{ url: 'https://images.example/room.jpg', altText: 'Room' }],
    }
    expect(roomSchema.safeParse(valid).success).toBe(true)
    expect(roomSchema.safeParse({ ...valid, minimumCapacity: 8, maximumCapacity: 4 }).success).toBe(false)
    expect(roomSchema.safeParse({ ...valid, images: [{ url: 'javascript:alert(1)', altText: 'x' }] }).success).toBe(false)
  })
})
