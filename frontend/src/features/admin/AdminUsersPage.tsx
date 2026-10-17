import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert, UserCog, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormError, Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/features/auth/AuthProvider'
import { useConfig } from '@/hooks/useConfig'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { formatInstant } from '@/lib/time'
import { initials } from '@/lib/utils'
import { adminApi, queryKeys } from '@/services'
import type { AdminUser } from '@/types/api'

export default function AdminUsersPage() {
  const { user: me } = useAuth()
  const { data: config } = useConfig()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(q)
  const [target, setTarget] = useState<AdminUser | null>(null)
  const users = useQuery({
    queryKey: queryKeys.admin.users(debounced, page),
    queryFn: () => adminApi.users(debounced, page),
    placeholderData: keepPreviousData,
  })
  const mutation = useMutation({
    mutationFn: (u: AdminUser) => adminApi.setUserStatus(u.id, u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(u.accountStatus === 'SUSPENDED' ? `${u.fullName} suspended and signed out` : `${u.fullName} reactivated`)
      setTarget(null)
    },
  })

  return (
    <>
      <AdminPageHeader title="Users" description="View accounts and suspend or reactivate access. Passwords are never visible." />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <Input
          id="user-search"
          type="search"
          className="pl-10"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>
      <div className="mt-6">
        {users.isPending ? (
          <Skeleton className="h-80 w-full rounded-[18px]" />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : users.data.content.length === 0 ? (
          <EmptyState icon={<Users className="size-6" aria-hidden />} title="No users found" description={q ? 'Try a different name or email.' : 'Accounts appear here when students sign up.'} />
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-card shadow-soft" style={{ opacity: users.isPlaceholderData ? 0.6 : 1 }}>
              {users.data.content.map((u) => (
                <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sm font-semibold text-sage-800" aria-hidden>
                    {initials(u.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{u.fullName}</p>
                      {u.role === 'ADMIN' && <Badge tone="champagne">Admin</Badge>}
                      {u.accountStatus === 'SUSPENDED' ? (
                        <Badge tone="danger" icon={<ShieldAlert className="size-3.5" aria-hidden />}>
                          Suspended
                        </Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                    <p className="text-xs text-muted">
                      {u.totalBookings} booking{u.totalBookings === 1 ? '' : 's'}
                      {config && ` · joined ${formatInstant(u.createdAt, config.timeZone).split(',')[0]}`}
                    </p>
                  </div>
                  {u.id !== me?.id && (
                    <Button variant={u.accountStatus === 'ACTIVE' ? 'secondary' : 'primary'} size="sm" onClick={() => setTarget(u)} icon={<UserCog className="size-4" aria-hidden />}>
                      {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination page={page} totalPages={users.data.totalPages} onChange={setPage} label="User pages" />
            </div>
          </>
        )}
      </div>
      {target && (
        <Dialog
          open
          onOpenChange={(o) => !o && !mutation.isPending && setTarget(null)}
          title={target.accountStatus === 'ACTIVE' ? `Suspend ${target.fullName}?` : `Reactivate ${target.fullName}?`}
          description={
            target.accountStatus === 'ACTIVE'
              ? 'They will be signed out everywhere and unable to log in or book. Existing bookings are kept - cancel them from Bookings if needed.'
              : 'They will be able to log in and book rooms again.'
          }
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button variant={target.accountStatus === 'ACTIVE' ? 'danger' : 'primary'} loading={mutation.isPending} onClick={() => mutation.mutate(target)}>
                {target.accountStatus === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
              </Button>
            </>
          }
        >
          <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
        </Dialog>
      )}
    </>
  )
}
