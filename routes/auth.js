const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    return res.status(409).json({ error: 'email already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, password_hash);

  res.status(201).json({
    id: result.lastInsertRowid,
    name,
    email,
    role: 'user',
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// POST /api/auth/bootstrap-admin
// A logged-in account matching ADMIN_EMAIL can become the first admin.
// This endpoint stops working once any admin exists.
router.post('/bootstrap-admin', authenticate, (req, res) => {
  const allowedEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!allowedEmail) {
    return res.status(503).json({ error: 'Admin setup is not configured' });
  }

  const result = db.transaction(() => {
    const user = db
      .prepare('SELECT id, email, role FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return { status: 401, body: { error: 'Account not found' } };
    }

    if (user.email.trim().toLowerCase() !== allowedEmail) {
      return { status: 403, body: { error: 'This account is not allowed to become admin' } };
    }

    const existingAdmin = db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .get();

    if (existingAdmin) {
      return { status: 409, body: { error: 'An admin already exists' } };
    }

    const updated = db
      .prepare("UPDATE users SET role = 'admin' WHERE id = ? AND role = 'user'")
      .run(user.id);

    if (updated.changes !== 1) {
      return { status: 409, body: { error: 'Account could not be promoted' } };
    }

    return {
      status: 200,
      body: { message: 'Admin enabled. Log out and log back in.' },
    };
  })();

  return res.status(result.status).json(result.body);
});

module.exports = router;
