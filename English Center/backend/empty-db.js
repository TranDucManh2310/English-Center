const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { DB_CONFIG } = require('./db');

const TABLES = [
  'teaching_material_requests',
  'learning_activities',
  'notifications',
  'teacher_reviews',
  'exam_results',
  'exams',
  'attendance',
  'class_sessions',
  'lesson_progress',
  'lessons',
  'enrollments',
  'courses',
  'submissions',
  'sessions',
  'users'
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function emptyDatabase() {
  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
    multipleStatements: true
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      await connection.query(`TRUNCATE TABLE ${table}`);
    }
    await connection.query(
      `INSERT INTO users
        (id, email, name, role, phone, education, experience, preferred_schedule,
         newsletter, enrolled, password_hash)
       VALUES (?, ?, ?, 'admin', '', '', '', '', 0, JSON_ARRAY(), ?)`,
      [
        '5b8d74bb-1ef7-4cc6-9b1f-000000000001',
        'nhom3@englishcenter.edu.vn',
        'Quan Tri Vien',
        hashPassword('admin123C')
      ]
    );
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  emptyDatabase()
    .then(() => {
      console.log(`Database ${DB_CONFIG.database} is empty and ready for real data. Admin account was kept.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Empty database failed:', error.message);
      process.exit(1);
    });
}

module.exports = { emptyDatabase };
