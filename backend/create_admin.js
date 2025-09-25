const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./lms.db');

const name = 'Admin User';
const email = 'admin@example.com';
const password = 'admin123';
const role = 'admin';

// Check if admin already exists
function createAdmin() {
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('DB error:', err);
      db.close();
      return;
    }
    if (user) {
      console.log('Admin user already exists.');
      db.close();
      return;
    }
    // Hash password and insert admin
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password, role, verified) VALUES (?, ?, ?, ?, 1)',
      [name, email, hash, role],
      function(err) {
        if (err) {
          console.error('Insert error:', err);
        } else {
          console.log('Admin user created successfully!');
        }
        db.close();
      }
    );
  });
}

createAdmin(); 