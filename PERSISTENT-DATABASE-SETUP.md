# Event API: Persistent PostgreSQL, Admin Seed, and Attendee Lists

This update moves the backend from local SQLite to PostgreSQL, adds a database-aware health check, runs versioned SQL migrations at startup, seeds one admin from server-only environment variables, and adds an admin-only participant list for each event.

## Why Supabase for this free demo

Render Free web services use temporary container files, so a SQLite file on the service is not durable. Render's free Postgres also expires after 30 days. Supabase Free Postgres can pause after a week of low activity, but its documentation says a paused project can be resumed with its data and configuration for up to one year. That means it may be unavailable until resumed, but a Render restart/redeploy no longer deletes the database file.

For continuously available service and longer retention, a paid database plan is required. Free tiers can change; review the provider limits before relying on this for important records.

## 1. Create the Supabase database

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Choose and save a strong database password; do not reuse the app-admin password.
2. In the project, choose **Connect** and copy the **Session pooler** PostgreSQL connection string. A Render web service is a long-running backend; the session pooler is the compatible choice when the service connects over IPv4. Use the URI exactly as Supabase provides it, including the SSL query setting. Replace its password placeholder only if needed, URL-encoding any reserved characters.
3. Keep this connection string private. It belongs only in Render's backend environment, never in Vercel or frontend source.

## 2. Set Render environment variables before deploying this code

Open **Render → Event-API → Environment** and set:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | The Supabase Session pooler connection string copied from **Connect** |
| `JWT_SECRET` | A random secret of at least 32 characters |
| `ADMIN_EMAIL` | The email address for the initial administrator, in lowercase |
| `ADMIN_PASSWORD` | A unique password of at least 12 characters for the initial administrator |
| `ADMIN_NAME` | Optional; defaults to `Event Administrator` |
| `PORT` | Keep `3000` if already set; the app also respects Render's `PORT` |

Generate a JWT secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Choose a separate strong `ADMIN_PASSWORD` and store it in a password manager. Render values are private server-side environment variables. **Do not put `DATABASE_URL`, `JWT_SECRET`, or `ADMIN_PASSWORD` in Vercel.** Vercel only needs the browser-safe variable `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`.

Set `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` before pushing the backend changes. Without `DATABASE_URL`, the new backend intentionally stops at startup rather than silently creating another temporary database. Do not remove `ADMIN_PASSWORD` if you want the account to be recreated automatically if the database is ever empty again; the seeder never changes the password of an existing admin.

## 3. Apply the code update

The included code is based on GitHub commit `48b5d43` (`Use authenticated first-admin setup`). Apply the accompanying patch to that source, review it, then commit and push to `main`. Do not overwrite your `.git` folder or any local changes.

The relevant new/changed files are:

- `db.js`, `migrations/001_initial_schema.sql`, `migrate.js`: PostgreSQL connection pool and version-tracked schema migrations.
- `index.js`: runs migrations and the admin seed before listening; serves `/healthz` that tests database connectivity.
- `routes/auth.js`, `routes/event.js`, `routes/registration.js`: PostgreSQL-backed APIs; adds `GET /api/events/:id/registrations`, restricted to admins.
- `frontend/src/App.jsx`, `frontend/src/index.css`: adds a per-event **Attendees** button in the Admin screen and a table with participant name, email, and registration time.
- `makeadmin.js`: replaces the unsafe hard-coded SQLite helper with a PostgreSQL seed command.
- `package.json`, `package-lock.json`, `Dockerfile`: use the `pg` driver instead of SQLite.

The startup migration creates a `schema_migrations` history table and applies each numbered `.sql` file once. Add later schema changes as new migration files with names that sort after `001_initial_schema.sql`; don't edit a migration that has already been applied to production.

## 4. Render deployment settings

Keep the service connected to the GitHub `main` branch, root directory `.`, build context `.`, Dockerfile `Dockerfile`, and start command from the Dockerfile (`npm start`). In **Settings**, set **Health Check Path** to:

```text
/healthz
```

Push the source changes. In the deploy logs, look for `Applied database migration: 001_initial_schema.sql`, a default-admin seed message, and `Event API listening ...`. Then check **Logs** or open:

```text
https://YOUR-RENDER-SERVICE.onrender.com/healthz
```

A healthy database connection returns `{"ok":true,"database":"connected"}`. `/` alone only proves that the server responds; it does not verify the database.

## 5. Sign in and verify safely

1. Open the production Vercel site.
2. Log in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`; the initial admin is created from Render's environment at backend startup, so a separate signup or public promotion route is not needed.
3. Open **Admin**. Each event shows the current registered count/capacity. Click **Attendees** to load the roster. Only an authenticated admin can access the API route and see participant names/emails.
4. A regular attendee can see only their own registrations on **My registrations**.
5. Test with a controlled account/email and one event. Avoid using real participant data until the database connection and backup approach are in place.

The admin attendee endpoint intentionally returns only `registration_id`, `registered_at`, `user_id`, `name`, and `email`; it never returns password hashes or JWTs.

## Existing data and reset warning

The migration creates a new, empty PostgreSQL database. It does **not** copy rows out of Render's SQLite file. Your last live API check returned an empty event list, so recreate the events and accounts after the new backend is live. If a SQLite backup exists on your own computer, it would require a separate one-time import; do not assume Render's temporary SQLite data is available to copy.

## Free-tier pause behavior

Supabase Free can pause after seven days of low activity. Resume it from the Supabase Dashboard if it pauses; the docs state the paused project can be restored with its data/configuration for up to one year. This is a downtime/availability limit, distinct from the app's database persistence. For records that matter, schedule backups and use a paid plan with the provider's backup guarantees.

Sources: [Render Free services](https://render.com/docs/free), [Render persistent disks](https://render.com/docs/disks), [Supabase free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations).
