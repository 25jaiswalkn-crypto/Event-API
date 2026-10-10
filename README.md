# Event Management & Registration API

A RESTful API where users browse events and register for them, and admins manage events.
Includes a React frontend. Built for the GDG RBU 2026-27 Backend Web Developer recruitment task.

## Tech Stack
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Auth:** JWT (jsonwebtoken) + bcrypt password hashing (bcryptjs)
- **Frontend:** React (Vite)
- **Extras:** rate limiting (express-rate-limit), Docker

## Features
- User signup and login with JWT
- Role-based access (user / admin)
- Admin CRUD for events (title, description, date/time, venue, capacity, category)
- Search and filter events
- Register / unregister for events
- Duplicate registrations blocked (database UNIQUE constraint + friendly 409 error)
- Capacity enforced inside a database transaction, so no overbooking
- "My registrations" endpoint
- Rate limiting: 300 requests / 15 min per IP overall, 10 failed login attempts / 15 min per IP
- React UI: browse, search, filter, details, register/unregister, my registrations, admin panel

## Project Structure
```
├─ index.js            server entry
├─ db.js               SQLite setup and tables
├─ middleware/         auth (JWT, admin check) and rate limiting
├─ routes/             auth, events, registrations
├─ makeadmin.js        script to promote a user to admin
├─ frontend/           React app (Vite)
├─ Dockerfile, docker-compose.yml
```

## Setup

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
Register a user (through the UI or API), put that email in `makeadmin.js`, then run:
```bash
node makeadmin.js
```
Log in again to get a token with the admin role.

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
| GET | /api/events?search=&category= | Public | List/search/filter events |
| GET | /api/events/:id | Public | Event details |
| POST | /api/events | Admin | Create event |
| PUT | /api/events/:id | Admin | Update event |
| DELETE | /api/events/:id | Admin | Delete event |
| POST | /api/events/:id/register | User | Register for event |
| DELETE | /api/events/:id/register | User | Unregister |
| GET | /api/registrations/me | User | My registered events |

Protected routes need the header: `Authorization: Bearer <token>`

## Error Codes
- 400 validation error, 401 missing/invalid token, 403 not admin
- 404 not found, 409 duplicate registration or event full, 429 too many requests

## Database
Tables: `users`, `events`, `registrations` (with `UNIQUE(user_id, event_id)` and cascading deletes).