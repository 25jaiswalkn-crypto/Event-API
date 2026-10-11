require('dotenv').config();
const { pool, migrate } = require('./db');

(async () => {
  try {
    await migrate();
    console.log('Database migrations are up to date.');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
