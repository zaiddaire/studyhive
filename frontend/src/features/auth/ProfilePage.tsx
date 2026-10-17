import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { ApiError, errorMessage } from '@/lib/api'
import { formatInstant } from '@/lib/time'
import { initials } from '@/lib/utils'
import { useConfig } from '@/hooks/useConfig'
import { changePasswordSchema, profileSchema, type ChangePasswordValues, type ProfileValues } from '@/schemas/auth'
import { authApi, queryKeys } from '@/services'
import { useAuth } from './AuthProvider'
import { PasswordChecklist, PasswordInput } from './AuthShell'

export default function ProfilePage() {
  const { user } = useAuth()
  const { data: config } = useConfig()
  const queryClient = useQueryClient()

  const profile = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user?.fullName ?? '' } })
  useEffect(() => {
    if (user) profile.reset({ fullName: user.fullName })
  }, [user, profile])
  const saveProfile = useMutation({
    mutationFn: (v: ProfileValues) => authApi.updateProfile(v.fullName),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.me, updated)
      toast.success('Profile updated')
    },
  })

  const password = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const changePassword = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      password.reset()
      toast.success('Password changed', { description: 'Other devices have been signed out.' })
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const f of error.fieldErrors) {
          if (f.field in password.getValues()) password.setError(f.field as keyof ChangePasswordValues, { message: f.message })
        }
      }
    },
  })

  if (!user) return null
  const card = 'rounded-[20px] border border-line bg-card p-6 shadow-soft sm:p-8'

  return (
    <div className="container-page max-w-3xl pb-24 pt-10">
      <p className="eyebrow">Account</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">Your profile</h1>

      <section className={`${card} mt-8 flex flex-col gap-5 sm:flex-row sm:items-center`} aria-label="Account summary">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sage-700 text-xl font-semibold text-white">{initials(user.fullName)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.fullName}</p>
          <p className="truncate text-muted">{user.email}</p>
          {config && <p className="mt-1 text-xs text-muted">Member since {formatInstant(user.createdAt, config.timeZone).split(',')[0]}</p>}
        </div>
        <Badge tone={user.role === 'ADMIN' ? 'champagne' : 'sage'}>{user.role === 'ADMIN' ? 'Administrator' : 'Student'}</Badge>
      </section>

      <section className={`${card} mt-6`} aria-labelledby="details-heading">
        <h2 id="details-heading" className="flex items-center gap-2 text-lg font-semibold">
          <UserRound className="size-5 text-sage-700" aria-hidden /> Personal details
        </h2>
        <form noValidate onSubmit={profile.handleSubmit((v) => saveProfile.mutate(v))} className="mt-5 flex flex-col gap-5">
          <FormError message={saveProfile.isError ? errorMessage(saveProfile.error) : null} />
          <Field label="Full name" required error={profile.formState.errors.fullName?.message}>
            {(a) => <Input {...a} autoComplete="name" {...profile.register('fullName')} />}
          </Field>
          <Field label="Email" hint="Your email is your sign-in name and can’t be changed here.">
            {(a) => <Input {...a} value={user.email} disabled readOnly />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={saveProfile.isPending} disabled={!profile.formState.isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </section>

      <section className={`${card} mt-6`} aria-labelledby="password-heading">
        <h2 id="password-heading" className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="size-5 text-sage-700" aria-hidden /> Change password
        </h2>
        <form noValidate onSubmit={password.handleSubmit((v) => changePassword.mutate(v))} className="mt-5 flex flex-col gap-5">
          <FormError
            message={changePassword.isError && !(changePassword.error instanceof ApiError && changePassword.error.fieldErrors.length) ? errorMessage(changePassword.error) : null}
          />
          <Field label="Current password" required error={password.formState.errors.currentPassword?.message}>
            {(a) => <PasswordInput {...a} autoComplete="current-password" {...password.register('currentPassword')} />}
          </Field>
          <Field label="New password" required error={password.formState.errors.newPassword?.message}>
            {(a) => <PasswordInput {...a} autoComplete="new-password" {...password.register('newPassword')} />}
          </Field>
          <PasswordChecklist value={password.watch('newPassword')} />
          <Field label="Confirm new password" required error={password.formState.errors.confirmPassword?.message}>
            {(a) => <PasswordInput {...a} autoComplete="new-password" {...password.register('confirmPassword')} />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={changePassword.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
