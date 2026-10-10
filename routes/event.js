const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/events?search=&category=   (public)
router.get('/', (req, res) => {
  const { search, category } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered_count
    FROM events e WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ' AND (e.title LIKE ? OR e.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND e.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY e.date_time ASC';

  res.json(db.prepare(sql).all(...params));
});

// GET /api/events/:id   (public)
router.get('/:id', (req, res) => {
  const event = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered_count
       FROM events e WHERE e.id = ?`
    )
    .get(req.params.id);

  if (!event) return res.status(404).json({ error: 'event not found' });
  res.json(event);
});

// POST /api/events   (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { title, description, date_time, venue, capacity, category } = req.body;

  if (!title || !date_time || !venue || !capacity) {
    return res.status(400).json({ error: 'title, date_time, venue and capacity are required' });
  }
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return res.status(400).json({ error: 'capacity must be a positive whole number' });
  }

  const result = db
    .prepare(
      `INSERT INTO events (title, description, date_time, venue, capacity, category)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, description || null, date_time, venue, capacity, category || null);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

// PUT /api/events/:id   (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'event not found' });

  const updated = { ...event, ...req.body };

  if (!Number.isInteger(updated.capacity) || updated.capacity <= 0) {
    return res.status(400).json({ error: 'capacity must be a positive whole number' });
  }

  const count = db
    .prepare('SELECT COUNT(*) AS c FROM registrations WHERE event_id = ?')
    .get(event.id).c;
  if (updated.capacity < count) {
    return res
      .status(400)
      .json({ error: `capacity cannot be lower than current registrations (${count})` });
  }

  db.prepare(
    `UPDATE events SET title = ?, description = ?, date_time = ?, venue = ?, capacity = ?, category = ?
     WHERE id = ?`
  ).run(
    updated.title,
    updated.description,
    updated.date_time,
    updated.venue,
    updated.capacity,
    updated.category,
    event.id
  );

  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id));
});

// DELETE /api/events/:id   (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'event not found' });
  res.json({ message: 'event deleted' });
});

module.exports = router;