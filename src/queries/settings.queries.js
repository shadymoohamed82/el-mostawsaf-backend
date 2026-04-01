const getProfile = async (client, userId) => {
  const sql = `
    SELECT id, full_name, phone, date_of_birth,
           email, role, specialization_id,
           is_active, created_at
    FROM users
    WHERE id = $1 AND is_deleted = FALSE
  `;
  const result = await client.query(sql, [userId]);
  return result.rows[0] || null;
};

const updateProfile = async (client, data) => {
  const { full_name, phone, date_of_birth } = data;
  const sql = `
    UPDATE v_user_profile
    SET full_name     = $1,
        phone         = $2,
        date_of_birth = $3
    WHERE id = id
    RETURNING *
  `;
  const result = await client.query(sql, [full_name, phone, date_of_birth || null]);
  return result.rows[0] || null;
};

const getNotificationPrefs = async (client, userId) => {
  const sql = `
    SELECT message, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 10
  `;
  const result = await client.query(sql, [userId]);
  return result.rows;
};

const getRecentActivity = async (client, userId) => {
  const sql = `
    SELECT table_name, operation, changed_at, row_data
    FROM audit_logs_all
    WHERE changed_by = $1
    ORDER BY changed_at DESC
    LIMIT 10
  `;
  const result = await client.query(sql, [userId]);
  return result.rows;
};

const getSpecializations = async (client) => {
  const result = await client.query('SELECT id, name FROM specializations ORDER BY name');
  return result.rows;
};

const softDeleteUser = async (client, userId) => {
  const sql = `
    UPDATE users
    SET is_deleted = TRUE, is_active = FALSE, updated_at = NOW()
    WHERE id = $1
    RETURNING id
  `;
  const result = await client.query(sql, [userId]);
  return result.rows[0] || null;
};

module.exports = {
  getProfile,
  updateProfile,
  getNotificationPrefs,
  getRecentActivity,
  getSpecializations,
  softDeleteUser,
};