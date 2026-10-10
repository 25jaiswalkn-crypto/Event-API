const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

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
// Promotes one existing account, and only while no admin exists.
// Requires the private ADMIN_BOOTSTRAP_TOKEN environment variable.
router.post('/bootstrap-admin', (req, res) => {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
  const provided = req.get('x-admin-bootstrap-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (
    !expected ||
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return res.status(403).json({ error: 'Invalid setup token' });
  }

  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim()
      : '';

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const promoteFirstAdmin = db.transaction((accountEmail) => {
    const existingAdmin = db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .get();

    if (existingAdmin) {
      return {
        status: 409,
        body: { error: 'An admin already exists' },
      };
    }

    const result = db
      .prepare("UPDATE users SET role = 'admin' WHERE email = ?")
      .run(accountEmail);

    if (result.changes !== 1) {
      return {
        status: 404,
        body: { error: 'Sign up with this email first' },
      };
    }

    return {
      status: 200,
      body: { message: 'Admin enabled. Log out and log back in.' },
    };
  });

  const result = promoteFirstAdmin(email);
  return res.status(result.status).json(result.body);
});

module.exports = router;
