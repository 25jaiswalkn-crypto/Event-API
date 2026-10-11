# Event Management & Registration API

A full-stack event management and registration app built for the GDG RBU 2026–27 Backend Web Developer recruitment task. Visitors can create accounts, browse events, and register. Administrators can manage events and see who registered for each event.

## Live Demo

| Part | URL |
|---|---|
| Frontend (Vercel) | https://event-api-two.vercel.app/ |
| Backend API (Render ) | https://event-api-qvbb.onrender.com |
| Backend and database health | https://event-api-qvbb.onrender.com/healthz |

The backend runs on Render's free service, which may spin down while idle. The first request after inactivity can take a while to respond. App data is stored in Supabase PostgreSQL, separately from the Render container.

Visitors can sign up from the website. Do not publish admin credentials in this README; the initial admin is configured through private Render environment variables.

## Tech Stack

- **Backend:** Node.js, Express 5, PostgreSQL (`pg` )
- **Authentication:** JWT and bcrypt password hashing
- **Frontend:** React and Vite
- **Other:** `express-rate-limit`, Docker
- **Hosting:** Render (API), Vercel (frontend), Supabase (PostgreSQL database)

## Features

- User signup and login with JWT
- Role-based access: regular users and administrators
- Browse, search, and filter events
- View event details, register, and unregister
- Database protection against duplicate registrations
- Transactional capacity checks to prevent overbooking
- Event capacity cannot be lowered below current registrations
- View your own registrations
- Admin event creation, editing, and deletion
- Admin-only attendee list showing participant names, emails, and registration times
- Database migrations run automatically at backend startup
- `/healthz` endpoint checks the API and database connection
- API request rate limiting

## Project Structure

```text
├── index.js                         API entry point and startup sequence
├── db.js                            PostgreSQL pool, migrations, admin seed
├── migrate.js                       Run schema migrations manually
├── makeadmin.js                     Run the configured admin seed manually
├── migrations/                      Versioned PostgreSQL schema migrations
├── middleware/                      JWT authentication and rate limiting
├── routes/                          Authentication, event, and registration APIs
├── frontend/                        React/Vite website
├── Dockerfile                       Production container used by Render
└── .env.example                     Placeholder environment variables
```

## Environment Variables

### Backend — Render or private local `.env`

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | Supabase PostgreSQL **Session pooler** connection string; keep private |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters for signing tokens |
| `ADMIN_EMAIL` | For initial admin | Email address for the first administrator |
| `ADMIN_PASSWORD` | For initial admin | Unique initial admin password, at least 12 characters |
| `ADMIN_NAME` | No | Initial admin display name; defaults to `Event Administrator` |
| `PORT` | No | Server port; defaults to `3000` locally and honors Render's assigned port |

The backend runs schema migrations before accepting requests. If the database has no administrator, it creates the initial admin using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The password is hashed before storage. Existing admin passwords are not overwritten; public signups receive the regular-user role.

Never put `DATABASE_URL`, `JWT_SECRET`, or `ADMIN_PASSWORD` in Vercel, frontend code, GitHub, or this README. Do not commit `.env`.

Generate a JWT secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend — Vercel or `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Public backend API base URL, including `/api`; e.g. `https://event-api-qvbb.onrender.com/api` |

Vite includes `VITE_API_URL` in the frontend build, so redeploy the frontend after changing it. This variable is public and must not contain secrets.

## Local Setup

A reachable PostgreSQL database is required. Create a private `.env` file from the example and enter your own values:

```powershell
Copy-Item .env.example .env
```

### Backend

From the repository root:

```powershell
npm ci
npm start
```

The API runs at `http://localhost:3000` unless `PORT` is set. On startup, it applies pending migrations and seeds an initial admin if appropriate.

Check the database connection at `http://localhost:3000/healthz`. A healthy response looks like:

```json
{"ok":true,"database":"connected"}
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`. The frontend defaults to `http://localhost:3000/api` for local requests. Set `VITE_API_URL` if your backend uses a different address.

## Deployment

### Backend on Render

Connect the repository's `main` branch to the Render web service. Use the root `Dockerfile`, configure the required backend environment variables under **Render → Event-API → Environment**, and set the health-check path to:

```text
/healthz
```

Migrations and the initial admin seed run automatically when the backend starts.

After deployment, visit `https://event-api-qvbb.onrender.com/healthz`. A healthy response includes `"database":"connected"`.

### Frontend on Vercel

- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_URL=https://event-api-qvbb.onrender.com/api`

Redeploy after changing the Vercel environment variable because Vite reads it during the build.

## API Endpoints

Protected requests use the header `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/healthz` | Public | Check API and PostgreSQL connectivity |
| `POST` | `/api/auth/register` | Public | Create a regular user account |
| `POST` | `/api/auth/login` | Public | Log in and receive a JWT |
| `GET` | `/api/events?search=&category=` | Public | List, search, and filter events |
| `GET` | `/api/events/:id` | Public | Get event details and registration count |
| `POST` | `/api/events` | Admin | Create an event |
| `PUT` | `/api/events/:id` | Admin | Update an event |
| `DELETE` | `/api/events/:id` | Admin | Delete an event |
| `GET` | `/api/events/:id/registrations` | Admin | List an event's attendees |
| `POST` | `/api/events/:id/register` | Signed-in user | Register for an event |
| `DELETE` | `/api/events/:id/register` | Signed-in user | Unregister from an event |
| `GET` | `/api/registrations/me` | Signed-in user | List the signed-in user's registrations |

### Example: Register a user

```bash
curl -X POST https://event-api-qvbb.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha","email":"asha@example.com","password":"replace-with-a-strong-password"}'
```

### Example: Log in

```bash
curl -X POST https://event-api-qvbb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.com","password":"replace-with-a-strong-password"}'
```

### Example: View an event's attendee list as an admin

```bash
curl https://event-api-qvbb.onrender.com/api/events/1/registrations \
  -H "Authorization: Bearer <admin-jwt>"
```

Attendee information is personal data. Only admins can access the attendee endpoint. Do not share its output publicly.

## Database and Data Notes

The PostgreSQL schema contains `users`, `events`, and `registrations`. The migration system records applied files in `schema_migrations`. Add future schema changes as new numbered SQL files; do not edit a migration that has already run in production.

A new PostgreSQL database starts empty. This deployment does not copy records from an older SQLite database, so existing events and accounts must be recreated unless they are imported separately from a backup. Once data is in Supabase PostgreSQL, a Render restart or redeploy does not remove it. Free services may sleep or pause, delaying requests; keep backups for important records and review current provider limits.

## Common Error Codes

- `400` — invalid request data
- `401` — missing or invalid login token
- `403` — user lacks admin access
- `404` — event or registration not found
- `409` — duplicate registration or event capacity reached
- `429` — rate limit exceeded

## Security Notes

- Passwords are hashed with bcrypt and never returned by the API.
- SQL statements use parameters.
- Event capacity is checked inside a transaction.
- Admin endpoints require a valid JWT and the admin role.
- The attendee roster does not return password hashes or authentication tokens.
- Automated test scripts are not yet configured. To check the frontend production build, run `cd frontend` followed by `npm run build`.
