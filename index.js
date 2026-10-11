require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, migrate, seedAdmin } = require('./db');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiLimiter);

app.get('/', (req, res) => {
  res.json({ message: 'Event API is running!' });
});

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true, database: 'connected' });
  } catch (error) {
    console.error('Health check database query failed:', error.message);
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/events', require('./routes/event'));
app.use('/api', require('./routes/registration'));

app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
  }

  await migrate();
  await seedAdmin();

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Event API listening on 0.0.0.0:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; closing HTTP and PostgreSQL connections.`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(async (error) => {
  console.error('Startup failed:', error.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
