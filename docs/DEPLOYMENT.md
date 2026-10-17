# Deploying StudyHive for free

Three free services, one for each part of the app:

```
Browser ──▶ Vercel (React site) ──/api/* forwarded──▶ Render (Spring Boot, Docker) ──TLS──▶ Aiven (MySQL)
```

Vercel forwards every `/api/...` request to Render, so the browser only ever talks to your Vercel address. That keeps
the login and CSRF cookies first-party, exactly like local development, and means no CORS set-up is needed.

These are already prepared in the repository:

* `backend/Dockerfile` builds and runs the API. It listens on the `PORT` that Render provides, is tuned for 512 MB,
  and includes a Class Data Sharing archive for faster cold starts.
* `render.yaml` is an optional Render Blueprint with the same settings as the manual steps below.
* `frontend/vercel.json` forwards `/api/*` to Render, serves `index.html` for page routes, and adds security headers.
* `.github/workflows/keep-alive.yml` is a backup pinger for 07:00–23:59 IST (see *Keeping it awake* below).
* `.gitignore` keeps `.env` files, passwords, builds and test reports out of git.

Free-tier limits change, so check each provider's current terms. Without a keep-alive pinger, the Render API **sleeps
after ~15 minutes without traffic**. In a rehearsal with Render's free limits (0.1 CPU, 512 MB) a cold start took
about 2 minutes, and the site shows a "Waking up StudyHive…" notice while it waits.

---

## Step 1: Put the code on GitHub (≈5 min)

1. Sign in at <https://github.com> and click **New repository**. Name it `studyhive` and choose **Public** (needed
   for the free keep-alive workflow). Do **not** add a README, .gitignore or licence; the project already has them.
2. In a terminal inside the project folder, run these (replace `YOUR-USERNAME`):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/studyhive.git
   git push -u origin main
   ```

3. Refresh the GitHub page and check that **no `.env` file** is listed (only `.env.example` files).

## Step 2: Create the MySQL database on Aiven (≈5 min)

1. Sign in at <https://aiven.io>. Choose the free plan; it doesn't need a card.
2. **Create service → MySQL → Free plan**, pick the region closest to you, name it `studyhive-db`, and create it.
   Wait until it says **Running** (a few minutes).
3. On the service's **Overview** page, note these values: **Host**, **Port**, **User** (`avnadmin`), **Password**,
   **Database name** (`defaultdb`), and the **CA certificate** (*Show* → copy everything from
   `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----`).

You don't need to create any tables. The API creates them on its first start (5 Flyway migrations).

## Step 3: Deploy the API on Render (≈10 min)

1. Sign in at <https://render.com> with your GitHub account.
2. Go to **New → Web Service** and connect the `studyhive` repository.
3. Fill in:
   * **Name:** `studyhive-api`. This becomes `https://studyhive-api.onrender.com`; if the name is taken, Render adds a suffix, so note your real URL.
   * **Region:** the same region as Aiven if possible.
   * **Branch:** `main`
   * **Root Directory:** `backend`
   * **Language / Runtime:** `Docker` (Render detects `backend/Dockerfile`)
   * **Instance type:** `Free`
   * **Health Check Path** (under *Advanced*): `/actuator/health`
4. Under **Environment Variables**, add these, using your Aiven values from Step 2:

   | Key | Value |
   |---|---|
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `DB_HOST` | Aiven host |
   | `DB_PORT` | Aiven port |
   | `DB_NAME` | `defaultdb` |
   | `DB_USERNAME` | `avnadmin` |
   | `DB_PASSWORD` | *(Aiven password)* |
   | `DB_SSL_MODE` | `VERIFY_CA` |
   | `DB_SSL_CA_PEM` | the whole CA certificate text, pasted as-is (multi-line is fine) |
   | `DB_POOL_SIZE` | `3` |
   | `APP_TIME_ZONE` | `Asia/Kolkata` |
   | `FRONTEND_ORIGIN` | `https://your-site.vercel.app` *(placeholder for now; fixed in Step 5)* |
   | `PUBLIC_APP_URL` | same as `FRONTEND_ORIGIN` |
   | `ADMIN_BOOTSTRAP_EMAIL` | the email for your administrator login |
   | `ADMIN_BOOTSTRAP_PASSWORD` | a new, unique password: 12–64 characters with letters and numbers |

