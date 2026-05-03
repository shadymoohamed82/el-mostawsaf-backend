require('dotenv').config();
const { Pool } = require('pg');
const logger   = require('../utils/logger');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl:      false,
      }
);

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error:', err);
});

async function runWithRLS(userId, userRole, queryFn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    await client.query(`SET LOCAL app.current_user_role = '${userRole}'`);
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, runWithRLS };