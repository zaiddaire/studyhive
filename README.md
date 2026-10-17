# StudyHive

**Your group. Your space. Your goals.**

**Live demo:** https://studyhive-psi.vercel.app · API health: https://studyhive-api-lmsy.onrender.com/actuator/health
(free hosting: the API may take a minute to wake if it has been idle)

StudyHive is a full-stack group study room booking platform. Students find private study rooms (typically for 6–8 people),
check live availability, and reserve the **whole room** for their group for a time slot. Administrators manage rooms,
opening hours, maintenance blocks, bookings and users.

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router, Tailwind CSS 4, Motion, Lucide, React Hook Form + Zod, TanStack Query, react-day-picker |
| Backend | Java 21, Spring Boot 3.5 (Web, Data JPA, Security, Validation, Actuator, Session JDBC), Maven, springdoc OpenAPI |
| Database | MySQL 8 (Aiven in production), Flyway migrations |
| Tests | JUnit 5, Spring Boot Test, MockMvc, Mockito, Testcontainers (real MySQL); Vitest + React Testing Library |
| Hosting (free) | Vercel (frontend) · Render (API, Docker) · Aiven (MySQL). Railway config included as a paid alternative. |

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Run it locally](#run-it-locally)
4. [Tests](#tests)
5. [Deploy for free (Aiven + Render + Vercel)](#deploy-for-free-aiven--render--vercel)
6. [Configuration reference](#configuration-reference)
7. [REST API](#rest-api)
8. [How double booking is prevented](#how-double-booking-is-prevented)
9. [Security](#security)
10. [Booking edge cases](#booking-edge-cases)
11. [Project structure](#project-structure)
12. [Known limitations](#known-limitations)

---

## Features

**Students**
- Landing page with a quick search (date, start time, duration, group size) that opens live results.
- Room browsing with text search, group-size, amenity and availability filters, sorting and pagination (state kept in the URL).
- Room pages with a photo gallery, amenities, accessibility notes, opening hours, booking rules and a live slot grid.
- Three-step booking flow (time → group details → review) with an animated confirmation and booking reference.
- Dashboard: next session with a countdown, upcoming / history / cancelled lists, cancellation with confirmation, `.ics` calendar export.
- Account: sign up, log in, log out, profile name, password change, password reset by email (when SMTP is configured).

**Administrators** (`/admin`)
- Overview computed from live data: rooms, reservations today, upcoming, cancelled, 7-day utilisation per room, next-7-days chart, recent activity.
- Rooms: create, edit, upload or link photos, amenities, capacity, optional hourly price, activate/deactivate (optionally cancelling future bookings), delete only if never booked, per-room opening hours.
- Bookings: search by reference, student, room, status and date range; view history; cancel with a reason.
- Schedule: slot length, min/max duration, advance window, cancellation deadline, per-student limit, pricing toggle, facility hours, maintenance/event blocks (optionally cancelling affected bookings).
- Users: search, suspend (ends their sessions immediately) and reactivate.

---

## Architecture

```
Browser ──► Vercel (React SPA)
              │  /api/*  (rewrite = same-origin proxy, so session cookies stay first-party)
              ▼
           Render / Railway (Spring Boot API, Docker)
              │  JDBC over TLS (VERIFY_CA with Aiven's CA certificate)
              ▼
           Aiven MySQL 8  ◄── Flyway migrations run on start-up
```

- **Sessions**: Spring Security with a server-side session stored in MySQL (Spring Session JDBC), referenced by an
  HTTP-only `STUDYHIVE_SESSION` cookie. No tokens in `localStorage`. Sessions survive restarts and sleeping free instances.
- **CSRF**: double-submit token (`XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header) on every state-changing request; the token is rotated at login.
- **Time zones**: booking times are facility-local wall-clock values in `APP_TIME_ZONE` (default `Asia/Kolkata`), stored
  exactly as entered. The server clock decides "now". Audit timestamps are stored in UTC. The UI shows booking times
  exactly as stored, whatever the browser's time zone.

---

## Run it locally

**Prerequisites:** Java 21, Maven 3.9+, Node 20+ (24 recommended), Docker Desktop.

```bash
cp .env.example .env
```

Edit `.env`: set `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and optionally `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
(12–64 characters with letters and digits) to create a local administrator.

```bash
docker compose up -d mysql
```

Start the API with the variables from `.env` (Flyway creates the schema and the sample rooms on first start).
In PowerShell:

```bash
.\scripts
un-backend.ps1
```

Or in Git Bash, macOS or Linux:

```bash
./scripts/run-backend.sh
```

In another terminal, start the web app (Vite proxies `/api` to `http://localhost:8080`):

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. Swagger UI (local only by default): http://localhost:8080/swagger-ui.html

> Everything in Docker instead: `docker compose --profile app up -d --build`, then run only the frontend.

**Sample data.** `db/demo/V100__demo_rooms.sql` seeds six sample rooms (five active, one inactive to show admin behaviour).
They are illustrative records, not real facilities. To start without them, set `FLYWAY_LOCATIONS=classpath:db/migration`
before the very first start of a new database.

---

## Tests

```bash
cd backend && mvn verify
```

```bash
cd frontend && npm test
```

```bash
cd frontend && npm run lint && npm run build
```

Backend integration tests start a throwaway **MySQL 8.4 container** with Testcontainers (Docker must be running). They
never touch a shared or production database.

**Last recorded run (17 Oct 2026):**

| Suite | Result |
|---|---|
| Backend: unit tests (booking rules, slot calculator, references, image sniffing, TLS config) | 28 passed |
| Backend: integration tests on MySQL (auth, CSRF browser flow, rooms, availability, bookings, admin, migrations) | 49 passed |
| Backend: concurrency (12 overlapping requests, 10 identical requests, 5 parallel rooms, 5 duplicate submissions) | 4 passed |
| **Backend total** | **81 passed, 0 failed** |
| Frontend: logic, API client (incl. cold-start waits), schemas | 25 passed |
| Frontend: components (login/register, slot grid, room card, room filters, booking flow incl. 409 and offline, dashboard + cancel) | 17 passed |
| **Frontend total** | **42 passed, 0 failed** |

The full student and admin journeys were also exercised manually in a browser against the real API and MySQL
(sign up → search → book → conflicting booking by a second student → 409 handled → cancel → admin console), at 1440 px and 390 px widths.

**Live race test** against any running API (local or deployed). It registers 8 throwaway students who all try to
book overlapping times at the same moment, checks that only non-overlapping requests win and that the rest get 409,
then cancels everything it created:

```bash
python scripts/live-race-test.py http://localhost:8080 2
```

Last local run: 2 back-to-back winners, 6 conflicts, no overlap, privacy check passed.

CI (`.github/workflows/ci.yml`) runs both suites on every push and pull request.

---

## Deploy for free (Aiven + Render + Vercel)

```
Browser ──▶ Vercel (React) ──/api/* forwarded──▶ Render (Spring Boot, Docker) ──TLS──▶ Aiven (MySQL)
```

Step-by-step guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**, which covers GitHub, Aiven, Render and Vercel, the
environment variables, the keep-alive workflow and troubleshooting.

Measured in a rehearsal with Render's free limits (0.1 CPU, 512 MB): the production image uses about 310 MB of memory
and starts in about 115 seconds. That's with the Class Data Sharing archive built into the Dockerfile; without it,
start-up took 342 seconds. A cron-job.org job (with `.github/workflows/keep-alive.yml` as backup) keeps the API awake 07:00–23:59 IST,
within Render's 750 free hours a month. If it does sleep, the site shows a "Waking up StudyHive…" notice and
retries for up to three minutes.

`backend/railway.json` is included as a paid alternative to Render.

---

## Configuration reference

Backend (`backend/.env.example` lists everything):

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `local` | Use `prod` in production (secure cookies, TLS verify, Swagger off) |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USERNAME` `DB_PASSWORD` | local values | MySQL connection |
| `DB_URL` | – | Full JDBC URL override |
| `DB_SSL_MODE` | `PREFERRED` (local) / `VERIFY_CA` (prod) | Connector/J `sslMode` |
| `DB_SSL_CA_PEM` | – | CA certificate (PEM or base64), turned into an in-memory trust store at start-up |
| `DB_POOL_SIZE` | `5` | Hikari pool size (use 3 on small free databases) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origins (comma-separated, never `*`) |
| `PUBLIC_APP_URL` | `http://localhost:5173` | Used in password-reset links |
| `APP_TIME_ZONE` | `Asia/Kolkata` | Facility time zone for all booking rules |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | `false`/`lax` locally, `true` in prod | Session and CSRF cookie flags |
| `SESSION_TIMEOUT` | `7d` | Session lifetime |
| `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD` / `_NAME` | – | One-time first-admin creation |
| `MAIL_ENABLED`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | off | SMTP for password resets |
| `FLYWAY_LOCATIONS` | migrations + demo rooms | Exclude demo rooms with `classpath:db/migration` |
| `API_DOCS_ENABLED` | `true` local / `false` prod | Swagger UI and OpenAPI JSON |
| `PORT` | `8080` | Provided by the hosting platform |

Frontend (`frontend/.env.example`): `VITE_API_BASE_URL` (leave empty), `VITE_SUPPORT_EMAIL` (optional),
`DEV_API_PROXY_TARGET` (local dev proxy target).

**Administrator accounts** are never created through public sign-up. The first admin comes only from the bootstrap
variables. The bootstrap never modifies an existing account, so a pre-registered student with that email can't be
promoted, and it refuses weak passwords.

---

## REST API

The full endpoint list (access rules, parameters and status codes) is in [docs/API.md](docs/API.md). Swagger UI is
available locally at `/swagger-ui.html`. Every error uses one JSON shape: `{ status, code, message, path, fieldErrors?, errorId? }`.

---

## How double booking is prevented

Creating a booking (`BookingService`) runs in one transaction at **READ COMMITTED** isolation:

1. Lock the student's row, then the room's row (`SELECT … FOR UPDATE`), always in that order, so there are no deadlocks.
   Concurrent requests for the same room queue up; requests for different rooms run in parallel.
2. With both locks held, check the time rules, capacity, blocked periods, overlapping bookings
   (`existing.start < requested.end AND existing.end > requested.start`, only for `CONFIRMED`/`COMPLETED`), the student's
   own overlaps, and the active-booking limit.
3. Insert the booking with a unique human-readable reference (`SH-XXXXXX`).

READ COMMITTED matters. Under MySQL's default REPEATABLE READ, a transaction that waited for the lock could check
overlaps against an old snapshot and miss the booking it was waiting on. The losing request gets **HTTP 409
`SLOT_TAKEN`**, and the UI refreshes availability and asks the student to choose another slot.

**Duplicate submissions:** each booking attempt carries an `Idempotency-Key`. A retry with the same key (double-click,
lost response, flaky network) returns the original booking (HTTP 200) instead of creating a second one, backed by a
unique `(user_id, idempotency_key)` constraint. Room deactivation and maintenance blocks lock the same room rows, so they
can't race a booking either.

This is verified against real MySQL by `ConcurrentBookingIntegrationTest`.

---

## Security

- Passwords hashed with Spring Security's delegating encoder (BCrypt). Hashes never leave the server.
- Session cookie is HTTP-only, `Secure` in production and `SameSite=Lax`. CSRF protection stays on everywhere,
  including login. The session id and CSRF token are rotated at login.
- Login is throttled per email and IP and per IP, with generic "Invalid email or password." messages. A suspended
  account is only revealed after a correct password. Sign-up, password change and reset requests are rate-limited.
- Authorisation is enforced on the server: role checks for `/api/admin/**` (URL rules and `@PreAuthorize`), and owner
  checks on bookings. Other people's bookings return 404, so their existence isn't leaked.
- Suspending a user or resetting a password ends that user's sessions immediately. Every request re-checks that the
  account is still active.
- All queries go through JPA/JPQL parameters, and LIKE wildcards in search terms are escaped.
- Bean Validation on every request body. JSON bodies are capped at 64 KB and uploads at 2 MB, with image types checked
  from the file bytes.
- CORS allows only the configured origins with credentials (never `*`). Security headers come from Spring Security and
  `vercel.json`.
- No secrets in the repository: `.env` files are git-ignored and only `.env.example` placeholders are committed.
  The database CA certificate is supplied at runtime.

---

## Booking edge cases

| Case | Behaviour |
|---|---|
| Same room, overlapping time, two users | Only one succeeds. The other gets 409 `SLOT_TAKEN` (tested with 12 concurrent requests) |
| Different rooms, same time | Both succeed |
| Group larger or smaller than the room allows | 422 `GROUP_SIZE_OUT_OF_RANGE`; the form shows the room's range |
| Booking in the past / beyond the advance window | 422 `IN_PAST` / `TOO_FAR_AHEAD` |
| Cancelling someone else's booking | 404 (no information leak) |
| Inactive room / closed day / outside hours / off-grid times | 422 `ROOM_INACTIVE` / `ROOM_CLOSED` / `OUTSIDE_OPERATING_HOURS` / `MISALIGNED_TIME` |
| Overlaps a maintenance block | 422 `ROOM_BLOCKED` |
| Invalid or missing dates, end before start | 400 `VALIDATION_FAILED` / `MALFORMED_REQUEST` / `INVALID_TIME_RANGE` |
| Cancelled booking | Frees the slot immediately |
| Room deactivated with future bookings | New bookings stop. Existing ones are kept, or cancelled with a reason if the admin chooses |
| Database unavailable | 503 with "nothing was saved"; queries retry |
| Network lost during booking | The UI keeps the review step and says retrying is safe (same idempotency key) |
| Duplicate submission | Same booking returned; never two |
| Student already booked elsewhere at that time / too many upcoming bookings | 409 `USER_DOUBLE_BOOKED` / 422 `TOO_MANY_ACTIVE_BOOKINGS` |

---

## Project structure

```
backend/
  src/main/java/com/studyhive/
    config/       app properties, clock, DB TLS trust store, admin bootstrap, OpenAPI
    security/     security filter chain, CSRF, principal, rate limiter, account-status filter
    controller/   thin REST controllers
    service/      booking rules, availability, bookings, rooms, schedule, admin, auth
    repository/   Spring Data JPA repositories (locking + overlap queries)
    entity/ dto/ mapper/ exception/
  src/main/resources/db/migration   Flyway schema + reference data
  src/main/resources/db/demo        sample rooms
  src/test/                         unit, integration (Testcontainers MySQL) and concurrency tests
frontend/
  src/app            providers + routes      src/components   UI kit, layout, logo
  src/features/*     landing, auth, rooms, bookings, student-dashboard, admin
  src/lib            API client, time + booking helpers       src/services   typed API calls
  src/schemas        Zod form schemas        src/types        API types      src/test   test utilities
docs/                DEPLOYMENT.md (free hosting guide), API.md (endpoint reference)
scripts/             run-backend.ps1 / .sh (start the API from .env), live-race-test.py
.github/workflows/   ci.yml (tests on every push), keep-alive.yml (keeps the free API awake)
docker-compose.yml   local MySQL (+ optional API container)
render.yaml          Render blueprint (free API hosting)
```

---

## Known limitations

- Free hosting sleeps when idle, so the first request after a while is slow. The app waits and retries automatically.
- Login throttling counters live in memory. That's right for a single API instance; use a shared store if you scale out.
- Password reset needs an SMTP provider. Without one, the UI says reset by email isn't available.
- Uploaded photos are stored in MySQL (≤ 2 MB each) so they survive redeploys on hosts without persistent disks. For
  heavy use, move them to object storage.
- Prices are informational only. There is no payment integration.
