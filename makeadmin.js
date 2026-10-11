// Optional manual command; normal deployment runs migrations and admin seeding at startup.
require('dotenv').config();
const { pool, migrate, seedAdmin } = require('./db');

(async () => {
  try {
    await migrate();
    await seedAdmin();
  } catch (error) {
    console.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
