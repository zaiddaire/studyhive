# StudyHive REST API

Interactive docs: `/swagger-ui.html` (enabled locally). Errors always use one JSON shape:
`{ status, code, message, path, fieldErrors?, errorId? }`. Clients get no stack traces or SQL.

| Method & path | Access | Purpose |
|---|---|---|
| `GET /api/auth/csrf` | public | CSRF token (also set as `XSRF-TOKEN` cookie) |
| `POST /api/auth/register` | public | Create a student account and sign in |
| `POST /api/auth/login` | public | Sign in (rate-limited, generic errors) |
| `POST /api/auth/logout` | user | End the session |
| `GET /api/auth/me` · `PUT /api/auth/me` | user | Current user · update name |
| `POST /api/auth/password/change` | user | Change password (signs out other sessions) |
| `POST /api/auth/password/forgot` · `POST /api/auth/password/reset` | public | Email-based reset (only when SMTP is configured) |
| `GET /api/config` | public | Booking rules, server date/time, time zone, default hours |
| `GET /api/amenities` | public | All amenities |
| `GET /api/rooms` | public | Search: `q, groupSize, amenities, date, startTime, duration, availableOnly, sort, page, size` |
| `GET /api/rooms/{id}` · `GET /api/rooms/{id}/availability?date=` | public | Details · slot grid for a date |
| `GET /api/images/{id}` | public | Uploaded room photo |
| `POST /api/bookings` | student | Book (header `Idempotency-Key` recommended). 201 created / 200 replay / 409 conflict |
| `GET /api/bookings/my?scope=upcoming\|past\|cancelled` · `GET /api/bookings/my/summary` | student | Own bookings · counts + next booking |
| `GET /api/bookings/{id}` · `POST /api/bookings/{id}/cancel` | owner (or admin for GET) | Details · cancel before the deadline |
| `GET/POST /api/admin/rooms` · `GET/PUT/DELETE /api/admin/rooms/{id}` | admin | Room management (delete only if never booked) |
| `PATCH /api/admin/rooms/{id}/status` | admin | Activate/deactivate, optionally cancelling future bookings |
| `GET/PUT /api/admin/rooms/{id}/hours` | admin | Room-specific or default hours |
| `POST /api/admin/uploads/images` | admin | Upload JPEG/PNG/WebP (≤ 2 MB, type checked from bytes) |
| `GET /api/admin/bookings` · `GET /api/admin/bookings/{id}` · `POST /api/admin/bookings/{id}/cancel` | admin | Search, view history, cancel with reason |
| `GET/PUT /api/admin/schedule/settings` · `GET/PUT /api/admin/schedule/hours` | admin | Booking rules · facility hours |
| `GET/POST /api/admin/schedule/blocks` · `DELETE /api/admin/schedule/blocks/{id}` | admin | Maintenance/event blocks |
| `GET /api/admin/users` · `PATCH /api/admin/users/{id}/status` | admin | List users · suspend/reactivate |
| `GET /api/admin/stats` | admin | Dashboard metrics |
| `GET /actuator/health` | public | Health check |
