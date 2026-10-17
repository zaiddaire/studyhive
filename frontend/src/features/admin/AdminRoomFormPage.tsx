import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Link2, Trash, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/ui/SmartImage'
import { useAmenities, useConfig } from '@/hooks/useConfig'
import { ApiError, errorMessage } from '@/lib/api'
import { roomSchema, type RoomFormValues } from '@/schemas/room'
import { adminApi, queryKeys } from '@/services'
import type { AdminRoom, AmenityCategory, DayHoursInput } from '@/types/api'
import { toHoursInput, validateHours, WeekHoursEditor } from './WeekHoursEditor'

const empty: RoomFormValues = {
  roomNumber: '',
  name: '',
  description: '',
  location: '',
  accessibilityInfo: '',
  minimumCapacity: 2,
  maximumCapacity: 8,
  hourlyPrice: Number.NaN,
  status: 'ACTIVE',
  amenityIds: [],
  images: [],
}

function toForm(room: AdminRoom): RoomFormValues {
  return {
    roomNumber: room.roomNumber,
    name: room.name,
    description: room.description,
    location: room.location ?? '',
    accessibilityInfo: room.accessibilityInfo ?? '',
    minimumCapacity: room.minimumCapacity,
    maximumCapacity: room.maximumCapacity,
    hourlyPrice: room.hourlyPrice ?? Number.NaN,
    status: room.status,
    amenityIds: room.amenities.map((a) => a.id),
    images: room.images.map((i) => ({ url: i.url, altText: i.altText })),
  }
}

