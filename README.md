# Event Management & Registration API

A RESTful API where users browse events and register for them, and admins manage events.
Includes a React frontend. Built for the GDG RBU 2026-27 Backend Web Developer recruitment task.

## Live Demo

| | URL |
|---|---|
| Frontend (Vercel) | https://event-api-two.vercel.app/ |
| Backend API (Render) | https://event-api-qvbb.onrender.com |
| API health check | https://event-api-qvbb.onrender.com/ |

> The backend runs on Render's free tier, so the first request after a period of inactivity can take
> 30-60 seconds while the service wakes up. Please wait for it and retry.

**Demo accounts** (optional, add if you want reviewers to log in quickly)

| Role | Email | Password |
|---|---|---|
| Admin | `<admin email>` | `<password>` |
| User | `<user email>` | `<password>` |

## Tech Stack
- **Backend:** Node.js, Express 5, SQLite (better-sqlite3)
- **Auth:** JWT (jsonwebtoken) + bcrypt password hashing (bcryptjs)
- **Frontend:** React 19 (Vite)
- **Extras:** rate limiting (express-rate-limit), Docker, role-based access control
- **Hosting:** Render (API), Vercel (frontend)

## Features
- User signup and login with JWT
- Role-based access (user / admin)
- Admin CRUD for events (title, description, date/time, venue, capacity, category)
- Search and filter events
- Register / unregister for events
- Duplicate registrations blocked (database UNIQUE constraint + friendly 409 error)
- Capacity enforced inside a database transaction, so no overbooking
- Capacity cannot be lowered below the current number of registrations
- "My registrations" endpoint
- Secure first-admin bootstrap endpoint (no manual database edits needed in production)
- Rate limiting: 300 requests / 15 min per IP overall, 10 failed login attempts / 15 min per IP
- React UI: browse, search, filter, details, register/unregister, my registrations, admin panel

## Project Structure
```
├─ index.js            server entry
├─ db.js               SQLite setup and tables
├─ middleware/         auth (JWT, admin check) and rate limiting
├─ routes/             auth, events, registrations
├─ makeadmin.js        local script to promote a user to admin
├─ frontend/           React app (Vite)
├─ Dockerfile, docker-compose.yml
└─ .env.example
```

## Environment Variables

### Backend (`.env`)
| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Long random string used to sign tokens |
| `PORT` | No | Defaults to `3000` (Render sets this automatically) |
| `ADMIN_EMAIL` | No | Email allowed to become the first admin via `/api/auth/bootstrap-admin` |
| `DB_DIR` | No | Folder for `events.db` (defaults to the project folder) |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL including `/api`, e.g. `https://event-api-qvbb.onrender.com/api`. Defaults to `http://localhost:3000/api` |

## Local Setup

### 1. Backend
```bash
git clone https://github.com/25jaiswalkn-crypto/Event-API.git
cd Event-API
npm install
cp .env.example .env     # on Windows: copy .env.example .env
node index.js
```
The API runs on http://localhost:3000. The SQLite file `events.db` is created automatically.

### 2. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

### 3. Create an admin

**Option A: bootstrap endpoint (works locally and in production)**
1. Set `ADMIN_EMAIL=you@example.com` in `.env` and restart the server.
2. Register and log in with that email.
3. Send `POST /api/auth/bootstrap-admin` with your `Authorization: Bearer <token>` header.
4. Log out and log back in to get a token with the admin role.

This only works for the account matching `ADMIN_EMAIL`, and stops working once any admin exists.

**Option B: local script**
Edit the email in `makeadmin.js`, then run `node makeadmin.js`. Log in again afterwards.

## Deployment

### Backend on Render
1. Create a new **Web Service** from the GitHub repo.
2. Build command: `npm install`  |  Start command: `node index.js`
3. Add environment variables: `JWT_SECRET`, `ADMIN_EMAIL`.
4. Deploy and copy the service URL.

> **Note:** SQLite stores data in a local file. On Render's free tier the filesystem is ephemeral, so
> data can reset when the service restarts or redeploys. For persistent data, attach a Render
> persistent disk and set `DB_DIR` to its mount path.

### Frontend on Vercel
1. Import the repo in Vercel and set the **Root Directory** to `frontend`.
2. Add the environment variable `VITE_API_URL` = `https://event-api-qvbb.onrender.com/api`.
3. Deploy. Redeploy after changing the variable, since Vite reads it at build time.

### Docker (optional)
```bash
docker compose up --build
```
The API runs on http://localhost:3000 and the database is stored in `./data`.
Note: the Docker files are provided but have not been tested on the author's machine.

## API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/register | Public | Create an account |
| POST | /api/auth/login | Public | Log in, returns JWT |
| POST | /api/auth/bootstrap-admin | Logged in | Promote the `ADMIN_EMAIL` account to the first admin |
| GET | /api/events?search=&category= | Public | List/search/filter events |
| GET | /api/events/:id | Public | Event details |
| POST | /api/events | Admin | Create event |
| PUT | /api/events/:id | Admin | Update event |
| DELETE | /api/events/:id | Admin | Delete event |
| POST | /api/events/:id/register | User | Register for event |
| DELETE | /api/events/:id/register | User | Unregister |
| GET | /api/registrations/me | User | My registered events |

Protected routes need the header: `Authorization: Bearer <token>`

### Example requests

**Register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha","email":"asha@example.com","password":"secret123"}'
```

**Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.com","password":"secret123"}'
# -> { "token": "...", "user": { "id": 1, "name": "Asha", "email": "...", "role": "user" } }
```

**Create an event (admin)**
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Intro to Web Dev","description":"Workshop","date_time":"2026-11-20T15:00:00","venue":"Seminar Hall","capacity":50,"category":"Workshop"}'
```

**Register for an event**
```bash
curl -X POST http://localhost:3000/api/events/1/register \
  -H "Authorization: Bearer <token>"
# -> 201 { "id": 1, "event_id": 1, "message": "registered successfully" }
```

## Error Codes
- 400 validation error, 401 missing/invalid token, 403 not admin
- 404 not found, 409 duplicate registration or event full, 429 too many requests

## Database
Tables: `users`, `events`, `registrations` (with `UNIQUE(user_id, event_id)` and cascading deletes).

## Design Notes
- Passwords are hashed with bcrypt and never returned by the API.
- Registration (duplicate check, capacity check, insert) runs inside a single SQLite transaction to prevent overbooking.
- All SQL uses parameterized queries.
- Admin-only routes pass through `authenticate` then `requireAdmin` middleware.

## Known Limitations
- No automated tests yet.
- SQLite is single-file storage; a hosted database would be a better fit for larger scale.
