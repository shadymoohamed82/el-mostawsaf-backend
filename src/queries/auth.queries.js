const bcrypt = require('bcryptjs');

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
    email     || null,
    phone,
    password, // جاي محروق من الـ controller
    role,
    specialization_id || null,
  ]);

  return result.rows[0];
};

const verifyPassword = async (client, emailOrPhone, password) => {
  const sql = `
    SELECT 
      id, full_name, email, phone, role,
      password_hash, specialization_id,
      is_active, is_deleted
    FROM users
    WHERE (email = $1 OR phone = $1)
      AND is_deleted = FALSE
      AND is_active  = TRUE
  `;

  const result = await client.query(sql, [emailOrPhone]);
  const user   = result.rows[0];

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;

  return user;
};

const checkUserExists = async (client, email, phone) => {
  const sql = `
    SELECT id FROM users
    WHERE phone = $1
    ${email ? 'OR email = $2' : ''}
  `;
  const params = email ? [phone, email] : [phone];
  const result = await client.query(sql, params);
  return result.rows.length > 0;
};

module.exports = { createUser, verifyPassword, checkUserExists };