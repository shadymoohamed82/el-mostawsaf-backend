// ─── 1. System Stats ──────────────────────────────────────────
const getSystemStats = async (client) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE AND role = 'doctor')  AS total_doctors,
      (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE AND role = 'patient') AS total_patients,
      (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE AND role = 'admin')   AS total_admins,
      (SELECT COUNT(*) FROM appointments WHERE status = 'scheduled')             AS scheduled_appointments,
      (SELECT COUNT(*) FROM appointments WHERE status = 'completed')             AS completed_appointments,
      (SELECT COUNT(*) FROM appointments WHERE status = 'cancelled')             AS cancelled_appointments,
      (SELECT COUNT(*) FROM appointments)                                        AS total_appointments,
      (SELECT COUNT(*) FROM medical_records WHERE is_deleted = FALSE)            AS total_records,
      (SELECT COUNT(*) FROM notifications WHERE is_read = FALSE)                 AS unread_notifications,
      (SELECT COUNT(*) FROM specializations)                                     AS total_specializations
  `;
  const result = await client.query(sql);
  return result.rows[0];
};

// ─── 2. All Users ─────────────────────────────────────────────
const getAllUsers = async (client, filters = {}) => {
  const { role, search = '', limit = 50, offset = 0 } = filters;

  let conditions = ['u.is_deleted = FALSE'];
  let params     = [];
  let idx        = 1;

  if (role) {
    conditions.push(`u.role = $${idx}`);
    params.push(role);
    idx++;
  }

  if (search) {
    conditions.push(`(u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.is_active,
      u.created_at,
      s.name AS specialization
    FROM users u
    LEFT JOIN specializations s ON s.id = u.specialization_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY u.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const result = await client.query(sql, params);
  return result.rows;
};

// ─── 3. All Appointments ──────────────────────────────────────
const getAllAppointments = async (client, filters = {}) => {
  const { status, date, limit = 50, offset = 0 } = filters;

  let conditions = ['1=1'];
  let params     = [];
  let idx        = 1;

  if (status) {
    conditions.push(`a.status = $${idx}`);
    params.push(status);
    idx++;
  }

  if (date) {
    conditions.push(`a.appointment_time::date = $${idx}::date`);
    params.push(date);
    idx++;
  }

  params.push(limit, offset);

  const sql = `
    SELECT
      a.id,
      a.appointment_time,
      a.duration_minutes,
      a.status,
      a.notes,
      a.created_at,
      d.full_name  AS doctor_name,
      p.full_name  AS patient_name,
      p.phone      AS patient_phone
    FROM appointments a
    INNER JOIN users d ON d.id = a.doctor_id
    INNER JOIN users p ON p.id = a.patient_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.appointment_time DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const result = await client.query(sql, params);
  return result.rows;
};

// ─── 4. Toggle User Active ────────────────────────────────────
const toggleUserActive = async (client, userId) => {
  const sql = `
    UPDATE users
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id = $1 AND role != 'admin'
    RETURNING id, full_name, role, is_active
  `;
  const result = await client.query(sql, [userId]);
  return result.rows[0] || null;
};

// ─── 5. Recent Activity (Audit Logs) ─────────────────────────
const getRecentActivity = async (client) => {
  const sql = `
    SELECT
      a.table_name,
      a.operation,
      a.changed_at,
      u.full_name AS changed_by_name,
      u.role      AS changed_by_role
    FROM audit_logs_all a
    LEFT JOIN users u ON u.id = a.changed_by
    ORDER BY a.changed_at DESC
    LIMIT 20
  `;
  const result = await client.query(sql);
  return result.rows;
};

module.exports = {
  getSystemStats,
  getAllUsers,
  getAllAppointments,
  toggleUserActive,
  getRecentActivity,
};