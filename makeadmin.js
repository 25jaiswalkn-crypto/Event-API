const db = require('./db');

const result = db
  .prepare("UPDATE users SET role = 'admin' WHERE email = ?")
  .run('k@test.com');

console.log('Updated rows:', result.changes);