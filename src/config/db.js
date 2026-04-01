const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      20,              // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error:', err);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * runWithRLS — القلب النابض للـ Backend
 * ─────────────────────────────────────────────────────────────────────
 * كل query حساسة لازم تتنفذ جوا transaction فيها:
 *   1. SET LOCAL app.encryption_key    → لفك تشفير البيانات الطبية
 *   2. SET LOCAL app.current_user_id   → لتفعيل الـ RLS policies
 *   3. SET LOCAL app.current_user_role → لتفعيل الـ admin bypass
 * 
 * @param {string} userId   - UUID الـ user الحالي
 * @param {string} userRole - 'patient' | 'doctor' | 'admin'
 * @param {Function} queryFn - async (client) => { ... }
 */
async function runWithRLS(userId, userRole, queryFn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Set RLS context (SET LOCAL = valid only for this transaction)
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    await client.query(`SET LOCAL app.current_user_role = '${userRole}'`);
    await client.query(
      `SET LOCAL app.encryption_key = '${process.env.DB_ENCRYPTION_KEY}'`
    );

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

/**
 * query بسيطة بدون RLS (للـ public data زي specializations)
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, runWithRLS };