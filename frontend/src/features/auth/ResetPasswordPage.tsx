import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, FormError } from '@/components/ui/Field'
import { errorMessage } from '@/lib/api'
import { resetSchema, type ResetValues } from '@/schemas/auth'
import { authApi } from '@/services'
import { AuthShell, PasswordChecklist, PasswordInput } from './AuthShell'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { newPassword: '', confirmPassword: '' } })
  const mutation = useMutation({ mutationFn: (v: ResetValues) => authApi.resetPassword({ token, ...v }) })

  return (
    <AuthShell title="Choose a new password" subtitle="Reset links work once and expire after 30 minutes.">
      {!token ? (
        <div className="space-y-4">
          <FormError message="This reset link is incomplete. Please use the link from your email, or request a new one." />
          <ButtonLink to="/forgot-password" variant="secondary">
            Request a new link
          </ButtonLink>
        </div>
      ) : mutation.isSuccess ? (
        <div role="status" className="flex flex-col items-center rounded-[16px] border border-line bg-card p-8 text-center">
          <CircleCheck className="size-10 text-success" aria-hidden />
          <h2 className="display mt-4 text-2xl">Password updated</h2>
          <p className="mt-2 text-sm text-muted">{mutation.data.message} For your security, you’ve been signed out everywhere.</p>
          <ButtonLink to="/login" className="mt-6">
            Log in
          </ButtonLink>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5">
          <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
          <Field label="New password" required error={form.formState.errors.newPassword?.message}>
            {(a) => <PasswordInput {...a} autoComplete="new-password" autoFocus {...form.register('newPassword')} />}
          </Field>
          <PasswordChecklist value={form.watch('newPassword')} />
          <Field label="Confirm new password" required error={form.formState.errors.confirmPassword?.message}>
            {(a) => <PasswordInput {...a} autoComplete="new-password" {...form.register('confirmPassword')} />}
          </Field>
          <Button type="submit" size="lg" loading={mutation.isPending}>
            Update password
          </Button>
          {mutation.isError && (
            <Link to="/forgot-password" className="text-center text-sm font-medium text-sage-700 hover:underline">
              Request a new reset link
            </Link>
          )}
        </form>
      )}
    </AuthShell>
  )
}
