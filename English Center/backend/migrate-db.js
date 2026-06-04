const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./db');

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [DB_CONFIG.database, table, column]
  );
  return Number(rows[0] && rows[0].total) > 0;
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    [DB_CONFIG.database, table, indexName]
  );
  return Number(rows[0] && rows[0].total) > 0;
}

async function migrateDatabase() {
  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database
  });

  try {
    if (!(await columnExists(connection, 'sessions', 'last_active_at'))) {
      await connection.execute(
        `ALTER TABLE sessions
           ADD COLUMN last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER user_id`
      );
      await connection.execute(
        `UPDATE sessions SET last_active_at = created_at WHERE last_active_at IS NULL`
      );
    }
    if (!(await columnExists(connection, 'sessions', 'current_page'))) {
      await connection.execute(
        `ALTER TABLE sessions
           ADD COLUMN current_page VARCHAR(255) NOT NULL DEFAULT '' AFTER last_active_at`
      );
    }
    if (!(await indexExists(connection, 'sessions', 'idx_sessions_last_active'))) {
      await connection.execute(
        `ALTER TABLE sessions
           ADD INDEX idx_sessions_last_active (last_active_at)`
      );
    }
    if (!(await columnExists(connection, 'teaching_material_requests', 'description'))) {
      await connection.execute(
        `ALTER TABLE teaching_material_requests
           ADD COLUMN description TEXT NULL AFTER status`
      );
    }
    if (!(await columnExists(connection, 'teaching_material_requests', 'video_url'))) {
      await connection.execute(
        `ALTER TABLE teaching_material_requests
           ADD COLUMN video_url VARCHAR(500) NOT NULL DEFAULT '' AFTER description`
      );
    }
    if (!(await columnExists(connection, 'teaching_material_requests', 'document_url'))) {
      await connection.execute(
        `ALTER TABLE teaching_material_requests
           ADD COLUMN document_url VARCHAR(500) NOT NULL DEFAULT '' AFTER video_url`
      );
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log(`Database ${DB_CONFIG.database} migrated.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Database migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateDatabase };
