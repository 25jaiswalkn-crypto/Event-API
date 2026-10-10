const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/events/:id/register
router.post('/events/:id/register', authenticate, (req, res) => {
  const eventId = Number(req.params.id);
  const userId = req.user.id;

  const registerTx = db.transaction(() => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) return { status: 404, body: { error: 'event not found' } };

    const already = db
      .prepare('SELECT id FROM registrations WHERE user_id = ? AND event_id = ?')
      .get(userId, eventId);
    if (already) return { status: 409, body: { error: 'already registered for this event' } };

    const count = db
      .prepare('SELECT COUNT(*) AS c FROM registrations WHERE event_id = ?')
      .get(eventId).c;
    if (count >= event.capacity) return { status: 409, body: { error: 'event is full' } };

    const result = db
      .prepare('INSERT INTO registrations (user_id, event_id) VALUES (?, ?)')
      .run(userId, eventId);

    return {
      status: 201,
      body: { id: result.lastInsertRowid, event_id: eventId, message: 'registered successfully' },
    };
  });

  const { status, body } = registerTx();
  res.status(status).json(body);
});

// DELETE /api/events/:id/register
router.delete('/events/:id/register', authenticate, (req, res) => {
  const result = db
    .prepare('DELETE FROM registrations WHERE user_id = ? AND event_id = ?')
    .run(req.user.id, Number(req.params.id));

  if (result.changes === 0) {
    return res.status(404).json({ error: 'you are not registered for this event' });
  }
  res.json({ message: 'unregistered successfully' });
});

// GET /api/registrations/me
router.get('/registrations/me', authenticate, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id AS registration_id, r.created_at AS registered_at,
              e.id AS event_id, e.title, e.description, e.date_time, e.venue, e.category
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.user_id = ?
       ORDER BY e.date_time ASC`
    )
    .all(req.user.id);

  res.json(rows);
});

module.exports = router;