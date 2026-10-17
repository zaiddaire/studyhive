import { z } from 'zod'

/** Mirrors the backend rule: 8-64 characters with at least one letter and one number. */
export const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(64, 'Use 64 characters or fewer.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.')

const email = z.string().trim().min(1, 'Email is required.').max(254).email('Enter a valid email address.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(128),
})

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(100, 'Use 100 characters or fewer.'),
    email,
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const forgotSchema = z.object({ email })

export const resetSchema = z
  .object({
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100, 'Use 100 characters or fewer.'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a password different from your current one.' })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ForgotValues = z.infer<typeof forgotSchema>
export type ResetValues = z.infer<typeof resetSchema>
export type ProfileValues = z.infer<typeof profileSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

/** Live checklist shown under password fields. */
export function passwordChecks(value: string) {
  return [
    { label: '8+ characters', ok: value.length >= 8 && value.length <= 64 },
    { label: 'A letter', ok: /[A-Za-z]/.test(value) },
    { label: 'A number', ok: /\d/.test(value) },
  ]
}
