const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/events?search=&category= (public)
router.get('/', async (req, res) => {
  const { search, category } = req.query;
  const params = [];
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*)::int FROM registrations r WHERE r.event_id = e.id) AS registered_count
    FROM events e WHERE 1=1`;

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (e.title ILIKE $${params.length}`;
    params.push(`%${search}%`);
    sql += ` OR e.description ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    sql += ` AND e.category = $${params.length}`;
  }
  sql += ' ORDER BY e.date_time ASC';

  const result = await db.pool.query(sql, params);
  res.json(result.rows);
});

// GET /api/events/:id/registrations (admin only; never returns password hashes)
router.get('/:id/registrations', authenticate, requireAdmin, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }

  const result = await db.pool.query(
    `SELECT r.id AS registration_id,
            r.created_at AS registered_at,
            u.id AS user_id,
            u.name,
            u.email
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY r.created_at ASC, r.id ASC`,
    [eventId]
  );
  res.json(result.rows);
});

// GET /api/events/:id (public)
router.get('/:id', async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }
  const result = await db.pool.query(
    `SELECT e.*,
       (SELECT COUNT(*)::int FROM registrations r WHERE r.event_id = e.id) AS registered_count
     FROM events e WHERE e.id = $1`,
    [eventId]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'event not found' });
  res.json(result.rows[0]);
});

// POST /api/events (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { title, description, date_time, venue, capacity, category } = req.body || {};
  if (!title || !date_time || !venue || capacity === undefined) {
    return res.status(400).json({ error: 'title, date_time, venue and capacity are required' });
  }
  const capacityNumber = Number(capacity);
  if (!Number.isSafeInteger(capacityNumber) || capacityNumber <= 0) {
    return res.status(400).json({ error: 'capacity must be a positive whole number' });
  }

  const result = await db.pool.query(
    `INSERT INTO events (title, description, date_time, venue, capacity, category)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, description || null, date_time, venue, capacityNumber, category || null]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/events/:id (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }

  const currentResult = await db.pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
  const current = currentResult.rows[0];
  if (!current) return res.status(404).json({ error: 'event not found' });

  const updated = { ...current, ...(req.body || {}) };
  const capacity = Number(updated.capacity);
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    return res.status(400).json({ error: 'capacity must be a positive whole number' });
  }

  const countResult = await db.pool.query(
    'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id = $1',
    [eventId]
  );
  const count = countResult.rows[0].count;
  if (capacity < count) {
    return res.status(400).json({ error: `capacity cannot be lower than current registrations (${count})` });
  }

  const result = await db.pool.query(
    `UPDATE events
     SET title = $1, description = $2, date_time = $3, venue = $4, capacity = $5, category = $6
     WHERE id = $7 RETURNING *`,
    [updated.title, updated.description || null, updated.date_time, updated.venue, capacity,
      updated.category || null, eventId]
  );
  res.json(result.rows[0]);
});

// DELETE /api/events/:id (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: 'invalid event id' });
  }
  const result = await db.pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [eventId]);
  if (!result.rowCount) return res.status(404).json({ error: 'event not found' });
  res.json({ message: 'event deleted' });
});

module.exports = router;
