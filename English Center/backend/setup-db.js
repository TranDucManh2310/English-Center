const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./db');

async function setupDatabase() {
  const schemaPath = path.join(__dirname, 'database.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    multipleStatements: true
  });

  try {
    await connection.query(schema);
  } finally {
    await connection.end();
  }

}

setupDatabase()
  .then(() => {
    console.log(`Database ${DB_CONFIG.database} is ready.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Database setup failed:', error.message);
    process.exit(1);
  });