const card = 'rounded-[18px] border border-line bg-card p-6 shadow-soft'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function RoomHoursCard({ roomId }: { roomId: number }) {
  const queryClient = useQueryClient()
  const hours = useQuery({ queryKey: queryKeys.admin.roomHours(roomId), queryFn: () => adminApi.roomHours(roomId) })
  const [useDefault, setUseDefault] = useState(true)
  const [days, setDays] = useState<DayHoursInput[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (hours.data) {
      setUseDefault(hours.data.usesDefault)
      setDays(toHoursInput(hours.data.days))
    }
  }, [hours.data])
  const save = useMutation({
    mutationFn: () => adminApi.updateRoomHours(roomId, useDefault ? { useDefault: true } : { useDefault: false, days }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.admin.roomHours(roomId), data)
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room', roomId] })
      queryClient.invalidateQueries({ queryKey: ['availability', roomId] })
      toast.success('Opening hours saved')
    },
  })
  const submit = () => {
    const problem = useDefault ? null : validateHours(days)
    setError(problem)
    if (!problem) save.mutate()
  }
  return (
    <section className={card} aria-labelledby="hours-heading">
      <h2 id="hours-heading" className="text-lg font-semibold">
        Opening hours
      </h2>
      <p className="mt-1 text-sm text-muted">Follow the facility schedule, or give this room its own weekly hours.</p>
      {hours.isPending ? (
        <Skeleton className="mt-4 h-60 w-full" />
      ) : hours.isError ? (
        <ErrorState className="mt-4" error={hours.error} onRetry={() => hours.refetch()} />
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6" role="radiogroup" aria-label="Hours source">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="hours-source" className="accent-sage-700" checked={useDefault} onChange={() => setUseDefault(true)} />
              Use facility default hours
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="hours-source" className="accent-sage-700" checked={!useDefault} onChange={() => setUseDefault(false)} />
              Custom hours for this room
            </label>
          </div>
          <WeekHoursEditor value={days} onChange={setDays} disabled={useDefault} />
          <FormError message={error ?? (save.isError ? errorMessage(save.error) : null)} />
          <div className="flex justify-end">
            <Button onClick={submit} loading={save.isPending}>
              Save hours
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default function AdminRoomFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const roomId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const amenities = useAmenities()
  const { data: config } = useConfig()
  const room = useQuery({ queryKey: queryKeys.admin.room(roomId), queryFn: () => adminApi.room(roomId), enabled: editing })
  const fileInput = useRef<HTMLInputElement>(null)
  const [urlDraft, setUrlDraft] = useState('')

  const form = useForm<RoomFormValues>({ resolver: zodResolver(roomSchema), defaultValues: empty })
  const images = useFieldArray({ control: form.control, name: 'images' })
  useEffect(() => {
    if (room.data) form.reset(toForm(room.data))
  }, [room.data, form])

  const save = useMutation({
    mutationFn: (v: RoomFormValues) => {
      const body = {
        ...v,
        location: v.location || undefined,
        accessibilityInfo: v.accessibilityInfo || undefined,
        hourlyPrice: Number.isNaN(v.hourlyPrice) ? null : v.hourlyPrice,
      }
      return editing ? adminApi.updateRoom(roomId, body) : adminApi.createRoom(body)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room', saved.id] })
      toast.success(editing ? 'Room updated' : 'Room created', { description: `${saved.name} (${saved.roomNumber})` })
      if (!editing) navigate(`/admin/rooms/${saved.id}`, { replace: true })
      else form.reset(toForm(saved))
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const f of error.fieldErrors) {
          if (f.field in empty) form.setError(f.field as keyof RoomFormValues, { message: f.message })
        }
      }
    },
  })

  const upload = useMutation({
    mutationFn: adminApi.uploadImage,
    onSuccess: (res, file) => {
      images.append({ url: res.url, altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') })
      toast.success('Photo uploaded - check its description.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const onFile = (file?: File) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error('Use a JPEG, PNG or WebP image.')
    if (file.size > 2 * 1024 * 1024) return toast.error('Images must be 2 MB or smaller.')
    upload.mutate(file)
  }

  if (editing && room.isPending) {
    return <Skeleton className="h-[600px] w-full rounded-[18px]" />
  }
  if (editing && room.isError) {
    return <ErrorState error={room.error} onRetry={() => room.refetch()} />
  }

  const { errors } = form.formState
  const selected = form.watch('amenityIds')
  const grouped = (amenities.data ?? []).reduce<Partial<Record<AmenityCategory, typeof amenities.data>>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  return (
    <>
      <Link to="/admin/rooms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-sage-700">
        <ArrowLeft className="size-4" aria-hidden /> All rooms
      </Link>
      <AdminPageHeader
        title={editing ? `Edit ${room.data?.name ?? 'room'}` : 'New room'}
        description={editing ? 'Changes apply immediately to the public listing.' : 'Add a group study room that students can book.'}
        actions={editing ? <Button variant="secondary" onClick={() => navigate(`/rooms/${roomId}`)}>View public page</Button> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-6">
          <section className={card} aria-labelledby="basics">
            <h2 id="basics" className="text-lg font-semibold">
              Details
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Room number" required error={errors.roomNumber?.message} hint="Shown on cards, e.g. G-102.">
                {(a) => <Input {...a} {...form.register('roomNumber')} />}
              </Field>
              <Field label="Name" required error={errors.name?.message}>
                {(a) => <Input {...a} {...form.register('name')} />}
              </Field>
              <Field label="Description" required error={errors.description?.message} className="sm:col-span-2">
                {(a) => <Textarea {...a} rows={5} {...form.register('description')} />}
              </Field>
              <Field label="Location" error={errors.location?.message} hint="Floor, wing or building.">
                {(a) => <Input {...a} {...form.register('location')} />}
              </Field>
              <Field label="Status" error={errors.status?.message}>
                {(a) => (
                  <Select {...a} {...form.register('status')}>
                    <option value="ACTIVE">Active - accepting bookings</option>
                    <option value="INACTIVE">Inactive - hidden from booking</option>
                  </Select>
                )}
              </Field>
              <Field label="Minimum group size" required error={errors.minimumCapacity?.message}>
                {(a) => <Input {...a} type="number" min={1} max={50} {...form.register('minimumCapacity', { valueAsNumber: true })} />}
              </Field>
              <Field label="Maximum group size" required error={errors.maximumCapacity?.message}>
                {(a) => <Input {...a} type="number" min={1} max={50} {...form.register('maximumCapacity', { valueAsNumber: true })} />}
              </Field>
              <Field
                label="Hourly price (₹)"
                error={errors.hourlyPrice?.message}
                hint={config?.pricingEnabled ? 'Leave empty for a free room.' : 'Pricing is currently switched off in Schedule settings, so prices are not shown to students.'}
              >
                {(a) => <Input {...a} type="number" min={0} step="0.01" placeholder="Free" {...form.register('hourlyPrice', { valueAsNumber: true })} />}
              </Field>
              <Field label="Accessibility details" error={errors.accessibilityInfo?.message} className="sm:col-span-2">
                {(a) => <Textarea {...a} rows={2} placeholder="e.g. Step-free entrance from the main corridor." {...form.register('accessibilityInfo')} />}
              </Field>
            </div>
          </section>

          <section className={card} aria-labelledby="amenities-heading">
            <h2 id="amenities-heading" className="text-lg font-semibold">
              Amenities
            </h2>
            <p className="mt-1 text-sm text-muted">Only tick what this room really has - students filter by these.</p>
            {amenities.isPending ? (
              <Skeleton className="mt-4 h-40 w-full" />
            ) : (
              <div className="mt-4 grid gap-6 sm:grid-cols-3">
                {(['FACILITY', 'EQUIPMENT', 'ACCESSIBILITY'] as AmenityCategory[]).map((cat) => (
                  <fieldset key={cat}>
                    <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{cat.toLowerCase()}</legend>
                    {grouped[cat]?.map((a) => (
                      <Checkbox
                        key={a.id}
                        label={a.name}
                        checked={selected.includes(a.id)}
                        onChange={(e) =>
                          form.setValue('amenityIds', e.target.checked ? [...selected, a.id] : selected.filter((x) => x !== a.id), { shouldDirty: true })
                        }
                      />
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          </section>

          <section className={card} aria-labelledby="photos-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="photos-heading" className="text-lg font-semibold">
                  Photos
                </h2>
                <p className="mt-1 text-sm text-muted">The first photo is the cover. Up to 8 photos, 2 MB each.</p>
              </div>
              <div className="flex gap-2">
                <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
                <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} loading={upload.isPending} disabled={images.fields.length >= 8} icon={<Upload className="size-4" aria-hidden />}>
                  Upload
                </Button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <label htmlFor="image-url" className="sr-only">
                Image URL
              </label>
              <Input id="image-url" placeholder="https://… image URL" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!/^https:\/\/\S+$/.test(urlDraft.trim())) return toast.error('Enter an https:// image URL.')
                  images.append({ url: urlDraft.trim(), altText: '' })
                  setUrlDraft('')
                }}
                disabled={images.fields.length >= 8}
                icon={<Link2 className="size-4" aria-hidden />}
              >
                Add
              </Button>
            </div>
            {errors.images?.message && <p className="mt-2 text-xs font-medium text-danger">{errors.images.message}</p>}
            {images.fields.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-[14px] border border-dashed border-line-strong py-10 text-center text-sm text-muted">
                <ImagePlus className="size-7 text-sage-500" aria-hidden />
                <p className="mt-2">No photos yet. A branded placeholder is shown until you add one.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {images.fields.map((f, i) => (
                  <li key={f.id} className="flex flex-col gap-3 rounded-[12px] border border-line p-3 sm:flex-row sm:items-start">
                    <SmartImage src={form.watch(`images.${i}.url`)} alt="" width={240} className="aspect-[4/3] w-full shrink-0 rounded-[8px] sm:w-28" />
                    <div className="flex-1 space-y-2">
                      <p className="truncate text-xs text-muted" title={f.url}>
                        {i === 0 && <span className="mr-1.5 rounded bg-sage-100 px-1.5 py-0.5 font-medium text-sage-800">Cover</span>}
                        {form.watch(`images.${i}.url`)}
                      </p>
                      <Field label="Photo description" error={errors.images?.[i]?.altText?.message ?? errors.images?.[i]?.url?.message}>
                        {(a) => <Input {...a} className="h-9" placeholder="e.g. Long table with eight chairs" {...form.register(`images.${i}.altText`)} />}
                      </Field>
                    </div>
                    <div className="flex gap-1 sm:flex-col">
                      <Button variant="ghost" size="sm" className="px-2" disabled={i === 0} onClick={() => images.move(i, i - 1)} aria-label="Move photo up">
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="sm" className="px-2" disabled={i === images.fields.length - 1} onClick={() => images.move(i, i + 1)} aria-label="Move photo down">
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="sm" className="px-2 text-danger hover:bg-danger-soft" onClick={() => images.remove(i)} aria-label="Remove photo">
                        <Trash className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <FormError message={save.isError && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? errorMessage(save.error) : null} />
          <div className="sticky bottom-4 z-10 flex justify-end gap-3 rounded-[14px] border border-line bg-card/95 p-3 shadow-lift backdrop-blur">
            <Button variant="ghost" onClick={() => navigate('/admin/rooms')}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : 'Create room'}
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-6">
          {editing ? (
            <RoomHoursCard roomId={roomId} />
          ) : (
            <section className={card}>
              <h2 className="text-lg font-semibold">Opening hours</h2>
              <p className="mt-1 text-sm text-muted">New rooms follow the facility’s default hours. After creating the room you can give it custom hours here.</p>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
