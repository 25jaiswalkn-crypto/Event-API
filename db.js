const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool, types } = require('pg');

// Event dates are wall-clock times entered by users, not UTC instants.
types.setTypeParser(1114, (value) => value.replace(' ', 'T'));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it to the PostgreSQL connection string.');
}

// Render is a persistent Node service. Use Supabase's Session pooler connection
// string for IPv4 compatibility; DATABASE_URL must include SSL requirements.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

async function migrate() {
  const directory = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  let migrationLockHeld = false;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [71420832]);
    migrationLockHeld = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );
      if (applied.rowCount) continue;

      await client.query('BEGIN');
      try {
        const sql = fs.readFileSync(path.join(directory, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied database migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    if (migrationLockHeld) {
      await client.query('SELECT pg_advisory_unlock($1)', [71420832]).catch(() => {});
    }
    client.release();
  }
}

// Seed exactly one default admin from server-only environment variables.
// Existing admin accounts/passwords are never overwritten on later restarts.
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Event Administrator').trim();

  if (!email && !password) {
    console.log('Admin seed skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not set.');
    return;
  }
  if (!email || !password) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD, or remove both.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [71420831]);

    const existingAdmin = await client.query(
      "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1"
    );
    if (existingAdmin.rowCount) {
      const sameAdmin = existingAdmin.rows[0].email.toLowerCase() === email;
      await client.query('COMMIT');
      console.log(sameAdmin
        ? 'Default admin already exists; leaving its password unchanged.'
        : 'Admin seed skipped because an admin already exists.');
      return;
    }

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rowCount) {
      await client.query(
        "UPDATE users SET role = 'admin' WHERE id = $1",
        [existingUser.rows[0].id]
      );
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        [name || 'Event Administrator', email, passwordHash]
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded the default admin account for ${email}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, migrate, seedAdmin };
