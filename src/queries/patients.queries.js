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


const getPatientSummary = async (client, patientId) => {
  const patientSql = `
    SELECT 
      id, full_name, phone, email,
      EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
    FROM users
    WHERE id = $1 AND role = 'patient' AND is_deleted = FALSE
  `;

  const apptSql = `
    SELECT 
      a.appointment_time, a.status, a.notes,
      u.full_name AS doctor_name,
      s.name      AS specialization
    FROM appointments a
    INNER JOIN users u ON u.id = a.doctor_id
    LEFT JOIN specializations s ON s.id = u.specialization_id
    WHERE a.patient_id = $1
    ORDER BY a.appointment_time DESC
    LIMIT 5
  `;

  const recordsSql = `
    SELECT
      mr.record_type, mr.created_at,
      pgp_sym_decrypt(
        mr.diagnosis_encrypted,
        current_setting('app.encryption_key')
      )::text AS diagnosis,
      pgp_sym_decrypt(
        mr.notes_encrypted,
        current_setting('app.encryption_key')
      )::text AS notes,
      u.full_name AS doctor_name
    FROM medical_records mr
    INNER JOIN users u ON u.id = mr.doctor_id
    WHERE mr.patient_id = $1
      AND mr.is_deleted = FALSE
    ORDER BY mr.created_at DESC
    LIMIT 5
  `;

  const [patient, appointments, records] = await Promise.all([
    client.query(patientSql,  [patientId]),
    client.query(apptSql,     [patientId]),
    client.query(recordsSql,  [patientId]),
  ]);

  if (!patient.rows[0]) return null;

  return {
    patient:           patient.rows[0],
    last_appointments: appointments.rows,
    medical_records:   records.rows,
  };
};

module.exports = { getPatients, getPatientDetails, getPatientSummary };
