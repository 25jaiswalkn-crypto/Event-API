# Event Management & Registration API

A RESTful API where users can browse events and register for them, and admins manage events.
Built for the GDG RBU 2026-27 Backend Web Developer recruitment task.

## Tech Stack
- Node.js + Express
- SQLite (better-sqlite3)
- JWT authentication (jsonwebtoken) + bcrypt password hashing (bcryptjs)

## Features
- User signup and login with JWT
- Role-based access (user / admin)
- Admin CRUD for events (title, description, date/time, venue, capacity, category)
- Search and filter events
- Register / unregister for events
- Duplicate registrations blocked (database UNIQUE constraint + friendly 409 error)
- Capacity enforced inside a database transaction, so no overbooking
- "My registrations" endpoint

## Setup
```bash
git clone https://github.com/25jaiswalkn-crypto/Event-API.git
cd Event-API
npm install
cp .env.example .env     # on Windows: copy .env.example .env
node index.js
```
The server runs on http://localhost:3000. The SQLite database file (`events.db`) is created automatically.

### Create an admin
Register a user, then edit the email in `makeadmin.js` and run:
```bash
node makeadmin.js
```
Log in again to get a token with the admin role.

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
- 404 not found, 409 duplicate registration or event full

## Database
Tables: `users`, `events`, `registrations` (with `UNIQUE(user_id, event_id)`).