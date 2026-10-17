import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Input } from '@/components/ui/Field'
import { errorMessage } from '@/lib/api'
import { useConfig } from '@/hooks/useConfig'
import { forgotSchema, type ForgotValues } from '@/schemas/auth'
import { authApi } from '@/services'
import { AuthShell } from './AuthShell'

export default function ForgotPasswordPage() {
  const { data: config } = useConfig()
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })
  const mutation = useMutation({ mutationFn: (v: ForgotValues) => authApi.forgotPassword(v.email) })
  const emailDisabled = config && !config.passwordResetEmailEnabled

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with and we’ll send you a secure reset link."
      footer={
        <Link to="/login" className="font-semibold text-sage-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {emailDisabled ? (
        <div role="status" className="rounded-[14px] border border-warning/25 bg-warning-soft p-5 text-sm text-warning">
          <p className="font-semibold">Password reset by email isn’t available here</p>
          <p className="mt-1">This StudyHive deployment has no email service configured. Please contact your study-space administrator to reset your password.</p>
        </div>
      ) : mutation.isSuccess ? (
        <div role="status" className="flex flex-col items-center rounded-[16px] border border-line bg-card p-8 text-center">
          <MailCheck className="size-10 text-sage-700" aria-hidden />
          <h2 className="display mt-4 text-2xl">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted">{mutation.data.message}</p>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5">
          <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
          <Field label="Email" required error={form.formState.errors.email?.message}>
            {(a) => <Input {...a} type="email" autoComplete="email" autoFocus {...form.register('email')} />}
          </Field>
          <Button type="submit" size="lg" loading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
