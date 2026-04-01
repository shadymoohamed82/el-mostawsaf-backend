const getPatients = async (client, doctorId, search = '') => {
  const sql = `
    SELECT DISTINCT
      u.id,
      u.full_name,
      u.phone,
      u.email,
      u.created_at,
      MAX(a.appointment_time) AS last_visit,
      COUNT(a.id)             AS total_visits
    FROM users u
    INNER JOIN appointments a
      ON a.patient_id = u.id AND a.doctor_id = $1
    WHERE u.role       = 'patient'
      AND u.is_deleted = FALSE
      AND ($2 = '' OR u.full_name ILIKE '%' || $2 || '%'
                   OR u.phone     ILIKE '%' || $2 || '%')
    GROUP BY u.id
    ORDER BY last_visit DESC
    LIMIT 50
  `;
  const result = await client.query(sql, [doctorId, search]);
  return result.rows;
};

const getPatientDetails = async (client, patientId, doctorId) => {
  // بيانات المريض
  const userSql = `
    SELECT id, full_name, phone, email, date_of_birth, created_at
    FROM users
    WHERE id = $1 AND role = 'patient' AND is_deleted = FALSE
  `;

  // آخر 5 مواعيد
  const apptSql = `
    SELECT id, appointment_time, status, notes, duration_minutes
    FROM appointments
    WHERE patient_id = $1 AND doctor_id = $2
    ORDER BY appointment_time DESC
    LIMIT 5
  `;

  const [userResult, apptResult] = await Promise.all([
    client.query(userSql, [patientId]),
    client.query(apptSql, [patientId, doctorId]),
  ]);

  if (!userResult.rows[0]) return null;

  return {
    ...userResult.rows[0],
    recent_appointments: apptResult.rows,
  };
};

module.exports = { getPatients, getPatientDetails };