5. Click **Create Web Service**. The first build takes about 5–10 minutes. Wait until the log shows
   `Successfully applied 5 migrations`, `Bootstrap administrator account created` and `Started StudyHiveApplication`.
   Then open `https://YOUR-RENDER-URL/api/rooms`; you should see JSON with 5 rooms.

## Step 4: Point the site and the keep-alive at Render (≈2 min)

1. Replace `YOUR-API-SERVICE.onrender.com` with your real Render host (for example `studyhive-api.onrender.com`) in
   both `frontend/vercel.json` and `.github/workflows/keep-alive.yml`. Then commit and push:

   ```bash
   git commit -am "Point Vercel rewrite and keep-alive at Render"
   git push
   ```

## Step 5: Deploy the website on Vercel (≈5 min)

1. Sign in at <https://vercel.com> with GitHub. Go to **Add New → Project** and import `studyhive`.
2. Set **Root Directory** to `frontend`. Vercel detects **Vite**; leave the build command (`npm run build`) and
   output directory (`dist`) as they are. No environment variables are needed.
3. Click **Deploy**. When it finishes, note your site URL, for example `https://studyhive-abc.vercel.app`.
4. In Render, open your service's **Environment** tab and set `FRONTEND_ORIGIN` and `PUBLIC_APP_URL` to that exact URL
   (`https`, no trailing slash). Save, and Render redeploys.

## Step 6: Check it works

* The home page shows featured rooms. The first load may take up to ~2 minutes while Render wakes up.
* Register a student, book a room, see it on the dashboard, then cancel it.
* Sign in with your admin email and open `/admin` to see the booking activity.
* Refresh a deep link such as `/rooms/2`. It should load.
* Optional: run the live race test against the deployed site:
  `python scripts/live-race-test.py https://your-site.vercel.app 2`
* **Then delete `ADMIN_BOOTSTRAP_PASSWORD` from Render.** It's only used once.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rooms don't load, or "Waking up StudyHive…" stays a long time | Render is starting. Wait two minutes. Otherwise check the Render logs. |
| Render log: `Path does not chain with any of the trust anchors` | `DB_SSL_CA_PEM` is missing or cut off. Paste the full Aiven CA certificate, including the BEGIN/END lines. |
| Render log: `Communications link failure` | Wrong Aiven host or port, or the Aiven service is powered off. |
| Render log: `Access denied for user` | Wrong `DB_USERNAME` or `DB_PASSWORD`. |
| Sign-in fails with 403 "security token" | Hard-refresh the site. If it persists, check that `/api` requests go through the Vercel URL (not directly to Render). |
| Refreshing a page like `/rooms/3` shows 404 | `frontend/vercel.json` wasn't deployed. Make sure the Root Directory is `frontend`. |
| Admin can't sign in | The bootstrap password had to be 12–64 characters with letters and numbers, and an account with that email mustn't already exist. Check the Render log for "Admin bootstrap". |
| Keep-alive workflow shows "skipping" | `API_URL` in `.github/workflows/keep-alive.yml` still has the placeholder. |

## Keeping it awake (free plan)

Render's free services sleep after ~15 minutes without traffic, and every free service in a Render workspace shares
**750 instance hours a month**. One service kept awake around the clock uses ~744 hours, so two can't both stay up
24/7 without Render suspending them partway through the month.

StudyHive is kept awake **07:00–23:59 IST (~530 hours/month)**:

* **Primary:** a free [cron-job.org](https://cron-job.org) job requests `https://YOUR-RENDER-URL/actuator/health` every
  10 minutes from 07:00 to 23:50, time zone Asia/Kolkata. cron-job.org runs on time; the health check also touches
  the database, which keeps Aiven's free MySQL from powering off.
* **Backup:** `.github/workflows/keep-alive.yml` pings during the same window. GitHub delays scheduled workflows
  (often to every ~30 minutes), so on its own it can't keep Render awake.
* **Outside the window** the API sleeps. The first visitor sees a "Waking up StudyHive…" notice for up to 2–3 minutes,
  and the page then loads by itself. Logging in and booking also wait for the server instead of failing.

Check usage under **Render → Billing → Free Instance Hours**.

## Taking it down

Delete the Render service, the Vercel project and the Aiven service, then optionally delete or archive the GitHub
repository. Nothing is billed on the free plans.
