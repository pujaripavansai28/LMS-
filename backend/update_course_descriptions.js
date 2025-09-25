const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./lms.db');

const newDescription = 'This is a sample description for the course.';

db.serialize(() => {
  db.run(
    `UPDATE courses SET description = ? WHERE description IS NULL OR description = ''`,
    [newDescription],
    function(err) {
      if (err) {
        console.error('Error updating descriptions:', err.message);
      } else {
        console.log(`Updated ${this.changes} course(s) with a sample description.`);
      }
      db.close();
    }
  );
}); 