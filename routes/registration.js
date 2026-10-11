const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/events/:id/register
router.post('/events/:id/register', authenticate, async (req, res) => {
  const eventId = Number(req.params.id);
  const userId = req.user.id;
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query(
      'SELECT id, capacity FROM events WHERE id = $1 FOR UPDATE',
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'event not found' });
    }

    const already = await client.query(
      'SELECT id FROM registrations WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    );
    if (already.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'already registered for this event' });
    }

    const count = await client.query(
      'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id = $1',
      [eventId]
    );
    if (count.rows[0].count >= event.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'event is full' });
    }

    const inserted = await client.query(
      `INSERT INTO registrations (user_id, event_id)
       VALUES ($1, $2) RETURNING id, event_id, created_at`,
      [userId, eventId]
    );
    await client.query('COMMIT');
    res.status(201).json({
      id: inserted.rows[0].id,
      event_id: inserted.rows[0].event_id,
      registered_at: inserted.rows[0].created_at,
      message: 'registered successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'already registered for this event' });
    }
    throw error;
  } finally {
    client.release();
  }
});

// DELETE /api/events/:id/register
router.delete('/events/:id/register', authenticate, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }
  const result = await db.pool.query(
    'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2 RETURNING id',
    [req.user.id, eventId]
  );
  if (!result.rowCount) {
    return res.status(404).json({ error: 'you are not registered for this event' });
  }
  res.json({ message: 'unregistered successfully' });
});

// GET /api/registrations/me
router.get('/registrations/me', authenticate, async (req, res) => {
  const result = await db.pool.query(
    `SELECT r.id AS registration_id, r.created_at AS registered_at,
            e.id AS event_id, e.title, e.description, e.date_time, e.venue, e.category
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.user_id = $1
     ORDER BY e.date_time ASC`,
    [req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
