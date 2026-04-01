// ─── Register ─────────────────────────────────────────────────
const createUser = async (client, data) => {
  const { full_name, email, phone, password, role, specialization_id } = data;

  const sql = `
    INSERT INTO users 
      (full_name, email, phone, password_hash, role, specialization_id)
    VALUES 
      ($1, $2, $3, $4, $5, $6)
    RETURNING id, full_name, email, phone, role, created_at
  `;

  const result = await client.query(sql, [
    full_name,
    email,
    phone,
    password, // الـ trigger هيشفره تلقائياً
    role,
    specialization_id || null,
  ]);

  return result.rows[0];
};

// ─── Login ────────────────────────────────────────────────────
const findUserByEmail = async (client, email) => {
  const sql = `
    SELECT 
      id, full_name, email, phone, 
      password_hash, role, specialization_id,
      is_active, is_deleted
    FROM users
    WHERE email = $1
  `;

  const result = await client.query(sql, [email]);
  return result.rows[0] || null;
};

// ─── Verify Password ──────────────────────────────────────────
const verifyPassword = async (client, email, password) => {
  const sql = `
    SELECT 
      id, full_name, email, phone, role, 
      specialization_id, is_active, is_deleted
    FROM users
    WHERE email       = $1
      AND password_hash = crypt($2, password_hash)
      AND is_deleted  = FALSE
      AND is_active   = TRUE
  `;

  const result = await client.query(sql, [email, password]);
  return result.rows[0] || null;
};

// ─── Check Email/Phone exists ─────────────────────────────────
const checkUserExists = async (client, email, phone) => {
  const sql = `
    SELECT id FROM users
    WHERE email = $1 OR phone = $2
  `;
  const result = await client.query(sql, [email, phone]);
  return result.rows.length > 0;
};

module.exports = { createUser, findUserByEmail, verifyPassword, checkUserExists };