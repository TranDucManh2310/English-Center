const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_center',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function pingDatabase() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0] && rows[0].ok === 1;
}

async function findUserByEmail(email) {
  const rows = await query(
    `SELECT id, email, name, role, phone, education, experience, motivation,
            preferred_schedule AS schedule, newsletter, enrolled, password_hash AS passwordHash,
            created_at AS createdAt, updated_at AS updatedAt
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const rows = await query(
    `SELECT id, email, name, role, phone, education, experience, motivation,
            preferred_schedule AS schedule, newsletter, enrolled, password_hash AS passwordHash,
            created_at AS createdAt, updated_at AS updatedAt
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser(user) {
  await query(
    `INSERT INTO users
      (id, email, name, role, phone, education, experience, motivation,
       preferred_schedule, newsletter, enrolled, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      user.phone || '',
      user.education || '',
      user.experience || '',
      user.motivation || '',
      user.schedule || '',
      user.newsletter ? 1 : 0,
      JSON.stringify(user.enrolled || []),
      user.passwordHash
    ]
  );
  return findUserById(user.id);
}

async function createSession(token, userId) {
  await query(
    'INSERT INTO sessions (token, user_id) VALUES (?, ?)',
    [token, userId]
  );
}

async function findSessionUser(token) {
  const rows = await query(
    `SELECT u.id, u.email, u.name, u.role, u.phone, u.education, u.experience,
            u.motivation, u.preferred_schedule AS schedule, u.newsletter, u.enrolled,
            u.password_hash AS passwordHash, u.created_at AS createdAt, u.updated_at AS updatedAt
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function deleteSession(token) {
  await query('DELETE FROM sessions WHERE token = ?', [token]);
}

async function createSubmission(submission) {
  await query(
    'INSERT INTO submissions (id, type, payload) VALUES (?, ?, ?)',
    [submission.id, submission.type, JSON.stringify(submission.data || {})]
  );
}

module.exports = {
  DB_CONFIG,
  pingDatabase,
  findUserByEmail,
  findUserById,
  createUser,
  createSession,
  findSessionUser,
  deleteSession,
  createSubmission
};
